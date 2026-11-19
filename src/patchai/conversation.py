"""Send one user turn to an agent thread.

Token streaming follows LangGraph's ``messages`` mode: each event is
``(token, metadata)``. Only text from the main model node is returned.
Tool-call chunks and other nodes stay out of the reply.
"""

from collections.abc import AsyncIterator
from typing import Any

from langchain_core.messages import AIMessage


async def ask(agent: Any, thread_id: str, text: str) -> str:
    """Append ``text`` to ``thread_id`` and return the assistant's text."""
    parts = [piece async for piece in stream_reply(agent, thread_id, text)]
    return "".join(parts)


async def stream_reply(agent: Any, thread_id: str, text: str) -> AsyncIterator[str]:
    """Yield the assistant's text as the model produces it."""
    async for token, metadata in agent.astream(
        {"messages": [{"role": "user", "content": text}]},
        {"configurable": {"thread_id": thread_id}},
        stream_mode="messages",
    ):
        if not isinstance(metadata, dict) or metadata.get("langgraph_node") != "model":
            continue
        piece = _assistant_text(token)
        if piece:
            yield piece


def _assistant_text(token: object) -> str:
    if not isinstance(token, AIMessage) or getattr(token, "tool_call_chunks", None):
        return ""
    content = token.content
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if isinstance(block, str):
            parts.append(block)
        elif isinstance(block, dict) and block.get("type") == "text":
            text = block.get("text", "")
            if isinstance(text, str):
                parts.append(text)
    return "".join(parts)
