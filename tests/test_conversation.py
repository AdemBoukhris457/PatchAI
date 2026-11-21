"""One turn streams text and tool progress as channel-neutral events."""

import asyncio
import json
from collections.abc import Iterator
from typing import Any

import pytest
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult

from patchai.config.models import Settings
from patchai.conversation import (
    ReasoningDelta,
    TextDelta,
    ToolCalled,
    ToolFinished,
    ToolInputDelta,
    ToolStarted,
    _token_events,
    ask,
    stream_events,
)
from patchai.harness import build_agent


class ScriptedModel(BaseChatModel):
    """Replays ``replies`` in order and streams tool calls as chunks."""

    replies: list[AIMessage]
    turn: int = 0

    @property
    def _llm_type(self) -> str:
        return "scripted"

    def bind_tools(self, tools, **kwargs):  # noqa: ANN001, ANN003
        return self

    def _next(self) -> AIMessage:
        reply = self.replies[self.turn]
        self.turn += 1
        return reply

    def _generate(
        self, messages: list[BaseMessage], stop=None, run_manager=None, **kwargs: Any  # noqa: ANN001
    ) -> ChatResult:
        return ChatResult(generations=[ChatGeneration(message=self._next())])

    def _stream(
        self, messages: list[BaseMessage], stop=None, run_manager=None, **kwargs: Any  # noqa: ANN001
    ) -> Iterator[ChatGenerationChunk]:
        reply = self._next()
        for index, call in enumerate(reply.tool_calls):
            yield _chunk(tool_call_chunks=[
                {"name": call["name"], "args": "", "id": call["id"], "index": index}
            ])
            yield _chunk(tool_call_chunks=[
                {"name": None, "args": json.dumps(call["args"]), "id": None, "index": index}
            ])
        if reply.content:
            for word in str(reply.content).split(" "):
                yield _chunk(content=f"{word} ")


def _chunk(**fields: Any) -> ChatGenerationChunk:
    return ChatGenerationChunk(message=AIMessageChunk(content=fields.pop("content", ""), **fields))


def _agent(*replies: AIMessage):  # noqa: ANN202
    return build_agent(
        Settings(channel="web", model="scripted", plugins=("example_clock",), mcp_config="mcp.json"),
        model=ScriptedModel(replies=list(replies)),
    )


@pytest.mark.asyncio
async def test_a_tool_turn_streams_each_step_in_order() -> None:
    agent = _agent(
        AIMessage(content="", tool_calls=[{"name": "current_time", "args": {}, "id": "call_1"}]),
        AIMessage(content="It is noon."),
    )

    events = [event async for event in stream_events(agent, "thread", "what time is it")]

    assert events[:3] == [
        ToolStarted("call_1", "current_time", False),
        ToolInputDelta("call_1", "{}"),
        ToolCalled("call_1", "current_time", {}, False),
    ]
    finished = events[3]
    assert isinstance(finished, ToolFinished)
    assert finished.call_id == "call_1"
    assert not finished.error
    assert "T" in finished.output
    assert "".join(e.text for e in events[4:] if isinstance(e, TextDelta)) == "It is noon. "


@pytest.mark.asyncio
async def test_ask_returns_only_the_answer_text() -> None:
    agent = _agent(
        AIMessage(content="", tool_calls=[{"name": "current_time", "args": {}, "id": "call_1"}]),
        AIMessage(content="It is noon."),
    )

    assert await ask(agent, "thread", "what time is it") == "It is noon. "


class PausingModel(BaseChatModel):
    """Waits inside the model call so a cancel can land before the answer."""

    started: asyncio.Event
    release: asyncio.Event

    model_config = {"arbitrary_types_allowed": True}

    @property
    def _llm_type(self) -> str:
        return "pausing"

    def bind_tools(self, tools, **kwargs):  # noqa: ANN001, ANN003
        return self

    def _generate(
        self, messages: list[BaseMessage], stop=None, run_manager=None, **kwargs: Any  # noqa: ANN001
    ) -> ChatResult:
        raise AssertionError("the cancel test must take the async path")

    async def _astream(
        self, messages: list[BaseMessage], stop=None, run_manager=None, **kwargs: Any  # noqa: ANN001
    ) -> Any:
        self.started.set()
        await self.release.wait()
        yield ChatGenerationChunk(message=AIMessageChunk(content="should-not-land"))


@pytest.mark.asyncio
async def test_cancelling_the_stream_stops_before_the_answer_is_saved() -> None:
    started = asyncio.Event()
    release = asyncio.Event()
    agent = build_agent(
        Settings(channel="web", model="pausing", plugins=(), mcp_config="mcp.json"),
        model=PausingModel(started=started, release=release),
    )
    task = asyncio.create_task(ask(agent, "stop", "hello"))
    await asyncio.wait_for(started.wait(), 5)

    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    state = agent.get_state({"configurable": {"thread_id": "stop"}})
    contents = [getattr(message, "content", "") for message in state.values["messages"]]
    assert "should-not-land" not in contents
    assert any(content == "hello" for content in contents)


@pytest.mark.asyncio
async def test_a_later_turn_reports_only_its_own_tool_calls() -> None:
    agent = _agent(
        AIMessage(content="", tool_calls=[{"name": "current_time", "args": {}, "id": "call_1"}]),
        AIMessage(content="It is noon."),
        AIMessage(content="", tool_calls=[{"name": "current_time", "args": {}, "id": "call_2"}]),
        AIMessage(content="Still noon."),
    )
    await ask(agent, "thread", "what time is it")

    events = [event async for event in stream_events(agent, "thread", "and now?")]

    call_ids = {event.call_id for event in events if hasattr(event, "call_id")}
    assert call_ids == {"call_2"}


def test_reasoning_blocks_become_reasoning_events() -> None:
    token = AIMessageChunk(
        content=[{"type": "reasoning", "reasoning": "think"}, {"type": "text", "text": "hi"}]
    )

    assert list(_token_events(token, (), False, {})) == [ReasoningDelta("think"), TextDelta("hi")]


def test_subagent_text_stays_out_of_the_answer() -> None:
    token = AIMessageChunk(content="inner notes")

    assert list(_token_events(token, ("tools:abc",), True, {})) == []
