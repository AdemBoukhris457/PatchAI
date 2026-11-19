"""One turn streams text and tool progress as channel-neutral events."""

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


def test_reasoning_blocks_become_reasoning_events() -> None:
    token = AIMessageChunk(
        content=[{"type": "reasoning", "reasoning": "think"}, {"type": "text", "text": "hi"}]
    )

    assert list(_token_events(token, (), False, {})) == [ReasoningDelta("think"), TextDelta("hi")]


def test_subagent_text_stays_out_of_the_answer() -> None:
    token = AIMessageChunk(content="inner notes")

    assert list(_token_events(token, ("tools:abc",), True, {})) == []
