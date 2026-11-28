"""Research mode sends web work to bounded research workers in parallel rounds."""

import asyncio
from datetime import date
from pathlib import Path
from types import SimpleNamespace

from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, SystemMessage

from patchai import harness
from patchai.config.models import Settings
from patchai.harness import build_agent
from patchai.model_choice import RequestedModel
from patchai.plugins import web_search
from patchai.research import (
    DEPTHS,
    RESEARCHER_PROMPT,
    ROUND_TOOL,
    WORKER_EVENT,
    ResearchMode,
    TodayDate,
    lead_limits,
    requested_research,
    research_round_tool,
    research_tools,
    research_worker,
    skill_workflow,
    worker_middleware,
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
    tools = [_clock, web_search.read_web_page, web_search.search_web]
    middleware = worker_middleware(_settings())

    assert research_tools(tools) == [web_search.search_web, web_search.read_web_page]
    assert any(isinstance(item, RequestedModel) for item in middleware)
    assert any(isinstance(item, TodayDate) for item in middleware)
    assert _limits(middleware) == {"search_web": 6, "read_web_page": 8}
    assert "read_web_page on every page you will cite" in RESEARCHER_PROMPT
    assert "Tool calls in one reply run at the same time" in RESEARCHER_PROMPT


def test_there_is_no_worker_without_web_search() -> None:
    fake = GenericFakeChatModel(messages=iter([]))
    assert research_worker([_clock, web_search.search_web], _settings(), fake) is None
    assert research_worker([_clock], _settings(), fake) is None
    assert research_worker([web_search.search_web, web_search.read_web_page], _settings(), fake)


def test_the_lead_runs_at_most_two_rounds_in_a_turn() -> None:
    assert _limits(lead_limits()) == {ROUND_TOOL: 2}


def test_the_limits_follow_the_depth_of_the_turn() -> None:
    middleware = [*worker_middleware(_settings()), *lead_limits()]

    token = requested_research.set("max")
    try:
        deepest = _limits(middleware)
    finally:
        requested_research.reset(token)

    assert deepest == {"search_web": 15, "read_web_page": 20, ROUND_TOOL: 4}
    assert _limits(middleware) == {"search_web": 6, "read_web_page": 8, ROUND_TOOL: 2}
    assert DEPTHS["max"].tasks * DEPTHS["max"].searches == 300


class _Worker:
    """A worker that waits until every worker of the round has started."""

    def __init__(self, expected: int, fail_on: str | None = None) -> None:
        self.expected = expected
        self.fail_on = fail_on
        self.started: list[str] = []
        self.peak = 0
        self.running = 0
        self.all_started = asyncio.Event()

    async def ainvoke(self, state, config):  # noqa: ANN001
        assignment = state["messages"][0].content
        self.started.append(assignment)
        self.running += 1
        self.peak = max(self.peak, self.running)
        if len(self.started) >= self.expected:
            self.all_started.set()
        await asyncio.wait_for(self.all_started.wait(), 5)
        self.running -= 1
        if assignment == self.fail_on:
            raise RuntimeError("model unavailable")
        assert config["recursion_limit"] >= 100
        return {"messages": [AIMessage(content=f"Findings for {assignment}")]}


def _runtime(events: list[dict]) -> SimpleNamespace:
    return SimpleNamespace(
        config={"configurable": {"thread_id": "t"}},
        stream_writer=events.append,
        tool_call_id="call_round",
    )


async def _round(worker: _Worker, assignments: list[str], events: list[dict]) -> str:
    tool = research_round_tool(worker)  # type: ignore[arg-type]
    assert tool.name == ROUND_TOOL
    assert tool.coroutine is not None
    return await tool.coroutine(assignments=assignments, runtime=_runtime(events))


def test_a_round_starts_every_worker_at_once() -> None:
    worker = _Worker(expected=3)
    events: list[dict] = []

    reply = asyncio.run(_round(worker, ["Python", "Rust", "Go"], events))

    assert worker.peak == 3
    assert reply.index("## Worker 1: Python") < reply.index("## Worker 3: Go")
    assert "Findings for Rust" in reply
    starts = [event for event in events if "description" in event]
    finishes = [event for event in events if "output" in event]
    assert [event["id"] for event in starts] == ["call_round-1", "call_round-2", "call_round-3"]
    assert {event["type"] for event in events} == {WORKER_EVENT}
    assert sorted(event["output"] for event in finishes) == [
        "Findings for Go",
        "Findings for Python",
        "Findings for Rust",
    ]


def test_a_round_starts_only_the_workers_the_depth_allows() -> None:
    worker = _Worker(expected=3)
    events: list[dict] = []

    reply = asyncio.run(_round(worker, ["a", "b", " ", "c", "d"], events))

    assert worker.started == ["a", "b", "c"]
    assert "1 assignment(s) did not run" in reply
    assert asyncio.run(_round(_Worker(expected=1), ["  "], [])) == (
        "A round needs at least one assignment."
    )


def test_a_failed_worker_does_not_stop_the_round() -> None:
    worker = _Worker(expected=2, fail_on="Rust")
    events: list[dict] = []

    reply = asyncio.run(_round(worker, ["Python", "Rust"], events))

    assert "Findings for Python" in reply
    assert "The worker stopped: model unavailable" in reply
    failed = [event for event in events if event.get("error")]
    assert [event["id"] for event in failed] == ["call_round-2"]


def test_a_deeper_turn_gets_more_workers_and_rounds() -> None:
    mode = ResearchMode(can_search=True, clock=lambda: date(2026, 11, 27))
    token = requested_research.set("max")
    try:
        prompt = _prompt_seen(mode, _Request(SystemMessage(content="Base prompt.")))
    finally:
        requested_research.reset(token)

    assert "at max depth" in prompt
    assert "Give a round at most 5 assignments." in prompt
    assert "Run at least 3 rounds and at most 4." in prompt
    assert "Send all 5 workers in the first round." in prompt
    assert "follow leads the workers raised" in prompt


def test_a_deep_turn_runs_at_least_two_rounds() -> None:
    mode = ResearchMode(can_search=True, clock=lambda: date(2026, 11, 27))
    token = requested_research.set("deep")
    try:
        prompt = _prompt_seen(mode, _Request(SystemMessage(content="Base prompt.")))
    finally:
        requested_research.reset(token)

    assert "Run at least 2 rounds and at most 3." in prompt
    assert "Send all 4 workers in the first round." in prompt


def test_the_brief_carries_the_workflow_so_the_lead_plans_at_once() -> None:
    workflow = skill_workflow(ROOT)
    assert workflow is not None
    assert not workflow.startswith("---")
    assert workflow.startswith("# deep-research")

    mode = ResearchMode(can_search=True, workflow=workflow, clock=lambda: date(2026, 11, 27))
    token = requested_research.set("standard")
    try:
        prompt = _prompt_seen(mode, _Request(SystemMessage(content="Base prompt.")))
    finally:
        requested_research.reset(token)

    assert "The deep-research workflow is below, so plan right away." in prompt
    assert "/skills/deep-research/SKILL.md" not in prompt
    assert "## Steps" in prompt
    assert prompt.endswith("Today is 2026-11-27.")


def test_there_is_no_workflow_without_the_skill(tmp_path: Path) -> None:
    assert skill_workflow(tmp_path) is None


def test_research_mode_adds_the_brief_and_date_only_while_it_is_on() -> None:
    mode = ResearchMode(can_search=True, clock=lambda: date(2026, 11, 27))
    request = _Request(SystemMessage(content="Base prompt."))

    assert _prompt_seen(mode, request) == "Base prompt."

    token = requested_research.set("standard")
    try:
        prompt = _prompt_seen(mode, request)
    finally:
        requested_research.reset(token)

    assert prompt.startswith("Base prompt.\n\n")
    assert "/skills/deep-research/SKILL.md" in prompt
    assert "Give a round at most 3 assignments. Run at most 2 rounds." in prompt
    assert f"call write_todos with the plan and call {ROUND_TOOL}" in prompt
    assert "Run at least" not in prompt
    assert "follow leads" not in prompt
    assert "Today is 2026-11-27." in prompt


def test_research_mode_says_so_when_search_is_off() -> None:
    mode = ResearchMode(can_search=False, clock=lambda: date(2026, 11, 27))
    token = requested_research.set("standard")
    try:
        prompt = _prompt_seen(mode, _Request(SystemMessage(content="Base prompt.")))
    finally:
        requested_research.reset(token)

    assert "web search is not available" in prompt
    assert ROUND_TOOL not in prompt


def test_the_worker_always_knows_the_date_and_its_budget() -> None:
    today = TodayDate(clock=lambda: date(2026, 11, 27))
    blocks = SystemMessage(content=[{"type": "text", "text": "Worker prompt."}])

    prompt = _prompt_seen(today, _Request(blocks))
    token = requested_research.set("deep")
    try:
        deep = _prompt_seen(today, _Request(blocks))
    finally:
        requested_research.reset(token)

    assert prompt.startswith("Worker prompt.")
    assert prompt.endswith("Today is 2026-11-27.")
    assert "6 searches and 8 page reads" in prompt
    assert "10 searches and 15 page reads. Read at least 6 good pages" in deep


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
    assert "subagents" not in with_search
    assert ROUND_TOOL in [getattr(tool, "name", "") for tool in with_search["tools"]]
    assert ROUND_TOOL not in [getattr(tool, "name", "") for tool in without["tools"]]
    middleware = list(with_search["middleware"])
    assert any(isinstance(item, ResearchMode) for item in middleware)
    assert _limits(middleware) == {ROUND_TOOL: 2}


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
    token = requested_research.set("standard")
    try:
        agent.invoke({"messages": [{"role": "user", "content": "research"}]}, config=config)
    finally:
        requested_research.reset(token)

    plain, research = seen
    assert "Research mode is on" not in plain
    assert "Research mode is on" in research
    assert "The deep-research workflow is below" in research
    assert "## Steps" in research
