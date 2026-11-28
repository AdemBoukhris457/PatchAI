"""Research mode: a lead agent that sends web research workers in parallel.

A turn can ask for research at a depth. The lead then follows the
deep-research skill. It plans, calls ``research_round`` with one assignment
per part of the question, and writes one report from what the workers
found. A round starts every worker at once in code, so the workers run in
parallel whatever the model would have done. Workers can only search and
read public pages. The depth sets how many workers a round may start, how
many rounds the lead may run, and each worker's hard tool budget.
"""

import asyncio
import contextvars
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, ToolCallLimitMiddleware
from langchain.tools import ToolRuntime
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import Runnable, RunnableConfig
from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel, Field

from patchai.config.models import Settings
from patchai.model_choice import RequestedModel

RESEARCH_AGENT = "research-agent"
ROUND_TOOL = "research_round"
WORKER_EVENT = "patchai.worker"
SEARCH_TOOL = "search_web"
READ_TOOL = "read_web_page"
_WORKER_STEPS = 200


@dataclass(frozen=True)
class Depth:
    """How far one research turn may go."""

    name: str
    workers: int
    rounds: int
    min_rounds: int
    searches: int
    reads: int
    pages: int

    @property
    def tasks(self) -> int:
        """The most workers the lead may send in the turn."""
        return self.workers * self.rounds


DEPTHS = {
    "standard": Depth(
        "standard", workers=3, rounds=2, min_rounds=1, searches=6, reads=8, pages=3
    ),
    "deep": Depth("deep", workers=4, rounds=3, min_rounds=2, searches=10, reads=15, pages=6),
    "max": Depth("max", workers=5, rounds=4, min_rounds=3, searches=15, reads=20, pages=10),
}
STANDARD = DEPTHS["standard"]

requested_research: ContextVar[str | None] = ContextVar("requested_research", default=None)


def current_depth() -> Depth:
    """The depth this turn asked for, or standard when it asked for none."""
    return DEPTHS.get(requested_research.get() or "", STANDARD)


def research_brief(depth: Depth, workflow: str | None = None) -> str:
    """The lead's instructions for one research turn at ``depth``.

    ``workflow`` is the deep-research skill's text. When it is given, the
    lead has it already and starts planning on its first reply.
    """
    guide = (
        "The deep-research workflow is below, so plan right away."
        if workflow
        else "Read /skills/deep-research/SKILL.md and follow it."
    )
    if depth.min_rounds > 1:
        rounds = (
            f"Run at least {depth.min_rounds} rounds and at most {depth.rounds}. "
            f"Send all {depth.workers} workers in the first round. A question "
            "that asks for one narrow fact may stop after one round."
        )
    else:
        rounds = f"Run at most {depth.rounds} rounds."
    later = (
        " Use the rounds after the first to fill gaps, check figures that "
        "disagree, and follow leads the workers raised."
        if depth.rounds > 2
        else ""
    )
    brief = (
        f"Research mode is on for this turn at {depth.name} depth. {guide} "
        "Take today's date from the date line below. Classify the question, "
        "then in one reply call write_todos with the plan and call "
        f"{ROUND_TOOL} with one assignment per worker. The round starts every "
        "worker at once and returns all their findings together. Mark every "
        "part of the round in_progress together. A question about several "
        "separate items gets one worker per item; a question about one topic "
        f"gets one worker per angle. Give a round at most {depth.workers} "
        f"assignments. {rounds}{later} Do not search the web yourself. Then "
        "write one report. Cite each claim "
        "with a numbered link right after it, the number as the link text and "
        "the full URL of a page a worker read as the target, for example: Rust "
        "1.95 shipped on 30 October "
        "[1](https://blog.rust-lang.org/2026/10/30/Rust-1.95.0/). Number URLs "
        "1, 2, 3 by first use and reuse a number for the same URL. Do not use "
        "words as link text and do not add a list of sources."
    )
    return f"{brief}\n\n{workflow}" if workflow else brief


def worker_budget(depth: Depth) -> str:
    """The budget line a research worker sees on every model call."""
    return (
        f"Your budget for this assignment: {depth.searches} searches and "
        f"{depth.reads} page reads. Read at least {depth.pages} good pages "
        "unless the topic has fewer."
    )


def skill_workflow(root: Path) -> str | None:
    """The deep-research skill under ``root`` without its front matter."""
    path = root / "skills" / "deep-research" / "SKILL.md"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    if text.startswith("---"):
        _, _, rest = text[3:].partition("\n---")
        text = rest
    body = text.strip()
    return body or None

NO_SEARCH_BRIEF = (
    "Research mode is on for this turn, but web search is not available. "
    "Say so, and answer only from what you already know or the user gave you."
)

