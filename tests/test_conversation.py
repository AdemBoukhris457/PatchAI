"""The reply stream keeps model text and drops tool-call chunks."""

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, AIMessageChunk

from patchai.config.models import Settings
from patchai.conversation import _assistant_text, stream_reply
from patchai.harness import build_agent


def test_assistant_text_keeps_text_blocks_and_skips_tool_calls() -> None:
    text = AIMessageChunk(
        content=[
            {"type": "reasoning", "text": "think"},
            {"type": "text", "text": "hi"},
        ]
    )
    tool = AIMessageChunk(
        content="nope",
        tool_call_chunks=[{"name": "current_time", "args": "", "id": "1", "index": 0}],
    )

    assert _assistant_text(text) == "hi"
    assert _assistant_text(tool) == ""
    assert _assistant_text(AIMessage(content="plain")) == "plain"


@pytest.mark.asyncio
async def test_stream_reply_yields_the_model_text() -> None:
    class _ToolBindingModel(GenericFakeChatModel):
        def bind_tools(self, tools, *, tool_choice=None, **kwargs):  # noqa: ANN001, ANN003
            return self

    agent = build_agent(
        Settings(
            channel="cli",
            model="ollama:llama3.1",
            plugins=(),
            mcp_config="mcp.json",
        ),
        model=_ToolBindingModel(messages=iter([AIMessage(content="ack-1")])),
    )

    pieces = [piece async for piece in stream_reply(agent, "thread", "hello")]

    assert pieces == ["ack-1"]
