"""Research mode: a lead agent that sends web research workers in parallel.

A turn can ask for research. The lead then follows the deep-research skill.
It plans, calls ``task`` with ``research-agent`` for each part of the
question, and writes one report from what the workers found. Workers can
only search and read public pages, and each one has a hard tool budget.
"""

from collections.abc import Callable, Sequence
from contextvars import ContextVar
from datetime import date
from typing import Any

from deepagents import SubAgent
from langchain.agents.middleware import AgentMiddleware, ToolCallLimitMiddleware
from langchain_core.messages import SystemMessage
from langchain_core.tools import BaseTool

from patchai.config.models import Settings
from patchai.model_choice import RequestedModel

RESEARCH_AGENT = "research-agent"
SEARCH_TOOL = "search_web"
READ_TOOL = "read_web_page"
WORKER_SEARCH_LIMIT = 6
WORKER_READ_LIMIT = 8
LEAD_TASK_LIMIT = 6

requested_research: ContextVar[bool] = ContextVar("requested_research", default=False)

RESEARCH_BRIEF = (
    "Research mode is on for this turn. Read /skills/deep-research/SKILL.md "
    "and follow it. Classify the question, plan with write_todos, and send "
    f"the web work to the {RESEARCH_AGENT} subagent with the task tool. A "
    "question about several separate items gets one worker per item; a "
    "question about one topic gets one worker per angle. Send every task of "
    "a round in the same reply so the workers run at the same time. Use at "
    "most three workers per round and at most two rounds. Do not search the "
    "web yourself. Then write one report. Cite each claim with a numbered "
    "link right after it, the number as the link text and the full URL of a "
    "page a worker read as the target, for example: Rust 1.95 shipped on "
    "30 October [1](https://blog.rust-lang.org/2026/10/30/Rust-1.95.0/). "
    "Number URLs 1, 2, 3 by first use and reuse a number for the same URL. "
    "Do not use words as link text and do not add a list of sources."
)

NO_SEARCH_BRIEF = (
    "Research mode is on for this turn, but web search is not available. "
    "Say so, and answer only from what you already know or the user gave you."
)

RESEARCHER_PROMPT = """You are a research worker. The lead agent gave you one \
part of a larger question. Find the facts for that part on the public web and \
report them back. The lead writes the final report, not you.

How to work:
1. Read the assignment. Note the objective, the time range, and what is out of scope.
2. Start with a short, broad search_web query. Narrow it after you see what exists.
3. After each result, decide: what did I learn, what is still missing, is it enough?
4. Prefer primary and official sources: the organisation itself, a government \
page, the project's own release notes, a peer-reviewed paper. Avoid content farms.
5. Call read_web_page on every page you will cite. A search snippet is not evidence.
6. Stop when you have about three good pages, or when the last two searches \
repeat what you already have. Your tools have a hard budget.

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


def research_subagent(tools: Sequence[Any], settings: Settings) -> SubAgent | None:
    """The ``research-agent`` worker, or ``None`` when web search is off."""
    worker_tools = research_tools(tools)
    if not worker_tools:
        return None
    return {
        "name": RESEARCH_AGENT,
        "description": (
            "Researches one part of a question on the public web and returns "
            "findings with the URL of each page it read. Give it one topic per "
            "call. Say the objective, the time range, what is out of scope, and "
            "what another worker already covers."
        ),
        "system_prompt": RESEARCHER_PROMPT,
        "tools": worker_tools,
        "middleware": [
            RequestedModel(settings),
            TodayDate(),
            ToolCallLimitMiddleware(tool_name=SEARCH_TOOL, run_limit=WORKER_SEARCH_LIMIT),
            ToolCallLimitMiddleware(tool_name=READ_TOOL, run_limit=WORKER_READ_LIMIT),
        ],
    }


def lead_limits() -> list[AgentMiddleware]:
    """Cap the lead at two rounds of three workers in one turn."""
    return [ToolCallLimitMiddleware(tool_name="task", run_limit=LEAD_TASK_LIMIT)]


def today_line(today: date | None = None) -> str:
    """The date line that keeps searches on the current year."""
    current = today or date.today()
    return f"Today is {current.isoformat()}."


class TodayDate(AgentMiddleware):
    """Add today's date to every model call of a research worker."""

    def __init__(self, clock: Callable[[], date] = date.today) -> None:
        self._clock = clock

    def wrap_model_call(self, request, handler):
        return handler(_append(request, today_line(self._clock())))

    async def awrap_model_call(self, request, handler):
        return await handler(_append(request, today_line(self._clock())))


class ResearchMode(AgentMiddleware):
    """Give the lead the research brief and the date while research is on."""

    def __init__(self, can_search: bool, clock: Callable[[], date] = date.today) -> None:
        self._brief = RESEARCH_BRIEF if can_search else NO_SEARCH_BRIEF
        self._clock = clock

    def wrap_model_call(self, request, handler):
        return handler(self._request(request))

    async def awrap_model_call(self, request, handler):
        return await handler(self._request(request))

    def _request(self, request):
        if not requested_research.get():
            return request
        return _append(request, f"{self._brief} {today_line(self._clock())}")


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
