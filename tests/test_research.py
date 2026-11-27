"""Research mode sends web work to a bounded research worker."""

from datetime import date
from pathlib import Path

from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, SystemMessage

from patchai import harness
from patchai.config.models import Settings
from patchai.harness import build_agent
from patchai.model_choice import RequestedModel
from patchai.plugins import web_search
from patchai.research import (
    RESEARCH_AGENT,
    ResearchMode,
    TodayDate,
    lead_limits,
    requested_research,
    research_subagent,
)

ROOT = Path(__file__).parents[1]


def _settings(plugins: tuple[str, ...] = ("example_clock", "web_search")) -> Settings:
    return Settings(channel="cli", model="ollama:llama3.1", plugins=plugins, mcp_config="mcp.json")


def _clock() -> str:
    return "12:00"


class _Request:
    def __init__(self, system_message: SystemMessage | None) -> None:
        self.system_message = system_message

    @property
    def system_prompt(self) -> str | None:
        return None if self.system_message is None else self.system_message.text

    def override(self, **changes: object) -> "_Request":
        message = changes["system_message"]
        assert isinstance(message, SystemMessage)
        return _Request(message)


def _prompt_seen(middleware, request: _Request) -> str:
    seen: list[str] = []

    def handler(final: _Request) -> str:
        seen.append(final.system_prompt or "")
        return "done"

    middleware.wrap_model_call(request, handler)
    return seen[0]


def _limits(middleware: list[object]) -> dict[str | None, int | None]:
    return {
        item.tool_name: item.run_limit
        for item in middleware
        if isinstance(item, ToolCallLimitMiddleware)
    }


def test_the_worker_only_searches_and_reads_within_a_budget() -> None:
    worker = research_subagent(
        [_clock, web_search.read_web_page, web_search.search_web], _settings()
    )

    assert worker is not None
    assert worker["name"] == RESEARCH_AGENT
    assert worker["tools"] == [web_search.search_web, web_search.read_web_page]
    middleware = list(worker["middleware"])
    assert any(isinstance(item, RequestedModel) for item in middleware)
    assert any(isinstance(item, TodayDate) for item in middleware)
    assert _limits(middleware) == {"search_web": 6, "read_web_page": 8}
    assert "read_web_page on every page you will cite" in worker["system_prompt"]


def test_there_is_no_worker_without_web_search() -> None:
    assert research_subagent([_clock, web_search.search_web], _settings()) is None
    assert research_subagent([_clock], _settings()) is None


def test_the_lead_sends_at_most_six_workers_in_a_turn() -> None:
    assert _limits(lead_limits()) == {"task": 6}


def test_research_mode_adds_the_brief_and_date_only_while_it_is_on() -> None:
    mode = ResearchMode(can_search=True, clock=lambda: date(2026, 11, 27))
    request = _Request(SystemMessage(content="Base prompt."))

    assert _prompt_seen(mode, request) == "Base prompt."

    token = requested_research.set(True)
    try:
        prompt = _prompt_seen(mode, request)
    finally:
        requested_research.reset(token)

    assert prompt.startswith("Base prompt.\n\n")
    assert "/skills/deep-research/SKILL.md" in prompt
    assert RESEARCH_AGENT in prompt
    assert "Today is 2026-11-27." in prompt


def test_research_mode_says_so_when_search_is_off() -> None:
    mode = ResearchMode(can_search=False, clock=lambda: date(2026, 11, 27))
    token = requested_research.set(True)
    try:
        prompt = _prompt_seen(mode, _Request(SystemMessage(content="Base prompt.")))
    finally:
        requested_research.reset(token)

    assert "web search is not available" in prompt
    assert RESEARCH_AGENT not in prompt


def test_the_worker_always_knows_the_date() -> None:
    today = TodayDate(clock=lambda: date(2026, 11, 27))
    blocks = SystemMessage(content=[{"type": "text", "text": "Worker prompt."}])

    prompt = _prompt_seen(today, _Request(blocks))

    assert prompt.startswith("Worker prompt.")
    assert prompt.endswith("Today is 2026-11-27.")


def test_the_harness_adds_the_worker_only_with_web_search(monkeypatch) -> None:
    calls: list[dict[str, object]] = []

    def capture(**kwargs: object) -> object:
        calls.append(kwargs)
        return object()

    monkeypatch.setattr(harness, "create_deep_agent", capture)
    fake = GenericFakeChatModel(messages=iter([]))

    build_agent(_settings(), model=fake, root=ROOT)
    build_agent(_settings(("example_clock",)), model=fake, root=ROOT)

    with_search, without = calls
    subagents = with_search["subagents"]
    assert isinstance(subagents, list)
    assert [agent["name"] for agent in subagents] == [RESEARCH_AGENT]
    assert without["subagents"] is None
    middleware = list(with_search["middleware"])
    assert any(isinstance(item, ResearchMode) for item in middleware)
    assert _limits(middleware) == {"task": 6}


def test_a_research_turn_reaches_the_model_with_the_brief() -> None:
    seen: list[str] = []

    class _RecordingModel(GenericFakeChatModel):
        def bind_tools(self, tools, *, tool_choice=None, **kwargs):  # noqa: ANN001, ANN003
            return self

        def _generate(self, messages, stop=None, run_manager=None, **kwargs):  # noqa: ANN001, ANN003
            seen.extend(
                message.text for message in messages if getattr(message, "type", "") == "system"
            )
            return super()._generate(messages, stop=stop, run_manager=run_manager, **kwargs)

    agent = build_agent(
        _settings(),
        model=_RecordingModel(messages=iter([AIMessage(content="ack"), AIMessage(content="ack")])),
        root=ROOT,
    )
    config = {"configurable": {"thread_id": "research"}}
    agent.invoke({"messages": [{"role": "user", "content": "plain"}]}, config=config)
    token = requested_research.set(True)
    try:
        agent.invoke({"messages": [{"role": "user", "content": "research"}]}, config=config)
    finally:
        requested_research.reset(token)

    plain, research = seen
    assert "Research mode is on" not in plain
    assert "Research mode is on" in research
    assert "deep-research" in research
