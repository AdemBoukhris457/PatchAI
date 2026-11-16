"""Send one user turn to an agent thread and return the text reply."""

from typing import Any


async def ask(agent: Any, thread_id: str, text: str) -> str:
    """Append ``text`` to ``thread_id`` and return the assistant's text."""
    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": text}]},
        {"configurable": {"thread_id": thread_id}},
    )
    content = result["messages"][-1].content
    if not isinstance(content, str):
        raise TypeError("The agent reply must be text.")
    return content
