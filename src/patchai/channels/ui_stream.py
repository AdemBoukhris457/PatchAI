"""Encode agent events as the AI SDK UI message stream.

The web app reads this with the AI SDK's ``useChat``. Each part is one
Server-Sent Event holding a JSON object, and the stream ends with
``data: [DONE]``. The response must carry the header
``x-vercel-ai-ui-message-stream: v1``.

Text and reasoning use start, delta and end parts. A text block closes
whenever a tool step begins, so words written before a tool call stay
separate from the answer that follows it. Tools are sent as dynamic tool
parts because the browser does not know their schemas.

A page that ``read_web_page`` actually opened is sent once, after the
answer, as a ``source-url`` part. Search hits that were never opened are
not sources. The same page opened twice is one source.
"""

import json
import re
from collections.abc import AsyncIterator
from urllib.parse import urlsplit, urlunsplit

from patchai.conversation import (
    Event,
    ReasoningDelta,
    TextDelta,
    ToolCalled,
    ToolFinished,
    ToolInputDelta,
    ToolStarted,
)

HEADERS = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "x-vercel-ai-ui-message-stream": "v1",
}

_FAILED = "PatchAI could not finish this reply."


def part(payload: dict[str, object]) -> str:
    """Return one Server-Sent Event for ``payload``."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def encode(events: AsyncIterator[Event]) -> AsyncIterator[str]:
    """Yield the UI message stream for ``events``."""
    blocks = _Blocks()
    yield part({"type": "start"})
    try:
        async for event in events:
            for payload in blocks.encode(event):
                yield part(payload)
    except Exception:  # noqa: BLE001
        for payload in blocks.close():
            yield part(payload)
        for payload in blocks.sources():
            yield part(payload)
        yield part({"type": "error", "errorText": _FAILED})
    else:
        for payload in blocks.close():
            yield part(payload)
        for payload in blocks.sources():
            yield part(payload)
    yield part({"type": "finish"})
    yield "data: [DONE]\n\n"


class _Blocks:
    """Track the open text or reasoning block and number new ones."""

    def __init__(self) -> None:
        self._count = 0
        self._open: tuple[str, str] | None = None
        self._calls: dict[str, str] = {}
        self._titles: dict[str, str] = {}
        self._seen: set[str] = set()
        self._sources: list[dict[str, object]] = []

    def encode(self, event: Event) -> list[dict[str, object]]:
        if isinstance(event, TextDelta):
            return [*self._ensure("text"), self._delta(event.text)]
        if isinstance(event, ReasoningDelta):
            return [*self._ensure("reasoning"), self._delta(event.text)]
        return [*self.close(), *self._tool(event)]

    def sources(self) -> list[dict[str, object]]:
        """The pages opened during this turn, in the order they were read."""
        pending = self._sources
        self._sources = []
        return pending

    def close(self) -> list[dict[str, object]]:
        if self._open is None:
            return []
        kind, block_id = self._open
        self._open = None
        return [{"type": f"{kind}-end", "id": block_id}]

    def _ensure(self, kind: str) -> list[dict[str, object]]:
        if self._open is not None and self._open[0] == kind:
            return []
        closed = self.close()
        self._count += 1
        block_id = f"{kind}-{self._count}"
        self._open = (kind, block_id)
        return [*closed, {"type": f"{kind}-start", "id": block_id}]

    def _delta(self, text: str) -> dict[str, object]:
        assert self._open is not None
        kind, block_id = self._open
        return {"type": f"{kind}-delta", "id": block_id, "delta": text}


    def _tool(self, event: Event) -> list[dict[str, object]]:
        if isinstance(event, ToolStarted):
            self._calls[event.call_id] = event.name
            return [{
                "type": "tool-input-start",
                "toolCallId": event.call_id,
                "toolName": event.name,
                "dynamic": True,
                **_origin(event.subagent),
            }]
        if isinstance(event, ToolInputDelta):
            return [{
                "type": "tool-input-delta",
                "toolCallId": event.call_id,
                "inputTextDelta": event.delta,
            }]
        if isinstance(event, ToolCalled):
            self._calls[event.call_id] = event.name
            return [{
                "type": "tool-input-available",
                "toolCallId": event.call_id,
                "toolName": event.name,
                "input": event.args,
                "dynamic": True,
                **_origin(event.subagent),
            }]
        if isinstance(event, ToolFinished) and event.error:
            return [{
                "type": "tool-output-error",
                "toolCallId": event.call_id,
                "errorText": event.output,
                "dynamic": True,
            }]
        if isinstance(event, ToolFinished):
            self._note(event.call_id, event.output)
            return [{
                "type": "tool-output-available",
                "toolCallId": event.call_id,
                "output": event.output,
                "dynamic": True,
            }]
        raise TypeError(f"Unknown event {event!r}")

    def _note(self, call_id: str, output: str) -> None:
        name = self._calls.get(call_id)
        if name == "search_web":
            self._titles.update(_search_titles(output))
            return
        if name != "read_web_page":
            return
        found = _page_source(output, self._titles)
        if found is None:
            return
        key, source = found
        if key in self._seen:
            return
        self._seen.add(key)
        self._sources.append(source)


def _origin(subagent: bool) -> dict[str, object]:
    return {"toolMetadata": {"subagent": True}} if subagent else {}


def _search_titles(output: str) -> dict[str, str]:
    payload = _object(output)
    results = payload.get("results") if payload is not None else None
    if not isinstance(results, list):
        return {}
    found: dict[str, str] = {}
    for row in results:
        if not isinstance(row, dict):
            continue
        url = row.get("url")
        title = row.get("title")
        if not isinstance(url, str) or not isinstance(title, str) or not title.strip():
            continue
        key = _source_key(url)
        if key is not None:
            found[key] = title.strip()
    return found


def _page_source(
    output: str, titles: dict[str, str]
) -> tuple[str, dict[str, object]] | None:
    payload = _object(output)
    url = payload.get("url") if payload is not None else _leading_url(output)
    if not isinstance(url, str):
        return None
    key = _source_key(url)
    if key is None:
        return None
    title = titles.get(key) or _host(url)
    return key, {
        "type": "source-url",
        "sourceId": url,
        "url": url,
        "title": title,
    }


def _leading_url(output: str) -> str | None:
    """The page address at the start of a tool result, even when the body was cut."""
    text = output.lstrip()
    if not text.startswith("{"):
        return None
    match = re.search(r'"url"\s*:\s*"((?:\\.|[^"\\])*)"', text)
    if match is None:
        return None
    try:
        url = json.loads(f'"{match.group(1)}"')
    except json.JSONDecodeError:
        return None
    return url if isinstance(url, str) else None


def _object(output: str) -> dict[str, object] | None:
    try:
        payload = json.loads(output)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def _source_key(url: str) -> str | None:
    """One identity for a page, ignoring a trailing slash and a fragment."""
    parsed = urlsplit(url.strip())
    if parsed.scheme not in {"http", "https"} or parsed.hostname is None:
        return None
    if parsed.username or parsed.password:
        return None
    path = parsed.path.rstrip("/") or "/"
    return urlunsplit((parsed.scheme, parsed.hostname.lower(), path, parsed.query, ""))


def _host(url: str) -> str:
    host = urlsplit(url.strip()).hostname or ""
    lowered = host.lower()
    return host[4:] if lowered.startswith("www.") else host
