"""Public web search through ddgs.

ddgs asks ordinary search engines and reads the page at a URL. No key or
account is needed. A search engine can refuse a query; the tool then says so.
"""

import ipaddress
import json
import socket
from collections.abc import Callable
from urllib.parse import urlsplit

from ddgs import DDGS
from ddgs.exceptions import DDGSException

_PAGE_LIMIT = 8_000
_RESULT_LIMIT = 8
_TIMEOUT_SECONDS = 12
_FALLBACK_BACKENDS = ("google", "yahoo", "bing")


def search_web(query: str, max_results: int = 5) -> str:
    """Search the public web for a current fact no other tool covers.

    Use this for news, a public page, or a fact that may have changed.
    Do not use it for a stock quote, a US flood-claim count, the clock, or
    a file this agent already saved: those have their own tools. ``query``
    is a short search. ``max_results`` is from 1 to 8. The reply is a list
    of titles, addresses, and snippets. Read the page you will cite with
    read_web_page before you state a number or a date from it.
    """
    text = query.strip()
    if not text:
        return "A search needs a query."
    try:
        rows = _search(text, _count(max_results))
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
    try:
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
    """Search, then try another engine when the first one returns nothing.

    The default engine list can stop after a result set that does not match
    the query. A named engine is the second try.
    """
    last_error = "No results found."
    for backend in ("auto", *_FALLBACK_BACKENDS):
        try:
            rows = DDGS(timeout=_TIMEOUT_SECONDS).text(
                query,
                max_results=count,
                backend=backend,
            )
        except DDGSException as exc:
            last_error = str(exc)
            if "timed out" in last_error:
                break
            continue
        if rows:
            return list(rows)
    raise DDGSException(last_error)


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
