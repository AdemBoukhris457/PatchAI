"""CLI channel.

Reads a line, sends it as one user turn, and prints the assistant reply.
A blank line or end of input ends the session.
"""

from __future__ import annotations

import asyncio
import sys
from collections.abc import Awaitable, Callable

from patchai.channels.protocol import TurnHandler
from patchai.channels.registry import register

LineReader = Callable[[], Awaitable[str | None]]
LineWriter = Callable[[str], None]


class CliChannel:
    """Terminal adapter registered under the name ``cli``."""

    name = "cli"

    def __init__(self, read_line: LineReader, write_line: LineWriter) -> None:
        self._read_line = read_line
        self._write_line = write_line

    async def serve(self, handler: TurnHandler) -> None:
        """Read until a blank line or end of input."""
        while True:
            line = await self._read_line()
            if line is None:
                return
            text = line.strip()
            if not text:
                return
            reply = await handler(self.name, "local", text)
            self._write_line(reply)


async def _read_stdin() -> str | None:
    line = await asyncio.to_thread(sys.stdin.readline)
    if line == "":
        return None
    return line


def _write_stdout(text: str) -> None:
    print(text, flush=True)


channel = CliChannel(_read_stdin, _write_stdout)
register(channel)
