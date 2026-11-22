"""The web channel answers one JSON turn as plain text or a UI message stream."""

import asyncio
import json
import socket
import urllib.error
import urllib.request

import pytest

from patchai.channels.web import WebChannel
from patchai.conversation import TextDelta


@pytest.mark.asyncio
async def test_web_channel_returns_the_reply_as_plain_text() -> None:
    seen: list[tuple[str, str, str]] = []

    async def handler(session_id: str, user_id: str, text: str, prior=None) -> str:
        del prior
        seen.append((session_id, user_id, text))
        return "the time is 12:00 UTC"

    channel = WebChannel("127.0.0.1", 0)
    task = asyncio.create_task(channel.serve(handler))
    try:
        for _ in range(50):
            if channel.ready:
                break
            await asyncio.sleep(0.02)
        else:
            raise AssertionError("The web channel did not bind.")

        status, body = await asyncio.to_thread(
            _post,
            channel.port,
            {"thread_id": "web", "text": "what time is it"},
        )
        missing, missing_body = await asyncio.to_thread(
            _post,
            channel.port,
            {"text": "   "},
        )
    finally:
        channel.close()
        await task

    assert status == 200
    assert body == "the time is 12:00 UTC"
    assert seen == [("web", "local", "what time is it")]
    assert missing == 400
    assert missing_body == "A message is required."


@pytest.mark.asyncio
async def test_web_channel_streams_events_as_ui_message_parts() -> None:
    async def handler(session_id: str, user_id: str, text: str, prior=None):
        del session_id, user_id, text, prior
        yield TextDelta("hel")
        yield TextDelta("lo")

    channel = WebChannel("127.0.0.1", 0)
    task = asyncio.create_task(channel.serve(handler))
    try:
        for _ in range(50):
            if channel.ready:
                break
            await asyncio.sleep(0.02)
        else:
            raise AssertionError("The web channel did not bind.")

        status, body, headers = await asyncio.to_thread(
            _post_with_headers,
            channel.port,
            {"thread_id": "web", "text": "hello"},
        )
    finally:
        channel.close()
        await task

    assert status == 200
    assert headers["x-vercel-ai-ui-message-stream"] == "v1"
    assert headers["Content-Type"].startswith("text/event-stream")
    deltas = [
        json.loads(line[6:])["delta"]
        for line in body.split("\n\n")
        if line.startswith("data: {") and '"text-delta"' in line
    ]
    assert deltas == ["hel", "lo"]
    assert body.endswith("data: [DONE]\n\n")


@pytest.mark.asyncio
async def test_web_channel_passes_media_blocks_to_the_agent() -> None:
    seen: list[object] = []

    async def handler(session_id: str, user_id: str, content: object, prior=None) -> str:
        del session_id, user_id, prior
        seen.append(content)
        return "a chart"

    channel = WebChannel("127.0.0.1", 0)
    task = asyncio.create_task(channel.serve(handler))
    try:
        for _ in range(50):
            if channel.ready:
                break
            await asyncio.sleep(0.02)
        else:
            raise AssertionError("The web channel did not bind.")

        status, body = await asyncio.to_thread(
            _post,
            channel.port,
            {
                "thread_id": "web",
                "content": [
                    {"type": "text", "text": "What is in this screenshot?"},
                    {
                        "type": "image",
                        "base64": "aaaa",
                        "mime_type": "image/png",
                    },
                ],
            },
        )
    finally:
        channel.close()
        await task

    assert status == 200
    assert body == "a chart"
    assert seen == [
        [
            {"type": "text", "text": "What is in this screenshot?"},
            {"type": "image", "base64": "aaaa", "mime_type": "image/png"},
        ]
    ]


@pytest.mark.asyncio
async def test_web_channel_passes_the_kept_dialogue() -> None:
    seen: list[object] = []

    async def handler(session_id: str, user_id: str, content: object, prior=None) -> str:
        del session_id, user_id
        seen.append((content, prior))
        return "hi"

    channel = WebChannel("127.0.0.1", 0)
    task = asyncio.create_task(channel.serve(handler))
    try:
        for _ in range(50):
            if channel.ready:
                break
            await asyncio.sleep(0.02)
        else:
            raise AssertionError("The web channel did not bind.")

        status, body = await asyncio.to_thread(
            _post,
            channel.port,
            {
                "thread_id": "web",
                "text": "My name is Ana.",
                "prior": [
                    {"role": "user", "text": "My name is Bob."},
                    {"role": "assistant", "text": "Hi Bob."},
                ],
            },
        )
        broken, broken_body = await asyncio.to_thread(
            _post,
            channel.port,
            {"thread_id": "web", "text": "hello", "prior": "nope"},
        )
    finally:
        channel.close()
        await task

    assert status == 200
    assert body == "hi"
    assert seen == [("My name is Ana.", [("user", "My name is Bob."), ("assistant", "Hi Bob.")])]
    assert broken == 400
    assert broken_body == "The message could not be read."


