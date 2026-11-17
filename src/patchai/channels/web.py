"""HTTP channel for the local web app.

One JSON turn comes in, and the assistant reply goes out as plain text.
The process keeps the agent so a thread survives from one request to the next.
"""

from __future__ import annotations

import asyncio
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from patchai.channels.protocol import TurnHandler
from patchai.channels.registry import register

_MAX_BODY = 1_000_000


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

    async def serve(self, handler: TurnHandler) -> None:
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


def _chat_handler(
    loop: asyncio.AbstractEventLoop,
    handler: TurnHandler,
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
            text = payload.get("text")
            thread_id = payload.get("thread_id", "web")
            if not isinstance(text, str) or not text.strip():
                _plain(self, 400, "A message is required.")
                return
            if not isinstance(thread_id, str) or not thread_id.strip():
                _plain(self, 400, "A thread id is required.")
                return
            future = asyncio.run_coroutine_threadsafe(
                handler(thread_id.strip(), "local", text.strip()),
                loop,
            )
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
