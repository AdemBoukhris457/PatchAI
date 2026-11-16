"""The contract every channel adapter implements."""

from collections.abc import Awaitable, Callable
from typing import Protocol

TurnHandler = Callable[[str, str, str], Awaitable[str]]


class Channel(Protocol):
    """One messaging platform.

    ``serve`` reads platform events, passes each user text to ``handler``,
    and sends the returned string back through that platform.
    """

    name: str

    async def serve(self, handler: TurnHandler) -> None:
        """Run until the platform session ends."""
        ...
