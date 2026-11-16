"""The terminal channel keeps one conversation and stops on a blank line."""

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from patchai.channels.cli import CliChannel
from patchai.config.models import Settings
from patchai.conversation import ask
from patchai.harness import build_agent


def _settings() -> Settings:
    return Settings(
        channel="cli",
        model="ollama:llama3.1",
        plugins=("example_clock",),
        mcp_config="mcp.json",
    )


def _model(*replies: str) -> GenericFakeChatModel:
    class _ToolBindingModel(GenericFakeChatModel):
        def bind_tools(self, tools, *, tool_choice=None, **kwargs):  # noqa: ANN001, ANN003
            return self

    return _ToolBindingModel(messages=iter(AIMessage(content=reply) for reply in replies))


@pytest.mark.asyncio
async def test_cli_prints_replies_and_stops_on_a_blank_line() -> None:
    lines = iter(["hello\n", "again\n", "\n", "ignored\n"])
    seen: list[tuple[str, str, str]] = []
    written: list[str] = []

    async def read_line() -> str | None:
        try:
            return next(lines)
        except StopIteration:
            return None

    async def handler(session_id: str, user_id: str, text: str) -> str:
        seen.append((session_id, user_id, text))
        return f"echo {text}"

    await CliChannel(read_line, written.append).serve(handler)

    assert seen == [("cli", "local", "hello"), ("cli", "local", "again")]
    assert written == ["echo hello", "echo again"]


@pytest.mark.asyncio
async def test_ask_appends_both_turns_to_the_cli_thread() -> None:
    agent = build_agent(_settings(), model=_model("ack-1", "ack-2"))

    assert await ask(agent, "cli", "My name is Bob.") == "ack-1"
    assert await ask(agent, "cli", "What is my name?") == "ack-2"

    state = agent.get_state({"configurable": {"thread_id": "cli"}})
    human = [message.content for message in state.values["messages"] if message.type == "human"]
    assert human == ["My name is Bob.", "What is my name?"]
