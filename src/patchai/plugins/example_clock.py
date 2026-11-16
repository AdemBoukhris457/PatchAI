"""Example tool plugin.

Reports the current UTC time when the agent calls it.
"""

from collections.abc import Callable
from datetime import datetime, timezone


def current_time() -> str:
    """Return the current UTC time in ISO 8601 format.

    Use this when the user asks what time it is, today's date, or the time
    right now.
    """
    return datetime.now(timezone.utc).isoformat()


class ClockPlugin:
    """The clock tool, registered under the name listed in config.toml."""

    name = "example_clock"

    def tools(self) -> list[Callable[..., object]]:
        """Return the callables this plugin contributes."""
        return [current_time]


plugin = ClockPlugin()
