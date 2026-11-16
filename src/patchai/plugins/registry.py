"""Resolve plugin names from configuration to plugin objects."""

import importlib
from collections.abc import Sequence

from patchai.plugins.protocol import Plugin


def load_enabled(names: Sequence[str]) -> list[Plugin]:
    """Import each ``patchai.plugins.<name>`` module and read its ``plugin`` object."""
    loaded: list[Plugin] = []
    for name in names:
        try:
            module = importlib.import_module(f"patchai.plugins.{name}")
        except ModuleNotFoundError as exc:
            raise LookupError(f"Plugin '{name}' is not installed.") from exc
        plugin = getattr(module, "plugin", None)
        if plugin is None or not callable(getattr(plugin, "tools", None)):
            raise LookupError(
                f"Plugin '{name}' must export a 'plugin' object with a tools() method."
            )
        loaded.append(plugin)
    return loaded
