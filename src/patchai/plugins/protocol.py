"""The contract an in-process plugin exports."""

from collections.abc import Callable
from typing import Protocol


class Plugin(Protocol):
    """Tools the composition root passes to the agent."""

    name: str

    def tools(self) -> list[Callable[..., object]]:
        """Return the callables this plugin contributes."""
        ...
