"""Build the Deep Agents harness from PatchAI settings.

``create_deep_agent`` owns the tool loop. This module supplies the model,
the tools from enabled plugins, and an in-memory checkpointer. Later turns
reuse a conversation by passing the same ``thread_id``.
"""

from deepagents import create_deep_agent
from langchain_core.language_models import BaseChatModel
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.state import CompiledStateGraph

from patchai.config.models import Settings
from patchai.plugins.registry import load_enabled

SYSTEM_PROMPT = (
    "You are PatchAI, a helpful assistant. "
    "Use the provided tools when they answer the user's request."
)


def build_agent(
    settings: Settings,
    *,
    model: BaseChatModel | None = None,
) -> CompiledStateGraph:
    """Create the agent for ``settings``.

    Pass ``model`` to supply an already constructed chat model. Otherwise the
    ``provider:model`` string in ``settings`` is resolved by Deep Agents.
    """
    tools = [tool for plugin in load_enabled(settings.plugins) for tool in plugin.tools()]
    return create_deep_agent(
        model=model if model is not None else settings.model,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
        checkpointer=InMemorySaver(),
        name="patchai",
    )