RESEARCHER_PROMPT = """You are a research worker. The lead agent gave you one \
part of a larger question. Find the facts for that part on the public web and \
report them back. The lead writes the final report, not you.

How to work:
1. Read the assignment. Note the objective, the time range, and what is out of scope.
2. Work in batches. Tool calls in one reply run at the same time, so put \
several in each reply. Your first reply sends 2 or 3 search_web calls: one \
short, broad query and one or two from other angles. Write plain keyword \
queries and put a site's name in as a word, such as "Go 1.27 release notes \
go.dev"; a site: filter makes a search several times slower.
3. From all the results, pick the 3 or 4 most promising pages and read them \
with read_web_page calls in one reply.
4. Decide what you learned and what is still missing. Then send the next \
batch: narrower searches, or reads of pages you already found.
5. Prefer primary and official sources: the organisation itself, a government \
page, the project's own release notes, a peer-reviewed paper. Avoid content farms.
6. Call read_web_page on every page you will cite. A search snippet is not evidence.
7. Stop when you have the pages your budget line asks for, or when the last \
two searches repeat what you already have. Your tools have a hard budget.

Report back in this shape, in plain text:
Findings:
- <one claim> | "<short quote or figure from the page>" | <page title> | <url>
Conflicts: <claims that disagree between pages, or "none">
Open questions: <what you could not find, or "none">

Only list a URL you read with read_web_page. Do not invent a date, number, or \
quote the page did not give you. Do not write a report or an introduction."""


def research_tools(tools: Sequence[Any]) -> list[Any]:
    """The search and read tools from ``tools``, or nothing when either is missing."""
    found = {_tool_name(tool): tool for tool in tools}
    if SEARCH_TOOL not in found or READ_TOOL not in found:
        return []
    return [found[SEARCH_TOOL], found[READ_TOOL]]


def worker_middleware(settings: Settings) -> list[AgentMiddleware]:
    """The model choice, date, and hard tool budget of every research worker."""
    return [
        RequestedModel(settings),
        TodayDate(),
        DepthLimit(SEARCH_TOOL, lambda depth: depth.searches),
        DepthLimit(READ_TOOL, lambda depth: depth.reads),
    ]


def research_worker(
    tools: Sequence[Any], settings: Settings, model: Any
) -> Runnable | None:
    """The ``research-agent`` graph, or ``None`` when web search is off."""
    worker_tools = research_tools(tools)
    if not worker_tools:
        return None
    return create_agent(
        model,
        system_prompt=RESEARCHER_PROMPT,
        tools=worker_tools,
        middleware=worker_middleware(settings),
        name=RESEARCH_AGENT,
    )


class _RoundInput(BaseModel):
    assignments: list[str] = Field(
        description=(
            "One assignment per worker. Each says the objective in one "
            "sentence, the time range, what is out of scope, and what another "
            "worker already covers."
        )
    )


ROUND_DESCRIPTION = (
    "Start one research round: every assignment goes to its own web research "
    "worker, and all the workers run at the same time. Each worker searches "
    "and reads public pages for its part and returns findings with the URL of "
    "each page it read. The reply holds every worker's findings, in the order "
    "of the assignments."
)


def research_round_tool(worker: Runnable) -> BaseTool:
    """The lead's tool that starts every assignment of a round at once."""

    def run(assignments: list[str], runtime: ToolRuntime) -> str:
        jobs = _jobs(assignments, runtime)
        if isinstance(jobs, str):
            return jobs
        with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
            futures = [
                pool.submit(contextvars.copy_context().run, _work, worker, job, runtime)
                for job in jobs
            ]
            return _round_reply([future.result() for future in futures], jobs, assignments)

    async def arun(assignments: list[str], runtime: ToolRuntime) -> str:
        jobs = _jobs(assignments, runtime)
        if isinstance(jobs, str):
            return jobs
        found = await asyncio.gather(*(_awork(worker, job, runtime) for job in jobs))
        return _round_reply(list(found), jobs, assignments)

    return StructuredTool.from_function(
        name=ROUND_TOOL,
        func=run,
        coroutine=arun,
        description=ROUND_DESCRIPTION,
        infer_schema=False,
        args_schema=_RoundInput,
    )


def lead_limits() -> list[AgentMiddleware]:
    """Cap how many rounds the lead runs in one turn at the turn's depth."""
    return [DepthLimit(ROUND_TOOL, lambda depth: depth.rounds)]


@dataclass(frozen=True)
class _Job:
    id: str
    assignment: str


def _jobs(assignments: list[str], runtime: ToolRuntime) -> list[_Job] | str:
    cleaned = [text.strip() for text in assignments if isinstance(text, str) and text.strip()]
    if not cleaned:
        return "A round needs at least one assignment."
    allowed = cleaned[: current_depth().workers]
    base = runtime.tool_call_id or ROUND_TOOL
    return [_Job(f"{base}-{index}", text) for index, text in enumerate(allowed, start=1)]


def _worker_config(runtime: ToolRuntime) -> RunnableConfig:
    configurable = dict((runtime.config or {}).get("configurable", {}))
    configurable["ls_agent_type"] = "subagent"
    return {"configurable": configurable, "recursion_limit": _WORKER_STEPS}


