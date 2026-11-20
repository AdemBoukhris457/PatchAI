"""The harness builds a Deep Agent without calling a model provider."""

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

from patchai.config.models import Settings
from patchai.harness import build_agent, chat_model


def _settings(model: str, **options: dict[str, object]) -> Settings:
    return Settings(
        channel="cli", model=model, plugins=(), mcp_config="mcp.json", model_options=options
    )


def test_a_model_without_options_stays_a_string() -> None:
    settings = _settings("openai:gpt-6-luna", ollama={"temperature": 0})

    assert chat_model(settings) == "openai:gpt-6-luna"


def test_options_for_the_model_provider_build_the_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    settings = _settings(
        "openai:gpt-6-luna",
        openai={"use_responses_api": True, "reasoning": {"summary": "auto"}},
    )

    model = chat_model(settings)

    assert isinstance(model, ChatOpenAI)
    assert model.model_name == "gpt-6-luna"
    assert model.reasoning == {"summary": "auto"}


def test_build_agent_binds_plugin_tools_and_replies() -> None:
    settings = Settings(
        channel="cli",
        model="ollama:llama3.1",
        plugins=("example_clock",),
        mcp_config="mcp.json",
    )
    bound_tool_names: list[str] = []

    class _RecordingModel(GenericFakeChatModel):
        """Fake model that records the tools the harness binds."""

        def bind_tools(self, tools, *, tool_choice=None, **kwargs):  # noqa: ANN001, ANN003
            bound_tool_names.extend(getattr(tool, "name", "") for tool in tools)
            return self

    @tool
    def premium(age: int) -> str:
        """Return a sample yearly premium."""
        return str(age)

    agent = build_agent(
        settings,
        model=_RecordingModel(messages=iter([AIMessage(content="hello from patchai")])),
        mcp_tools=[premium],
    )

    result = agent.invoke(
        {"messages": [{"role": "user", "content": "hello"}]},
        config={"configurable": {"thread_id": "test-thread"}},
    )

    assert "current_time" in bound_tool_names
    assert "premium" in bound_tool_names
    assert result["messages"][-1].content == "hello from patchai"
