"""Build the Deep Agents harness from PatchAI settings.

``create_deep_agent`` owns the tool loop, summarization, and subagents.
This module supplies the model, the plugin tools, and the input context
the documentation keeps in separate layers: a short role prompt, always-on
project memory, on-demand skills, and a store for preferences that should
outlive one conversation thread.
"""

from collections.abc import Sequence
from pathlib import Path

from deepagents import FilesystemPermission, create_deep_agent
from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend, StoreBackend
from deepagents.backends.utils import create_file_data
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.state import CompiledStateGraph
from langgraph.store.memory import InMemoryStore

from patchai.config.models import Settings
from patchai.model_choice import RequestedModel
from patchai.plugins.registry import load_enabled

SYSTEM_PROMPT = (
    "You are PatchAI, a helpful assistant. "
    "When a user tells you a preference to remember, update "
    "/memories/preferences.md with the edit_file tool before you answer. "
    "Leave /memory/AGENTS.md unchanged. "
    "When a user asks you to use their saved preferences, follow "
    "/memories/preferences.md. "
    "When a user asks you to use a saved file, read a PDF with "
    "read_pdf_source and a PowerPoint with read_pptx_source before you answer. "
    "When a user asks for an interactive report or a dashboard, follow the "
    "render-spec skill and call render_spec. Use create_pdf only when they "
    "ask for a PDF or a file to download."
)

_LOCAL_USER = "local"
_PREFERENCES_KEY = "/preferences.md"
_PREFERENCES_SEED = "# Preferences\n"


def memory_namespace(runtime: object) -> tuple[str, ...]:
    """The user id that owns ``/memories/``.

    Deep Agents scopes that route with
    ``lambda rt: (rt.server_info.user.identity,)``. This process has one
    local user. Use that identity when the runtime carries it, and
    ``local`` when it does not.
    """
    try:
        server = getattr(runtime, "server_info", None)
        user = getattr(server, "user", None) if server is not None else None
        identity = getattr(user, "identity", None) if user is not None else None
    except AttributeError:
        identity = None
    if isinstance(identity, str) and identity:
        return (identity,)
    return (_LOCAL_USER,)


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
                namespace=memory_namespace,
            ),
        },
    )


def chat_model(settings: Settings) -> str | BaseChatModel:
    """The model for ``settings``, with options for its provider applied.

    Without options the ``provider:model`` string goes to Deep Agents as is,
    so its provider defaults still apply. Options replace those defaults,
    so they must repeat any that still matter.
    """
    provider = settings.model.partition(":")[0]
    options = settings.model_options.get(provider)
    if not options:
        return settings.model
    return init_chat_model(settings.model, **options)


def build_agent(
    settings: Settings,
    *,
    model: BaseChatModel | None = None,
    root: Path | None = None,
    mcp_tools: Sequence[BaseTool] = (),
) -> CompiledStateGraph:
    """Create the agent for ``settings``.

    ``root`` is the directory that contains ``memory/`` and ``skills/``.
    It defaults to the process working directory, which is also where
    ``config.toml`` is read from.

    Pass ``model`` to supply an already constructed chat model. Otherwise the
    model comes from ``settings``; see ``chat_model``.

    ``mcp_tools`` are the tools already loaded from the MCP servers.
    """
    project_root = (root or Path.cwd()).resolve()
    store = InMemoryStore()
    store.put((_LOCAL_USER,), _PREFERENCES_KEY, create_file_data(_PREFERENCES_SEED))
    tools = [tool for plugin in load_enabled(settings.plugins) for tool in plugin.tools()]
    tools.extend(mcp_tools)
    return create_deep_agent(
        model=model if model is not None else chat_model(settings),
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
        memory=["/memory/AGENTS.md", "/memories/preferences.md"],
        skills=["/skills/"],
        backend=project_backend(project_root, store),
        store=store,
        middleware=(RequestedModel(settings),),
        permissions=[_READ_ONLY],
        checkpointer=InMemorySaver(),
        name="patchai",
    )