def _work(worker: Runnable, job: _Job, runtime: ToolRuntime) -> tuple[str, bool]:
    _announce(runtime, job)
    try:
        result = worker.invoke(_worker_input(job), _worker_config(runtime))
    except Exception as exc:  # noqa: BLE001
        return _finish(runtime, job, f"The worker stopped: {exc}", error=True)
    return _finish(runtime, job, _findings(result), error=False)


async def _awork(worker: Runnable, job: _Job, runtime: ToolRuntime) -> tuple[str, bool]:
    _announce(runtime, job)
    try:
        result = await worker.ainvoke(_worker_input(job), _worker_config(runtime))
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        return _finish(runtime, job, f"The worker stopped: {exc}", error=True)
    return _finish(runtime, job, _findings(result), error=False)


def _worker_input(job: _Job) -> dict[str, Any]:
    return {"messages": [HumanMessage(content=job.assignment)]}


def _findings(result: Any) -> str:
    messages = result.get("messages") if isinstance(result, dict) else None
    if not messages:
        return "The worker returned nothing."
    text = getattr(messages[-1], "text", "")
    return text.strip() if isinstance(text, str) and text.strip() else "The worker returned nothing."


def _announce(runtime: ToolRuntime, job: _Job) -> None:
    _emit(runtime, {"type": WORKER_EVENT, "id": job.id, "description": job.assignment})


def _finish(runtime: ToolRuntime, job: _Job, output: str, *, error: bool) -> tuple[str, bool]:
    _emit(runtime, {"type": WORKER_EVENT, "id": job.id, "output": output, "error": error})
    return output, error


def _emit(runtime: ToolRuntime, event: dict[str, Any]) -> None:
    writer = getattr(runtime, "stream_writer", None)
    if callable(writer):
        writer(event)


def _round_reply(
    found: list[tuple[str, bool]], jobs: list[_Job], assignments: list[str]
) -> str:
    blocks = [
        f"## Worker {index}: {_first_line(job.assignment)}\n{output}"
        for index, ((output, _error), job) in enumerate(zip(found, jobs), start=1)
    ]
    asked = [text for text in assignments if isinstance(text, str) and text.strip()]
    skipped = len(asked) - len(jobs)
    if skipped > 0:
        blocks.append(
            f"{skipped} assignment(s) did not run: this depth starts at most "
            f"{current_depth().workers} workers per round."
        )
    return "\n\n".join(blocks)


def _first_line(text: str) -> str:
    line = text.strip().splitlines()[0] if text.strip() else ""
    return line if len(line) <= 120 else f"{line[:120].rstrip()}…"


class DepthLimit(ToolCallLimitMiddleware):
    """A per-run limit on one tool that follows the depth of the current turn."""

    def __init__(self, tool_name: str, limit: Callable[[Depth], int]) -> None:
        self._limit = limit
        super().__init__(tool_name=tool_name, run_limit=limit(STANDARD))

    @property
    def run_limit(self) -> int:
        return self._limit(current_depth())

    @run_limit.setter
    def run_limit(self, _value: int | None) -> None:
        return


def today_line(today: date | None = None) -> str:
    """The date line that keeps searches on the current year."""
    current = today or date.today()
    return f"Today is {current.isoformat()}."


class TodayDate(AgentMiddleware):
    """Add the budget and today's date to every model call of a research worker."""

    def __init__(self, clock: Callable[[], date] = date.today) -> None:
        self._clock = clock

    def wrap_model_call(self, request, handler):
        return handler(self._request(request))

    async def awrap_model_call(self, request, handler):
        return await handler(self._request(request))

    def _request(self, request):
        return _append(request, f"{worker_budget(current_depth())} {today_line(self._clock())}")


class ResearchMode(AgentMiddleware):
    """Give the lead the research brief and the date while research is on."""

    def __init__(
        self,
        can_search: bool,
        workflow: str | None = None,
        clock: Callable[[], date] = date.today,
    ) -> None:
        self._can_search = can_search
        self._workflow = workflow
        self._clock = clock

    def wrap_model_call(self, request, handler):
        return handler(self._request(request))

    async def awrap_model_call(self, request, handler):
        return await handler(self._request(request))

    def _request(self, request):
        if requested_research.get() is None:
            return request
        if not self._can_search:
            return _append(request, f"{NO_SEARCH_BRIEF} {today_line(self._clock())}")
        brief = research_brief(current_depth(), self._workflow)
        return _append(request, f"{brief}\n\n{today_line(self._clock())}")


def _append(request, text: str):
    message = request.system_message
    if message is None:
        return request.override(system_message=SystemMessage(content=text))
    content = message.content
    if isinstance(content, list):
        blocks = [*content, {"type": "text", "text": f"\n\n{text}"}]
        return request.override(system_message=SystemMessage(content=blocks))
    joined = f"{content}\n\n{text}" if content else text
    return request.override(system_message=SystemMessage(content=joined))


def _tool_name(tool: object) -> str:
    if isinstance(tool, BaseTool):
        return tool.name
    return getattr(tool, "__name__", "")
