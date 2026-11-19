"""Encode agent events as the AI SDK UI message stream.

The web app reads this with the AI SDK's ``useChat``. Each part is one
Server-Sent Event holding a JSON object, and the stream ends with
``data: [DONE]``. The response must carry the header
``x-vercel-ai-ui-message-stream: v1``.

Text and reasoning use start, delta and end parts. A text block closes
whenever a tool step begins, so words written before a tool call stay
separate from the answer that follows it. Tools are sent as dynamic tool
parts because the browser does not know their schemas.
"""

import json
from collections.abc import AsyncIterator

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
        yield part({"type": "error", "errorText": _FAILED})
    else:
        for payload in blocks.close():
            yield part(payload)
    yield part({"type": "finish"})
    yield "data: [DONE]\n\n"


class _Blocks:
    """Track the open text or reasoning block and number new ones."""

    def __init__(self) -> None:
        self._count = 0
        self._open: tuple[str, str] | None = None

    def encode(self, event: Event) -> list[dict[str, object]]:
        if isinstance(event, TextDelta):
            return [*self._ensure("text"), self._delta(event.text)]
        if isinstance(event, ReasoningDelta):
            return [*self._ensure("reasoning"), self._delta(event.text)]
        return [*self.close(), _tool(event)]

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


def _tool(event: Event) -> dict[str, object]:
    if isinstance(event, ToolStarted):
        return {
            "type": "tool-input-start",
            "toolCallId": event.call_id,
            "toolName": event.name,
            "dynamic": True,
            **_origin(event.subagent),
        }
    if isinstance(event, ToolInputDelta):
        return {
            "type": "tool-input-delta",
            "toolCallId": event.call_id,
            "inputTextDelta": event.delta,
        }
    if isinstance(event, ToolCalled):
        return {
            "type": "tool-input-available",
            "toolCallId": event.call_id,
            "toolName": event.name,
            "input": event.args,
            "dynamic": True,
            **_origin(event.subagent),
        }
    if isinstance(event, ToolFinished) and event.error:
        return {
            "type": "tool-output-error",
            "toolCallId": event.call_id,
            "errorText": event.output,
            "dynamic": True,
        }
    if isinstance(event, ToolFinished):
        return {
            "type": "tool-output-available",
            "toolCallId": event.call_id,
            "output": event.output,
            "dynamic": True,
        }
    raise TypeError(f"Unknown event {event!r}")


def _origin(subagent: bool) -> dict[str, object]:
    return {"toolMetadata": {"subagent": True}} if subagent else {}
