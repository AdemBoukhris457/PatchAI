"""The web channel returns one plain-text reply for one JSON turn."""

import asyncio
import json
import urllib.error
import urllib.request

import pytest

from patchai.channels.web import WebChannel


@pytest.mark.asyncio
async def test_web_channel_returns_the_reply_as_plain_text() -> None:
    seen: list[tuple[str, str, str]] = []

    async def handler(session_id: str, user_id: str, text: str) -> str:
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


def _post(port: int, payload: dict[str, str]) -> tuple[int, str]:
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/chat",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()
