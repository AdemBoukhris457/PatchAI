"""Load ``Settings`` from a TOML file."""

import os
import tomllib
from dataclasses import replace
from pathlib import Path

from patchai.config.models import Settings


def load_settings(path: Path) -> Settings:
    """Read ``path`` and return the live channel, model, plugins, and MCP file."""
    with path.open("rb") as handle:
        raw = tomllib.load(handle)
    if not isinstance(raw, dict):
        raise ValueError(f"{path} must contain a TOML table.")

    channel = _table(raw, "channel")
    model = _table(raw, "model")
    plugins = _table(raw, "plugins")
    mcp = _table(raw, "mcp")
    enabled = plugins.get("enabled")
    if not isinstance(enabled, list) or not all(isinstance(name, str) for name in enabled):
        raise ValueError("config.toml [plugins].enabled must be an array of strings.")

    return Settings(
        channel=_string(channel, "channel", "active"),
        model=_string(model, "model", "name"),
        plugins=tuple(enabled),
        mcp_config=_string(mcp, "mcp", "config"),
        model_options=_model_options(model),
    )


def apply_model_choice(settings: Settings) -> Settings:
    """Use ``PATCHAI_MODEL`` when the env file chose a model."""
    chosen = os.environ.get("PATCHAI_MODEL", "").strip()
    if not chosen:
        return settings
    return replace(settings, model=chosen)


def _model_options(model: dict[str, object]) -> dict[str, dict[str, object]]:
    options = model.get("options", {})
    if not isinstance(options, dict) or not all(
        isinstance(value, dict) for value in options.values()
    ):
        raise ValueError(
            "config.toml [model.options] must hold one table per provider, "
            "such as [model.options.openai]."
        )
    return options


def _table(data: dict[str, object], name: str) -> dict[str, object]:
    section = data.get(name)
    if not isinstance(section, dict):
        raise ValueError(f"config.toml is missing the [{name}] table.")
    return section


def _string(section: dict[str, object], table: str, key: str) -> str:
    value = section.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"config.toml [{table}].{key} must be a non-empty string.")
    return value
