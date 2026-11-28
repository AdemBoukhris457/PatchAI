"""Public web search through ddgs.

ddgs asks ordinary search engines and reads the page at a URL. No key or
account is needed. A search engine can refuse a query; the tool then says so.
Research workers call these tools in parallel, so searches share a few
slots, start at least a moment apart, and wait and retry when every engine
rate-limits them. A page or search another worker fetched in the last few
minutes is answered from memory, and a fetch already under way is shared.
"""

import ipaddress
import json
import re
import socket
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Generic, TypeVar
from urllib.parse import urlsplit

from ddgs import DDGS
from ddgs.exceptions import DDGSException, RatelimitException

_PAGE_LIMIT = 8_000
_RESULT_LIMIT = 8
_TIMEOUT_SECONDS = 12
_BACKENDS = ("yahoo", "google", "auto")
_SEARCH_GAP_SECONDS = 0.5
_RETRY_WAITS = (3.0, 8.0)
_SEARCH_SLOTS = threading.BoundedSemaphore(5)
_READ_SLOTS = threading.BoundedSemaphore(8)
_SITE_FILTER = re.compile(r"(?<!\S)site:(\S+)", re.IGNORECASE)
_RECENT_SECONDS = 600.0
_RECENT_SIZE = 256
_pace_lock = threading.Lock()
_last_search = 0.0
_sleep = time.sleep
_clock = time.monotonic

T = TypeVar("T")


class _Recent(Generic[T]):
    """Answers fetched in the last few minutes, shared by every worker.

    A second caller for a key that is still being fetched waits for that
    fetch instead of starting its own. A failed fetch is not kept.
    """

    def __init__(self, seconds: float, size: int) -> None:
        self._seconds = seconds
        self._size = size
        self._lock = threading.Lock()
        self._items: OrderedDict[object, tuple[float, T]] = OrderedDict()
        self._fetching: dict[object, threading.Lock] = {}

    def get(self, key: object, fetch: Callable[[], T], keep: Callable[[T], bool]) -> T:
        with self._lock:
            found = self._fresh(key)
            if found is not None:
                return found[1]
            gate = self._fetching.setdefault(key, threading.Lock())
        with gate:
            with self._lock:
                found = self._fresh(key)
            if found is not None:
                return found[1]
            try:
                value = fetch()
            finally:
                with self._lock:
                    self._fetching.pop(key, None)
            if keep(value):
                with self._lock:
                    self._items[key] = (_clock() + self._seconds, value)
                    while len(self._items) > self._size:
                        self._items.popitem(last=False)
            return value

    def clear(self) -> None:
        with self._lock:
            self._items.clear()
            self._fetching.clear()

    def _fresh(self, key: object) -> tuple[float, T] | None:
        found = self._items.get(key)
        if found is None:
            return None
        if found[0] <= _clock():
            del self._items[key]
            return None
        return found


_recent_searches: _Recent[list[dict[str, object]]] = _Recent(_RECENT_SECONDS, _RECENT_SIZE)
_recent_pages: _Recent[str] = _Recent(_RECENT_SECONDS, _RECENT_SIZE)


def search_web(query: str, max_results: int = 5) -> str:
    """Search the public web for a current fact no other tool covers.

    Use this for news, a public page, or a fact that may have changed.
    Do not use it for a stock quote, a US flood-claim count, the clock, or
    a file this agent already saved: those have their own tools. ``query``
    is a short search. ``max_results`` is from 1 to 8. The reply is a list
    of titles, addresses, and snippets. Read the page you will cite with
    read_web_page before you state a number or a date from it.
    """
    text = _plain_query(query)
    if not text:
        return "A search needs a query."
    count = _count(max_results)
    try:
        rows = _recent_searches.get(
            (text.casefold(), count), lambda: _search(text, count), keep=bool
        )
    except DDGSException as exc:
        return f"Web search did not answer: {exc}"
    results = [
        {
            "title": str(row.get("title") or "").strip(),
            "url": str(row.get("href") or "").strip(),
            "snippet": str(row.get("body") or "").strip(),
        }
        for row in rows
        if str(row.get("href") or "").strip()
    ]
    if not results:
        return "Web search returned no results."
    return json.dumps({"query": text, "results": results})


def read_web_page(url: str) -> str:
    """Read one public web page and return its text.

    Call this after search_web, on the address you will cite. ``url`` must
    be an http or https page on the public web. The reply starts at the
    page's first paragraph and is cut off after 8000 characters.
    """
    address = url.strip()
    rejected = _reject_private(address)
    if rejected:
        return rejected
    return _recent_pages.get(
        address.split("#", 1)[0], lambda: _read(address), keep=lambda reply: reply.startswith("{")
    )


