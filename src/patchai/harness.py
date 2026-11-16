"""Build the Deep Agents harness from PatchAI settings.

``create_deep_agent`` owns the tool loop, summarization, and subagents.
This module supplies the model, the plugin tools, and the input context
the documentation keeps in separate layers: a short role prompt, always-on
project memory, on-demand skills, and a store for preferences that should
outlive one conversation thread.
"""

from pathlib import Path

from deepagents import FilesystemPermission, create_deep_agent
from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend, StoreBackend
from langchain_core.language_models import BaseChatModel
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.state import CompiledStateGraph
from langgraph.store.memory import InMemoryStore

from patchai.config.models import Settings
from patchai.plugins.registry import load_enabled

SYSTEM_PROMPT = (
    "You are PatchAI, a helpful assistant. "
    "When a user tells you a preference to remember, save it in "
    "/memories/preferences.txt so a later conversation can read it."
)

_READ_ONLY = FilesystemPermission(
    operations=["write"],
    paths=["/memory/**", "/skills/**"],
    mode="deny",
)


def project_backend(root: Path, store: InMemoryStore) -> CompositeBackend:
    """Route each kind of context to the backend the docs assign it.

    Project memory and skills stay on disk under ``root``. Scratch files and
    offloaded tool results stay in thread state. Preferences go to ``store``,
    so a later thread can read them.
    """
    return CompositeBackend(
        default=StateBackend(),
        routes={
            "/memory/": FilesystemBackend(root_dir=root / "memory", virtual_mode=True),
            "/skills/": FilesystemBackend(root_dir=root / "skills", virtual_mode=True),
            "/memories/": StoreBackend(
                store=store,
                namespace=lambda _runtime: ("memories",),
            ),
        },
    )


def build_agent(
    settings: Settings,
    *,
    model: BaseChatModel | None = None,
    root: Path | None = None,
) -> CompiledStateGraph:
    """Create the agent for ``settings``.

    ``root`` is the directory that contains ``memory/`` and ``skills/``.
    It defaults to the process working directory, which is also where
    ``config.toml`` is read from.

    Pass ``model`` to supply an already constructed chat model. Otherwise the
    ``provider:model`` string in ``settings`` is resolved by Deep Agents.
    """
    project_root = (root or Path.cwd()).resolve()
    store = InMemoryStore()
    tools = [tool for plugin in load_enabled(settings.plugins) for tool in plugin.tools()]
    return create_deep_agent(
        model=model if model is not None else settings.model,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
        memory=["/memory/AGENTS.md"],
        skills=["/skills/"],
        backend=project_backend(project_root, store),
        store=store,
        permissions=[_READ_ONLY],
        checkpointer=InMemorySaver(),
        name="patchai",
    )
