"""Agent events become AI SDK UI message stream parts."""

import json
from collections.abc import AsyncIterator

import pytest

from patchai.channels.ui_stream import encode
from patchai.conversation import (
    Event,
    ReasoningDelta,
    TextDelta,
    ToolCalled,
    ToolFinished,
    ToolInputDelta,
    ToolStarted,
)


async def _parts(events: list[Event], fail: bool = False) -> list[object]:
    async def source() -> AsyncIterator[Event]:
        for event in events:
            yield event
        if fail:
            raise RuntimeError("model down")

    lines = [piece async for piece in encode(source())]
    assert lines[-1] == "data: [DONE]\n\n"
    assert all(line.startswith("data: ") and line.endswith("\n\n") for line in lines)
    return [json.loads(line[6:]) for line in lines[:-1]]


@pytest.mark.asyncio
async def test_text_around_a_tool_becomes_two_blocks() -> None:
    parts = await _parts([
        TextDelta("Checking."),
        ToolStarted("c1", "stock_quotes", False),
        ToolInputDelta("c1", '{"symbols"'),
        ToolCalled("c1", "stock_quotes", {"symbols": ["AAPL"]}, False),
        ToolFinished("c1", "AAPL 348.89", False),
        TextDelta("Apple is "),
        TextDelta("$348.89."),
    ])

    assert parts == [
        {"type": "start"},
        {"type": "text-start", "id": "text-1"},
        {"type": "text-delta", "id": "text-1", "delta": "Checking."},
        {"type": "text-end", "id": "text-1"},
        {"type": "tool-input-start", "toolCallId": "c1", "toolName": "stock_quotes", "dynamic": True},
        {"type": "tool-input-delta", "toolCallId": "c1", "inputTextDelta": '{"symbols"'},
        {
            "type": "tool-input-available",
            "toolCallId": "c1",
            "toolName": "stock_quotes",
            "input": {"symbols": ["AAPL"]},
            "dynamic": True,
        },
        {"type": "tool-output-available", "toolCallId": "c1", "output": "AAPL 348.89", "dynamic": True},
        {"type": "text-start", "id": "text-2"},
        {"type": "text-delta", "id": "text-2", "delta": "Apple is "},
        {"type": "text-delta", "id": "text-2", "delta": "$348.89."},
        {"type": "text-end", "id": "text-2"},
        {"type": "finish"},
    ]


@pytest.mark.asyncio
async def test_reasoning_errors_and_subagents_are_marked() -> None:
    parts = await _parts([
        ReasoningDelta("Need a quote."),
        ToolStarted("c2", "market_search", True),
        ToolFinished("c2", "Provider unavailable", True),
    ])

    assert parts[1:4] == [
        {"type": "reasoning-start", "id": "reasoning-1"},
        {"type": "reasoning-delta", "id": "reasoning-1", "delta": "Need a quote."},
        {"type": "reasoning-end", "id": "reasoning-1"},
    ]
    assert parts[4]["toolMetadata"] == {"subagent": True}
    assert parts[5] == {
        "type": "tool-output-error",
        "toolCallId": "c2",
        "errorText": "Provider unavailable",
        "dynamic": True,
    }


@pytest.mark.asyncio
async def test_pages_that_were_read_are_listed_once_after_the_answer() -> None:
    search = json.dumps({
        "query": "nobel",
        "results": [
            {
                "title": "Nobel Peace Prize 2026",
                "url": "https://www.nobelprize.org/prizes/peace/2026/press-release/",
                "snippet": "Navi Pillay",
            },
            {
                "title": "Unread hit",
                "url": "https://example.com/other",
                "snippet": "not opened",
            },
        ],
    })
    opened = "https://www.nobelprize.org/prizes/peace/2026/press-release/"
    page = json.dumps({"url": opened, "text": "Navi Pillay", "truncated": False})
    again = json.dumps({"url": opened.rstrip("/"), "text": "again", "truncated": False})
    second = json.dumps({
        "url": "https://www.un.org/sg/en",
        "text": "António Guterres",
        "truncated": False,
    })
    parts = await _parts([
        ToolStarted("s", "search_web", False),
        ToolCalled("s", "search_web", {"query": "nobel"}, False),
        ToolFinished("s", search, False),
        ToolStarted("r", "read_web_page", False),
        ToolFinished("r", page, False),
        ToolStarted("r2", "read_web_page", False),
        ToolFinished("r2", again, False),
        ToolStarted("bad", "read_web_page", False),
        ToolFinished("bad", "The page could not be read: HTTP 404", True),
        ToolStarted("u", "read_web_page", False),
        ToolFinished("u", second, False),
        TextDelta("Navi Pillay."),
    ])

    assert parts[-4:] == [
        {"type": "text-end", "id": "text-1"},
        {
            "type": "source-url",
            "sourceId": opened,
            "url": opened,
            "title": "Nobel Peace Prize 2026",
        },
        {
            "type": "source-url",
            "sourceId": "https://www.un.org/sg/en",
            "url": "https://www.un.org/sg/en",
            "title": "un.org",
        },
        {"type": "finish"},
    ]


@pytest.mark.asyncio
async def test_a_shortened_page_result_is_still_listed() -> None:
    full = json.dumps({
        "url": "https://www.gov.uk/government/people/andy-burnham",
        "text": "x" * 5000,
        "truncated": False,
    })
    clipped = f"{full[:4000]}…"
    parts = await _parts([
        ToolStarted("r", "read_web_page", False),
        ToolFinished("r", clipped, False),
        TextDelta("Andy Burnham."),
    ])

    assert parts[-2] == {
        "type": "source-url",
        "sourceId": "https://www.gov.uk/government/people/andy-burnham",
        "url": "https://www.gov.uk/government/people/andy-burnham",
        "title": "gov.uk",
    }


@pytest.mark.asyncio
async def test_a_read_page_is_still_listed_when_the_reply_fails() -> None:
    page = json.dumps({
        "url": "https://nodejs.org/en/download",
        "text": "v26.13.1",
        "truncated": False,
    })
    parts = await _parts([
        ToolStarted("r", "read_web_page", False),
        ToolFinished("r", page, False),
    ], fail=True)

    assert parts[-3:] == [
        {
            "type": "source-url",
            "sourceId": "https://nodejs.org/en/download",
            "url": "https://nodejs.org/en/download",
            "title": "nodejs.org",
        },
        {"type": "error", "errorText": "PatchAI could not finish this reply."},
        {"type": "finish"},
    ]


@pytest.mark.asyncio
async def test_a_failure_closes_the_block_and_reports_an_error() -> None:
    parts = await _parts([TextDelta("Half")], fail=True)

    assert parts[-3:] == [
        {"type": "text-end", "id": "text-1"},
        {"type": "error", "errorText": "PatchAI could not finish this reply."},
        {"type": "finish"},
    ]