def _read(address: str) -> str:
    try:
        with _READ_SLOTS:
            page = DDGS(timeout=_TIMEOUT_SECONDS).extract(address, fmt="text_plain")
    except DDGSException as exc:
        return f"The page could not be read: {exc}"
    content = page.get("content")
    if not isinstance(content, str) or not content.strip():
        return "The page had no text to read."
    text = _article(content)
    clipped = text[:_PAGE_LIMIT]
    return json.dumps(
        {
            "url": str(page.get("url") or address),
            "text": clipped,
            "truncated": len(text) > _PAGE_LIMIT,
        }
    )


class WebSearchPlugin:
    """Public web search, registered under the name listed in config.toml."""

    name = "web_search"

    def tools(self) -> list[Callable[..., object]]:
        """Return the callables this plugin contributes."""
        return [search_web, read_web_page]


plugin = WebSearchPlugin()


def _search(query: str, count: int) -> list[dict[str, object]]:
    """Search in a shared slot, and wait and retry while every engine rate-limits."""
    with _SEARCH_SLOTS:
        for wait in (*_RETRY_WAITS, None):
            try:
                return _search_engines(query, count)
            except RatelimitException:
                if wait is None:
                    raise
                _sleep(wait)
    raise DDGSException("No results found.")


def _search_engines(query: str, count: int) -> list[dict[str, object]]:
    """Search, then try another engine when the first one returns nothing.

    Yahoo answers or says it has nothing in about a second. Google goes
    through a proxy that can take the whole timeout, and ``auto`` also asks
    engines that can, so they come after it.
    """
    last_error = "No results found."
    limited = False
    for backend in _BACKENDS:
        _pace()
        try:
            rows = DDGS(timeout=_TIMEOUT_SECONDS).text(
                query,
                max_results=count,
                backend=backend,
            )
        except RatelimitException as exc:
            last_error = str(exc)
            limited = True
            continue
        except DDGSException as exc:
            last_error = str(exc)
            continue
        if rows:
            return list(rows)
    if limited:
        raise RatelimitException(last_error)
    raise DDGSException(last_error)


def _plain_query(query: str) -> str:
    """The query with each ``site:`` filter turned into the site's name.

    Yahoo returns nothing for a ``site:`` filter, so the search falls
    through to the engines that can take the whole timeout.
    """
    def site_name(match: re.Match[str]) -> str:
        target = match.group(1).strip("\"'")
        host = urlsplit(target if "//" in target else f"//{target}").hostname or target
        return host.removeprefix("www.")

    return " ".join(_SITE_FILTER.sub(site_name, query).split())


def _pace() -> None:
    """Start engine requests at least ``_SEARCH_GAP_SECONDS`` apart across threads."""
    global _last_search
    with _pace_lock:
        wait = _last_search + _SEARCH_GAP_SECONDS - time.monotonic()
        if wait > 0:
            _sleep(wait)
        _last_search = time.monotonic()


def _article(text: str) -> str:
    """Return the page from its first real paragraph.

    A full download starts with menus and link lists. The first block that
    is a sentence is where the page actually says something.
    """
    cleaned = text.strip()
    if ". " in cleaned[:2_000]:
        return cleaned
    blocks = cleaned.split("\n\n")
    for index, block in enumerate(blocks):
        piece = block.strip()
        if len(piece) > 200 and ". " in piece:
            return "\n\n".join(part.strip() for part in blocks[index:] if part.strip())
    return cleaned


def _count(limit: int) -> int:
    try:
        count = int(limit)
    except (TypeError, ValueError):
        count = 5
    return max(1, min(count, _RESULT_LIMIT))


def _reject_private(url: str) -> str | None:
    """Return an error when ``url`` is not a public http or https page."""
    parsed = urlsplit(url)
    host = (parsed.hostname or "").rstrip(".").lower()
    if (
        parsed.scheme not in {"http", "https"}
        or not host
        or parsed.username
        or parsed.password
    ):
        return "The address must be an http or https page."
    if host == "localhost" or host.endswith(".localhost") or not _public_host(host):
        return "That address is not a public web page."
    return None


def _public_host(host: str) -> bool:
    """True when every address for ``host`` is on the public internet."""
    try:
        addresses = [ipaddress.ip_address(host)]
    except ValueError:
        try:
            infos = socket.getaddrinfo(host, None)
        except socket.gaierror:
            return False
        addresses = [ipaddress.ip_address(info[4][0]) for info in infos]
    return bool(addresses) and all(address.is_global for address in addresses)
