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

from collections.abc import AsyncIterator, Iterable, Sequence
from dataclasses import dataclass
from typing import Any

from patchai.channels.content import UserContent
from patchai.model_choice import requested_effort, requested_model

from langchain_core.messages import AIMessage, AIMessageChunk, RemoveMessage, ToolMessage
from langgraph.graph.message import REMOVE_ALL_MESSAGES

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

# One line of the conversation the page still shows, before the new turn.
PriorLine = tuple[str, str]


async def ask(
    agent: Any,
    thread_id: str,
    content: UserContent,
    prior: Sequence[PriorLine] | None = None,
) -> str:
    """Append ``content`` to ``thread_id`` and return the assistant's text."""
    parts = [
        event.text
        async for event in stream_events(agent, thread_id, content, prior)
        if isinstance(event, TextDelta)
    ]
    return "".join(parts)


async def stream_events(
    agent: Any,
    thread_id: str,
    content: UserContent,
    prior: Sequence[PriorLine] | None = None,
    model: str | None = None,
    effort: str | None = None,
) -> AsyncIterator[Event]:
    """Yield text, reasoning and tool progress for one turn.

    ``content`` is the new user message. A string is a text turn. A list is
    the multimodal content blocks Deep Agents reads on the user message.
    ``prior`` is the dialogue the page kept. When it is set, the turn forks
    from the checkpoint just before the edited message instead of appending
    onto the latest head.
    ``model`` is a chat model id from the page. When it is set, that model
    answers this turn. ``effort`` is that model's reasoning effort.
    """
    choice = requested_model.set(model)
    effort_choice = requested_effort.set(effort)
    try:
        async for event in _stream_turn(agent, thread_id, content, prior):
            yield event
    finally:
        requested_effort.reset(effort_choice)
        requested_model.reset(choice)


async def _stream_turn(
    agent: Any,
    thread_id: str,
    content: UserContent,
    prior: Sequence[PriorLine] | None,
) -> AsyncIterator[Event]:
    config = await _resume_config(agent, thread_id, prior)
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


async def _resume_config(
    agent: Any,
    thread_id: str,
    prior: Sequence[PriorLine] | None,
) -> dict[str, Any]:
    """Choose the checkpoint this turn continues from.

    A missing ``prior`` means the caller is appending, which is what the
    terminal channel does. A present ``prior`` is the page's kept dialogue.
    The matching finished checkpoint is the parent of the message being
    sent, and running from it forks the thread. The older path stays in
    the checkpointer.
    """
    config: dict[str, Any] = {"configurable": {"thread_id": thread_id}}
    if prior is None or getattr(agent, "checkpointer", None) is None:
        return config
    wanted = [(role, text.strip()) for role, text in prior if text.strip()]
    head = await agent.aget_state(config)
    if _dialogue((head.values or {}).get("messages") or []) == wanted:
        return config
    async for snapshot in agent.aget_state_history(config):
        messages = (snapshot.values or {}).get("messages") or []
        if _dialogue(messages) != wanted:
            continue
        if not wanted or not snapshot.next:
            return snapshot.config
    await _install(agent, config, wanted)
    return config


async def _install(agent: Any, config: dict[str, Any], prior: list[PriorLine]) -> None:
    """Replace the head's messages with ``prior`` when no checkpoint matches.

    This is the restart case: the page still has the thread, and the
    checkpointer does not. The old checkpoints are left stored.
    """
    messages: list[object] = [RemoveMessage(id=REMOVE_ALL_MESSAGES)]
    messages.extend(
        {"role": "user" if role == "user" else "assistant", "content": text}
        for role, text in prior
    )
    await agent.aupdate_state(config, {"messages": messages})


def _dialogue(messages: Iterable[object]) -> list[PriorLine]:
    """Return the user and assistant text, joining a turn's answer into one line."""
    lines: list[PriorLine] = []
    for message in messages:
        kind = getattr(message, "type", "")
        text = _plain_text(getattr(message, "content", "")).strip()
        if not text:
            continue
        if kind == "human":
            lines.append(("user", text))
        elif kind == "ai":
            if lines and lines[-1][0] == "assistant":
                lines[-1] = ("assistant", f"{lines[-1][1]}{text}")
            else:
                lines.append(("assistant", text))
    return lines


def _plain_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if isinstance(block, str):
            parts.append(block)
        elif isinstance(block, dict) and block.get("type") in (None, "text"):
            parts.append(str(block.get("text", "")))
    return "".join(parts)


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
