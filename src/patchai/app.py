"""Process entry point.

Load the configured channel, build the agent, and run that channel.
"""

import asyncio
import importlib
from pathlib import Path

from patchai.channels.registry import resolve
from patchai.config.env import load_env
from patchai.config.loader import apply_model_choice, load_settings
from patchai.conversation import ask, stream_events
from patchai.harness import build_agent
from patchai.mcp.loader import load_mcp_tools

_CHANNEL_MODULES = {
    "cli": "patchai.channels.cli",
    "web": "patchai.channels.web",
}


async def main(config_path: Path | None = None) -> None:
    """Start the channel named in the configuration file."""
    config_path = (config_path or Path("config.toml")).resolve()
    load_env(config_path.parent / ".env")
    settings = apply_model_choice(load_settings(config_path))
    module_name = _CHANNEL_MODULES.get(settings.channel)
    if module_name is None:
        known = ", ".join(sorted(_CHANNEL_MODULES))
        raise LookupError(f"Unknown channel '{settings.channel}'. Known channels: {known}.")
    importlib.import_module(module_name)
    root = config_path.parent
    mcp_tools = await load_mcp_tools(root / settings.mcp_config)
    agent = build_agent(settings, root=root, mcp_tools=mcp_tools)
    channel = resolve(settings.channel)

    async def on_message(session_id: str, user_id: str, text: str) -> str:
        del user_id
        return await ask(agent, session_id, text)

    async def on_stream(session_id: str, user_id: str, text: str):
        del user_id
        async for event in stream_events(agent, session_id, text):
            yield event

    if settings.channel == "web":
        await channel.serve(on_stream)
    else:
        await channel.serve(on_message)


def run() -> None:
    """Console-script entry point."""
    asyncio.run(main())
