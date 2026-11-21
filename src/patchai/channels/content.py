"""Turn a chat payload into the user message Deep Agents reads.

A plain string stays a plain string. An attachment becomes one of the
standard content blocks from the multimodal guide: ``image``, ``audio``,
``video``, or ``file``. The MIME types are the ones ``read_file`` accepts
for those same kinds of files.
"""

from typing import TypeAlias

UserContent: TypeAlias = str | list[dict[str, str]]

_MAX_BLOCKS = 8
_MAX_BASE64 = 24_000_000

_IMAGE = {
    "image/png": "image/png",
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/gif": "image/gif",
    "image/webp": "image/webp",
    "image/heic": "image/heic",
    "image/heif": "image/heif",
}
_AUDIO = {
    "audio/wav": "audio/wav",
    "audio/x-wav": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/mpeg": "audio/mpeg",
    "audio/mp3": "audio/mpeg",
    "audio/aiff": "audio/aiff",
    "audio/x-aiff": "audio/aiff",
    "audio/aac": "audio/aac",
    "audio/ogg": "audio/ogg",
    "audio/flac": "audio/flac",
}
_VIDEO = {
    "video/mp4": "video/mp4",
    "video/mpeg": "video/mpeg",
    "video/quicktime": "video/quicktime",
    "video/x-msvideo": "video/x-msvideo",
    "video/x-flv": "video/x-flv",
    "video/webm": "video/webm",
    "video/x-ms-wmv": "video/x-ms-wmv",
    "video/3gpp": "video/3gpp",
}
_DOCUMENT = {
    "application/pdf": "application/pdf",
    "application/vnd.ms-powerpoint": "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ),
}
_KINDS = {
    "image": _IMAGE,
    "audio": _AUDIO,
    "video": _VIDEO,
    "file": _DOCUMENT,
}
_FILE_NAMES = {
    "application/pdf": "document.pdf",
    "application/vnd.ms-powerpoint": "slides.ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": (
        "slides.pptx"
    ),
}


class TurnError(ValueError):
    """The payload is not a usable user turn."""


def parse_turn(payload: dict[str, object]) -> UserContent:
    """Return the user message carried by one ``POST /chat`` body."""
    if "content" in payload:
        return _blocks(payload["content"])
    text = payload.get("text")
    if isinstance(text, str) and text.strip():
        return text.strip()
    raise TurnError("A message is required.")


def _blocks(raw: object) -> list[dict[str, str]]:
    if not isinstance(raw, list) or not raw:
        raise TurnError("A message is required.")
    if len(raw) > _MAX_BLOCKS:
        raise TurnError("Too many attachments.")
    return [_block(item) for item in raw]


def _block(item: object) -> dict[str, str]:
    if not isinstance(item, dict):
        raise TurnError("The attachment could not be read.")
    kind = item.get("type")
    if kind == "text":
        text = item.get("text")
        if not isinstance(text, str) or not text.strip():
            raise TurnError("A message is required.")
        return {"type": "text", "text": text.strip()}
    if not isinstance(kind, str) or kind not in _KINDS:
        raise TurnError("This file type is not supported.")
    filename = _filename(item.get("filename"))
    if "base64" in item:
        return _binary(kind, item, filename)
    url = item.get("url")
    if isinstance(url, str) and url.startswith(("http://", "https://")):
        normalized = _known_mime(kind, item.get("mime_type"))
        block = {"type": kind, "url": url}
        if normalized:
            block["mime_type"] = normalized
        name = filename or (_FILE_NAMES.get(normalized) if kind == "file" else None)
        if kind == "file" and not name:
            name = "document.pdf"
        if name:
            block["filename"] = name
        return block
    raise TurnError("The attachment could not be read.")


def _binary(kind: str, item: dict[str, object], filename: str | None) -> dict[str, str]:
    data = item.get("base64")
    mime = item.get("mime_type")
    if not isinstance(data, str) or not data or len(data) > _MAX_BASE64:
        raise TurnError("The attachment could not be read.")
    if not isinstance(mime, str):
        raise TurnError("This file type is not supported.")
    normalized = _KINDS[kind].get(mime.lower())
    if normalized is None:
        raise TurnError("This file type is not supported.")
    block = {"type": kind, "base64": data, "mime_type": normalized}
    name = filename or (_FILE_NAMES.get(normalized) if kind == "file" else None)
    if name:
        block["filename"] = name
    return block


def _known_mime(kind: str, mime: object) -> str:
    """Return the canonical MIME type, or ``""`` when the block names none.

    A present type that is not one of this kind's types is rejected.
    """
    if mime is None:
        return ""
    if not isinstance(mime, str):
        raise TurnError("This file type is not supported.")
    normalized = _KINDS[kind].get(mime.lower())
    if normalized is None:
        raise TurnError("This file type is not supported.")
    return normalized


def _filename(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    name = value.replace("\\", "/").rsplit("/", 1)[-1].strip()
    if not name or any(ord(char) < 32 for char in name):
        return None
    return name[:200]
