"""A thread keeps its own message history across turns."""

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from langgraph.graph.state import CompiledStateGraph

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


@pytest.mark.asyncio
async def test_an_edit_forks_from_the_checkpoint_before_that_turn() -> None:
    agent = build_agent(_settings(), model=_model("ack-1", "ack-2", "ack-3"))
    await ask(agent, "edit", "My name is Bob.")
    await ask(agent, "edit", "What is my name?")

    await ask(
        agent,
        "edit",
        "My name is Ana.",
        prior=[("user", "My name is Bob."), ("assistant", "ack-1")],
    )

    assert _user_texts(agent, "edit") == ["My name is Bob.", "My name is Ana."]
    assert _branch_has_users(agent, "edit", ["My name is Bob.", "What is my name?"])


@pytest.mark.asyncio
async def test_editing_the_first_message_starts_again_from_the_empty_checkpoint() -> None:
    agent = build_agent(_settings(), model=_model("ack-1", "ack-2"))
    await ask(agent, "edit", "My name is Bob.")

    await ask(agent, "edit", "My name is Ana.", prior=[])

    assert _user_texts(agent, "edit") == ["My name is Ana."]
    assert _branch_has_users(agent, "edit", ["My name is Bob."])


@pytest.mark.asyncio
async def test_a_later_turn_still_appends_when_the_page_kept_the_whole_thread() -> None:
    agent = build_agent(_settings(), model=_model("ack-1", "ack-2", "ack-3"))
    await ask(agent, "edit", "My name is Bob.")
    await ask(agent, "edit", "What is my name?")

    await ask(
        agent,
        "edit",
        "And now?",
        prior=[
            ("user", "My name is Bob."),
            ("assistant", "ack-1"),
            ("user", "What is my name?"),
            ("assistant", "ack-2"),
        ],
    )

    assert _user_texts(agent, "edit") == [
        "My name is Bob.",
        "What is my name?",
        "And now?",
    ]


@pytest.mark.asyncio
async def test_a_restarted_thread_is_rebuilt_from_the_page() -> None:
    agent = build_agent(_settings(), model=_model("ack-1"))

    await ask(
        agent,
        "fresh",
        "What is my name?",
        prior=[("user", "My name is Bob."), ("assistant", "Hi Bob.")],
    )

    assert _user_texts(agent, "fresh") == ["My name is Bob.", "What is my name?"]


def _branch_has_users(agent: CompiledStateGraph, thread_id: str, texts: list[str]) -> bool:
    config = {"configurable": {"thread_id": thread_id}}
    for state in agent.get_state_history(config):
        found = [
            message.content
            for message in state.values.get("messages") or []
            if getattr(message, "type", "") == "human" and isinstance(message.content, str)
        ]
        if found == texts:
            return True
    return False