@pytest.mark.asyncio
async def test_closing_the_stream_cancels_the_run() -> None:
    cancelled = asyncio.Event()
    continued = asyncio.Event()

    async def handler(session_id: str, user_id: str, content: object, prior=None):
        del session_id, user_id, content, prior
        yield TextDelta("hel")
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            cancelled.set()
            raise
        continued.set()
        yield TextDelta("lo")

    channel = WebChannel("127.0.0.1", 0)
    task = asyncio.create_task(channel.serve(handler))
    try:
        for _ in range(50):
            if channel.ready:
                break
            await asyncio.sleep(0.02)
        else:
            raise AssertionError("The web channel did not bind.")

        await asyncio.to_thread(_read_then_close, channel.port, b"hel")
        await asyncio.wait_for(cancelled.wait(), 2)
    finally:
        channel.close()
        await task

    assert not continued.is_set()


@pytest.mark.asyncio
async def test_web_channel_passes_a_chosen_model() -> None:
    seen: list[str | None] = []

    async def handler(session_id: str, user_id: str, text: str, prior=None, model=None) -> str:
        del session_id, user_id, text, prior
        seen.append(model)
        return "ok"

    channel = WebChannel("127.0.0.1", 0)
    task = asyncio.create_task(channel.serve(handler))
    try:
        for _ in range(50):
            if channel.ready:
                break
            await asyncio.sleep(0.02)
        else:
            raise AssertionError("The web channel did not bind.")

        status, body = await asyncio.to_thread(
            _post,
            channel.port,
            {"thread_id": "web", "text": "hello", "model": "gpt-6.2-sol"},
        )
        refused, refused_body = await asyncio.to_thread(
            _post,
            channel.port,
            {"thread_id": "web", "text": "hello", "model": "not-a-model"},
        )
    finally:
        channel.close()
        await task

    assert status == 200
    assert body == "ok"
    assert seen == ["gpt-6.2-sol"]
    assert refused == 400
    assert refused_body == "That model is not available."


@pytest.mark.asyncio
async def test_web_channel_passes_a_chosen_effort() -> None:
    seen: list[tuple[str | None, str | None]] = []

    async def handler(
        session_id: str,
        user_id: str,
        text: str,
        prior=None,
        model=None,
        effort=None,
    ) -> str:
        del session_id, user_id, text, prior
        seen.append((model, effort))
        return "ok"

    channel = WebChannel("127.0.0.1", 0)
    task = asyncio.create_task(channel.serve(handler))
    try:
        for _ in range(50):
            if channel.ready:
                break
            await asyncio.sleep(0.02)
        else:
            raise AssertionError("The web channel did not bind.")

        status, body = await asyncio.to_thread(
            _post,
            channel.port,
            {"thread_id": "web", "text": "hello", "model": "gpt-6-luna", "effort": "high"},
        )
        refused, refused_body = await asyncio.to_thread(
            _post,
            channel.port,
            {"thread_id": "web", "text": "hello", "effort": "none"},
        )
    finally:
        channel.close()
        await task

    assert status == 200
    assert body == "ok"
    assert seen == [("gpt-6-luna", "high")]
    assert refused == 400
    assert refused_body == "That effort is not available."


def _read_then_close(port: int, marker: bytes) -> None:
    """Read until ``marker`` arrives, then hang up."""
    body = json.dumps({"thread_id": "web", "text": "hello"}).encode()
    request = (
        "POST /chat HTTP/1.1\r\n"
        "Host: 127.0.0.1\r\n"
        "Content-Type: application/json\r\n"
        f"Content-Length: {len(body)}\r\n"
        "Connection: close\r\n"
        "\r\n"
    ).encode() + body
    with socket.create_connection(("127.0.0.1", port), timeout=5) as sock:
        sock.sendall(request)
        received = b""
        while marker not in received:
            chunk = sock.recv(4096)
            if not chunk:
                break
            received += chunk


def _post(port: int, payload: dict[str, object]) -> tuple[int, str]:
    status, body, _headers = _post_with_headers(port, payload)
    return status, body


def _post_with_headers(
    port: int, payload: dict[str, object]
) -> tuple[int, str, dict[str, str]]:
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/chat",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, response.read().decode(), dict(response.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode(), dict(exc.headers)
