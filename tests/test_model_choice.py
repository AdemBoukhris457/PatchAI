"""A chosen chat model replaces the model call for that turn."""

from langchain.agents.middleware import ModelRequest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from patchai.config.models import Settings
from patchai.model_choice import RequestedModel, requested_effort, requested_model


def test_a_named_model_replaces_the_request() -> None:
    settings = Settings(
        channel="web",
        model="openai:gpt-6-luna",
        plugins=(),
        mcp_config="mcp.json",
        model_options={"openai": {"use_responses_api": True}},
    )
    middleware = RequestedModel(settings)
    replacement = object()
    middleware._model = lambda model_id, effort: replacement  # type: ignore[method-assign]
    request = ModelRequest(
        model=GenericFakeChatModel(messages=iter([AIMessage(content="hello")])),
        messages=[],
    )
    token = requested_model.set("gpt-6.2-sol")
    try:
        chosen = middleware.wrap_model_call(request, lambda current: current)
    finally:
        requested_model.reset(token)

    assert chosen.model is replacement


def test_an_unnamed_turn_keeps_the_built_model() -> None:
    settings = Settings(
        channel="web",
        model="openai:gpt-6-luna",
        plugins=(),
        mcp_config="mcp.json",
    )
    middleware = RequestedModel(settings)
    original = GenericFakeChatModel(messages=iter([AIMessage(content="hello")]))
    request = ModelRequest(model=original, messages=[])

    kept = middleware.wrap_model_call(request, lambda current: current)

    assert kept.model is original


def test_a_chosen_effort_is_sent_with_the_model(monkeypatch) -> None:
    seen: dict[str, object] = {}

    def fake_model(name: str, **options: object) -> object:
        seen["name"] = name
        seen["options"] = options
        return object()

    monkeypatch.setattr("patchai.model_choice.init_chat_model", fake_model)
    settings = Settings(
        channel="web",
        model="openai:gpt-6-luna",
        plugins=(),
        mcp_config="mcp.json",
        model_options={"openai": {"use_responses_api": True, "reasoning": {"summary": "auto"}}},
    )
    middleware = RequestedModel(settings)
    request = ModelRequest(
        model=GenericFakeChatModel(messages=iter([AIMessage(content="hello")])),
        messages=[],
    )
    model_token = requested_model.set("gpt-6-luna")
    effort_token = requested_effort.set("high")
    try:
        middleware.wrap_model_call(request, lambda current: current)
    finally:
        requested_effort.reset(effort_token)
        requested_model.reset(model_token)

    assert seen["name"] == "openai:gpt-6-luna"
    assert seen["options"] == {
        "use_responses_api": True,
        "reasoning": {"summary": "auto", "effort": "high"},
    }


def test_effort_applies_to_the_built_model(monkeypatch) -> None:
    seen: dict[str, object] = {}

    def fake_model(name: str, **options: object) -> object:
        seen["name"] = name
        seen["options"] = options
        return object()

    monkeypatch.setattr("patchai.model_choice.init_chat_model", fake_model)
    settings = Settings(
        channel="web",
        model="openai:gpt-6-luna",
        plugins=(),
        mcp_config="mcp.json",
        model_options={"openai": {"reasoning": {"summary": "auto"}}},
    )
    middleware = RequestedModel(settings)
    request = ModelRequest(
        model=GenericFakeChatModel(messages=iter([AIMessage(content="hello")])),
        messages=[],
    )
    token = requested_effort.set("max")
    try:
        middleware.wrap_model_call(request, lambda current: current)
    finally:
        requested_effort.reset(token)

    assert seen["name"] == "openai:gpt-6-luna"
    assert seen["options"] == {"reasoning": {"summary": "auto", "effort": "max"}}
