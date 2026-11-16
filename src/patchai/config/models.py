"""Typed view of the runtime configuration."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Which channel, model, and plugins are live for this process."""

    channel: str
    model: str
    plugins: tuple[str, ...]
    mcp_config: str
