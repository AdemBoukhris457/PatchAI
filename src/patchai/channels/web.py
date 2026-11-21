"""HTTP channel for the local web app.

One JSON turn comes in. A string handler is written once. A handler that
yields agent events is written as the AI SDK UI message stream while the
agent works, so the page can show text, reasoning and tool steps as they
happen. The process keeps the agent so a thread survives across requests.
"""

from __future__ import annotations

import asyncio
import json
import select
import socket
from collections.abc import AsyncIterator, Awaitable, Callable, Coroutine
from concurrent.futures import CancelledError as RunCancelled
from concurrent.futures import Future
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from patchai.channels import ui_stream
from patchai.channels.content import TurnError, UserContent, parse_prior, parse_turn
from patchai.channels.registry import register
from patchai.conversation import Event

ReplyHandler = Callable[
    [str, str, UserContent, list[tuple[str, str]] | None],
    Awaitable[str] | AsyncIterator[Event],
]

_MAX_BODY = 32_000_000


class WebChannel:
    """Local HTTP adapter registered under the name ``web``."""

    name = "web"

    def __init__(self, host: str = "127.0.0.1", port: int = 8765) -> None:
        self.host = host
        self.port = port
        self.ready = False
        self._httpd: ThreadingHTTPServer | None = None

    def close(self) -> None:
        """Stop ``serve`` from another thread."""
        httpd = self._httpd
        if httpd is not None:
            httpd.shutdown()

    async def serve(self, handler: ReplyHandler) -> None:
        """Accept ``POST /chat`` until ``close`` is called."""
        loop = asyncio.get_running_loop()
        httpd = ThreadingHTTPServer((self.host, self.port), _chat_handler(loop, handler))
        self._httpd = httpd
        self.port = int(httpd.server_address[1])
        self.ready = True
        try:
            await loop.run_in_executor(None, httpd.serve_forever)
        finally:
            httpd.server_close()
            self._httpd = None
            self.ready = False


def _plain(handler: BaseHTTPRequestHandler, status: int, text: str) -> None:
    body = text.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "text/plain; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Connection", "close")
    handler.end_headers()
    handler.wfile.write(body)


_POLL_SECONDS = 0.1


def _stream(
    handler: BaseHTTPRequestHandler,
    loop: asyncio.AbstractEventLoop,
    events: AsyncIterator[Event],
) -> None:
    """Write ``events`` as UI message stream parts in HTTP chunks.

    Closing the stream is the stop button. The run is cancelled when the
    client goes away, which is the disconnect behaviour Deep Agents uses
    for a streamed run. A tool call that was cancelled before it returned
    is repaired by the agent's patch middleware on the next turn.
    """
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def produce() -> None:
        try:
            async for piece in ui_stream.encode(events):
                await queue.put(piece)
        except asyncio.CancelledError:
            raise
        finally:
            current = asyncio.current_task()
            if current is None or not current.cancelling():
                await queue.put(None)

    running = asyncio.run_coroutine_threadsafe(produce(), loop)
    waiting: Future[str | None] | None = None

    def next_piece() -> str | None:
        nonlocal waiting
        if waiting is None:
            waiting = asyncio.run_coroutine_threadsafe(queue.get(), loop)
        return waiting.result(_POLL_SECONDS)

    handler.protocol_version = "HTTP/1.1"
    handler.send_response(200)
    for name, value in ui_stream.HEADERS.items():
        handler.send_header(name, value)
    handler.send_header("Transfer-Encoding", "chunked")
    handler.send_header("Connection", "close")
    handler.end_headers()
    try:
        while True:
            if _client_closed(handler):
                _cancel(running, waiting)
                return
            try:
                piece = next_piece()
            except TimeoutError:
                continue
            waiting = None
            if piece is None:
                break
            _write_chunk(handler, piece)
        handler.wfile.write(b"0\r\n\r\n")
        handler.wfile.flush()
    except OSError:
        _cancel(running, waiting)
        return
    running.result()


def _cancel(running: Future[None], waiting: Future[str | None] | None) -> None:
    """Stop the agent task and the queue read that is waiting on it."""
    running.cancel()
    if waiting is not None:
        waiting.cancel()
    try:
        running.result(timeout=5)
    except (RunCancelled, TimeoutError):
        return


def _client_closed(handler: BaseHTTPRequestHandler) -> bool:
    """Return whether the browser has hung up."""
    sock = handler.connection
    try:
        readable, _, _ = select.select([sock], [], [], 0)
    except (OSError, ValueError):
        return True
    if not readable:
        return False
    try:
        return sock.recv(1, socket.MSG_PEEK) == b""
    except BlockingIOError:
        return False
    except OSError:
        return True


def _write_chunk(handler: BaseHTTPRequestHandler, text: str) -> None:
    data = text.encode("utf-8")
    handler.wfile.write(f"{len(data):X}\r\n".encode("ascii"))
    handler.wfile.write(data)
    handler.wfile.write(b"\r\n")
    handler.wfile.flush()


def _chat_handler(
    loop: asyncio.AbstractEventLoop,
    handler: ReplyHandler,
) -> type[BaseHTTPRequestHandler]:
    class ChatHandler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            if self.path.split("?", 1)[0] != "/chat":
                _plain(self, 404, "Not found.")
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                _plain(self, 400, "The message could not be read.")
                return
            if length < 0 or length > _MAX_BODY:
                _plain(self, 400, "The message could not be read.")
                return
            try:
                payload = json.loads(self.rfile.read(length))
            except json.JSONDecodeError:
                _plain(self, 400, "The message could not be read.")
                return
            if not isinstance(payload, dict):
                _plain(self, 400, "The message could not be read.")
                return
            thread_id = payload.get("thread_id", "web")
            if not isinstance(thread_id, str) or not thread_id.strip():
                _plain(self, 400, "A thread id is required.")
                return
            try:
                content = parse_turn(payload)
                prior = parse_prior(payload)
            except TurnError as exc:
                _plain(self, 400, str(exc))
                return
            result = handler(thread_id.strip(), "local", content, prior)
            if hasattr(result, "__aiter__"):
                _stream(self, loop, result)
                return
            if not isinstance(result, Coroutine):
                _plain(self, 500, "PatchAI could not answer.")
                return
            future = asyncio.run_coroutine_threadsafe(result, loop)
            try:
                reply = future.result()
            except Exception:
                _plain(self, 500, "PatchAI could not answer.")
                return
            _plain(self, 200, reply)

        def log_message(self, _format: str, *args: object) -> None:
            return

    return ChatHandler


channel = WebChannel()
register(channel)
