"""Typed view of the runtime configuration."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Settings:
    """Which channel, model, and plugins are live for this process.

    ``model_options`` maps a provider prefix such as ``openai`` to extra
    keyword arguments for ``init_chat_model``. Only the entry that matches
    the active model's provider is used.
    """

    channel: str
    model: str
    plugins: tuple[str, ...]
    mcp_config: str
    model_options: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)
