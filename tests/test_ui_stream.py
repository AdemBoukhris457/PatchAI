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
async def test_a_failure_closes_the_block_and_reports_an_error() -> None:
    parts = await _parts([TextDelta("Half")], fail=True)

    assert parts[-3:] == [
        {"type": "text-end", "id": "text-1"},
        {"type": "error", "errorText": "PatchAI could not finish this reply."},
        {"type": "finish"},
    ]
