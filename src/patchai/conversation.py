"""Send one user turn to an agent thread and report what happens.

Streaming follows the Deep Agents streaming guide: ``astream`` with
``stream_mode=["messages", "updates"]``, ``subgraphs=True`` and
``version="v2"``. Each chunk is a ``StreamPart`` with ``type``, ``ns`` and
``data``. An empty ``ns`` is the main agent; a ``tools:<id>`` segment is a
subagent started by the ``task`` tool.

``messages`` chunks carry model tokens: text, reasoning and tool-call
chunks. ``updates`` chunks carry completed steps: the model's parsed tool
calls and the tools' results. Both are turned into the channel-neutral
events below, so a channel can show progress without knowing LangGraph.
"""

from collections.abc import AsyncIterator, Iterable
from dataclasses import dataclass
from typing import Any

from patchai.channels.content import UserContent

from langchain_core.messages import AIMessage, AIMessageChunk, ToolMessage

_MAX_OUTPUT = 4000


@dataclass(frozen=True)
class TextDelta:
    """A piece of the main agent's answer."""

    text: str


@dataclass(frozen=True)
class ReasoningDelta:
    """A piece of the main agent's reasoning, when the model shares it."""

    text: str


@dataclass(frozen=True)
class ToolStarted:
    """The model began writing a call to ``name``."""

    call_id: str
    name: str
    subagent: bool


@dataclass(frozen=True)
class ToolInputDelta:
    """More of the JSON arguments for ``call_id``."""

    call_id: str
    delta: str


@dataclass(frozen=True)
class ToolCalled:
    """The call to ``name`` is complete and about to run."""

    call_id: str
    name: str
    args: dict[str, Any]
    subagent: bool


@dataclass(frozen=True)
class ToolFinished:
    """The tool returned ``output``, or failed when ``error`` is true."""

    call_id: str
    output: str
    error: bool


Event = TextDelta | ReasoningDelta | ToolStarted | ToolInputDelta | ToolCalled | ToolFinished


async def ask(agent: Any, thread_id: str, content: UserContent) -> str:
    """Append ``content`` to ``thread_id`` and return the assistant's text."""
    parts = [
        event.text
        async for event in stream_events(agent, thread_id, content)
        if isinstance(event, TextDelta)
    ]
    return "".join(parts)


async def stream_events(agent: Any, thread_id: str, content: UserContent) -> AsyncIterator[Event]:
    """Yield text, reasoning and tool progress for one turn.

    ``content`` is the new user message. A string is a text turn. A list is
    the multimodal content blocks Deep Agents reads on the user message.
    """
    config = {"configurable": {"thread_id": thread_id}}
    earlier = await _earlier_calls(agent, config)
    open_calls: dict[tuple[tuple[str, ...], int], str] = {}
    announced: set[str] = set()
    async for chunk in agent.astream(
        {"messages": [{"role": "user", "content": content}]},
        config,
        stream_mode=["messages", "updates"],
        subgraphs=True,
        version="v2",
    ):
        ns = tuple(chunk.get("ns") or ())
        subagent = any(segment.startswith("tools:") for segment in ns)
        if chunk.get("type") == "messages":
            token, _metadata = chunk["data"]
            for event in _token_events(token, ns, subagent, open_calls):
                if isinstance(event, ToolStarted):
                    announced.add(event.call_id)
                yield event
        elif chunk.get("type") == "updates":
            for event in _update_events(chunk.get("data"), subagent):
                if event.call_id in earlier:
                    continue
                if isinstance(event, ToolCalled) and event.call_id not in announced:
                    announced.add(event.call_id)
                    yield ToolStarted(event.call_id, event.name, subagent)
                yield event


async def _earlier_calls(agent: Any, config: dict[str, Any]) -> set[str]:
    """Tool call ids already in the thread.

    Middleware may write the whole history back as an update at the start of
    a turn, so those calls would otherwise be reported again.
    """
    if getattr(agent, "checkpointer", None) is None:
        return set()
    snapshot = await agent.aget_state(config)
    messages = (snapshot.values or {}).get("messages") or []
    return {
        call_id
        for message in messages
        for call_id in _call_ids(message)
    }


def _call_ids(message: object) -> Iterable[str]:
    if isinstance(message, AIMessage):
        return [call["id"] for call in message.tool_calls if call.get("id")]
    if isinstance(message, ToolMessage):
        return [message.tool_call_id]
    return []


def _token_events(
    token: object,
    ns: tuple[str, ...],
    subagent: bool,
    open_calls: dict[tuple[tuple[str, ...], int], str],
) -> Iterable[Event]:
    if not isinstance(token, AIMessageChunk):
        return
    for call in token.tool_call_chunks or ():
        index = call.get("index") or 0
        call_id = call.get("id")
        name = call.get("name")
        if call_id and name:
            open_calls[(ns, index)] = call_id
            yield ToolStarted(call_id, name, subagent)
        current = open_calls.get((ns, index))
        args = call.get("args")
        if current and args:
            yield ToolInputDelta(current, args)
    if subagent:
        return
    for block in token.content_blocks:
        kind = block.get("type")
        if kind == "text" and block.get("text"):
            yield TextDelta(block["text"])
        elif kind == "reasoning" and block.get("reasoning"):
            yield ReasoningDelta(block["reasoning"])


def _update_events(data: object, subagent: bool) -> Iterable[ToolCalled | ToolFinished]:
    if not isinstance(data, dict):
        return
    for update in data.values():
        for message in _messages(update):
            if isinstance(message, AIMessage):
                for call in message.tool_calls:
                    if call.get("id"):
                        yield ToolCalled(call["id"], call["name"], call.get("args") or {}, subagent)
            elif isinstance(message, ToolMessage):
                yield ToolFinished(
                    message.tool_call_id,
                    _clip(_text(message.content)),
                    getattr(message, "status", "success") == "error",
                )


def _messages(update: object) -> list[object]:
    if isinstance(update, list):
        return [message for item in update for message in _messages(item)]
    if not isinstance(update, dict):
        return []
    messages = update.get("messages")
    if isinstance(messages, list):
        return messages
    value = getattr(messages, "value", None)
    return value if isinstance(value, list) else []


def _text(content: object) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return str(content)
    return "".join(
        block if isinstance(block, str) else str(block.get("text", ""))
        for block in content
        if isinstance(block, (str, dict))
    )


def _clip(text: str) -> str:
    return text if len(text) <= _MAX_OUTPUT else f"{text[:_MAX_OUTPUT]}…"
