"""Process entry point.

Load the configured channel, build the agent, and run that channel.
"""

import asyncio
import importlib
from pathlib import Path

from patchai.channels.registry import resolve
from patchai.config.loader import load_settings
from patchai.conversation import ask
from patchai.harness import build_agent

_CHANNEL_MODULES = {
    "cli": "patchai.channels.cli",
}


async def main(config_path: Path | None = None) -> None:
    """Start the channel named in the configuration file."""
    config_path = config_path or Path("config.toml")
    settings = load_settings(config_path)
    module_name = _CHANNEL_MODULES.get(settings.channel)
    if module_name is None:
        known = ", ".join(sorted(_CHANNEL_MODULES))
        raise LookupError(f"Unknown channel '{settings.channel}'. Known channels: {known}.")
    importlib.import_module(module_name)
    agent = build_agent(settings, root=config_path.resolve().parent)
    channel = resolve(settings.channel)

    async def on_message(session_id: str, user_id: str, text: str) -> str:
        del user_id
        return await ask(agent, session_id, text)

    await channel.serve(on_message)


def run() -> None:
    """Console-script entry point."""
    asyncio.run(main())
