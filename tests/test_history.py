"""A thread keeps its own message history across turns."""

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from langgraph.graph.state import CompiledStateGraph

from patchai.config.models import Settings
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


def _user_texts(agent: CompiledStateGraph, thread_id: str) -> list[str]:
    state = agent.get_state({"configurable": {"thread_id": thread_id}})
    texts: list[str] = []
    for message in state.values["messages"]:
        content = getattr(message, "content", "")
        if getattr(message, "type", "") == "human" and isinstance(content, str):
            texts.append(content)
    return texts


def test_same_thread_keeps_both_turns_and_another_thread_does_not() -> None:
    agent = build_agent(_settings(), model=_model("ack-1", "ack-2", "ack-other"))
    cli = {"configurable": {"thread_id": "cli"}}
    other = {"configurable": {"thread_id": "other"}}

    agent.invoke({"messages": [{"role": "user", "content": "My name is Bob."}]}, cli)
    agent.invoke({"messages": [{"role": "user", "content": "What is my name?"}]}, cli)
    agent.invoke({"messages": [{"role": "user", "content": "hello other"}]}, other)

    assert _user_texts(agent, "cli") == ["My name is Bob.", "What is my name?"]
    assert _user_texts(agent, "other") == ["hello other"]
