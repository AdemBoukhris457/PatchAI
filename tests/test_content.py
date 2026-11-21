"""Chat payloads become the content blocks Deep Agents reads."""

import pytest

from patchai.channels.content import TurnError, parse_turn


def test_plain_text_stays_a_string() -> None:
    assert parse_turn({"text": "  hello  "}) == "hello"


def test_blank_text_is_rejected() -> None:
    with pytest.raises(TurnError, match="A message is required."):
        parse_turn({"text": "   "})


def test_image_bytes_become_an_image_block() -> None:
    content = parse_turn(
        {
            "content": [
                {"type": "text", "text": "What is in this screenshot?"},
                {
                    "type": "image",
                    "base64": "aaaa",
                    "mime_type": "image/jpg",
                    "filename": "shot.png",
                },
            ]
        }
    )

    assert content == [
        {"type": "text", "text": "What is in this screenshot?"},
        {
            "type": "image",
            "base64": "aaaa",
            "mime_type": "image/jpeg",
            "filename": "shot.png",
        },
    ]


def test_pdf_bytes_become_a_named_file_block() -> None:
    content = parse_turn(
        {
            "content": [
                {
                    "type": "file",
                    "base64": "bbbb",
                    "mime_type": "application/pdf",
                }
            ]
        }
    )

    assert content == [
        {
            "type": "file",
            "base64": "bbbb",
            "mime_type": "application/pdf",
            "filename": "document.pdf",
        }
    ]


def test_video_url_stays_a_url_block() -> None:
    content = parse_turn(
        {
            "content": [
                {
                    "type": "video",
                    "url": "https://example.com/clip.mp4",
                    "mime_type": "video/mp4",
                }
            ]
        }
    )

    assert content == [
        {
            "type": "video",
            "url": "https://example.com/clip.mp4",
            "mime_type": "video/mp4",
        }
    ]


def test_unknown_media_type_is_rejected() -> None:
    with pytest.raises(TurnError, match="not supported"):
        parse_turn(
            {
                "content": [
                    {"type": "image", "base64": "aaaa", "mime_type": "image/svg+xml"}
                ]
            }
        )


def test_audio_block_is_accepted() -> None:
    content = parse_turn(
        {
            "content": [
                {"type": "audio", "base64": "cccc", "mime_type": "audio/mpeg"}
            ]
        }
    )

    assert content == [
        {"type": "audio", "base64": "cccc", "mime_type": "audio/mpeg"}
    ]
