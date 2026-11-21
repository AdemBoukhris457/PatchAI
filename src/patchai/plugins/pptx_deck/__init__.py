"""Designed PowerPoint decks built from slides the agent describes.

Fixed frames lay out every slide, python-pptx writes the file, and it is
saved under ``exports/`` in the working directory.
"""

import json
import re
from collections.abc import Callable
from datetime import date
from pathlib import Path
from typing import Annotated

from pydantic import BaseModel, Field, ValidationError

from patchai.plugins.pptx_deck.render import render
from patchai.plugins.pptx_deck.slides import Deck, Slide

_FILE_NAME = re.compile(r"^[a-z0-9][a-z0-9_-]{0,70}\.pptx$")
_CLEARABLE = frozenset({"subtitle", "author"})
_ACCENT = "blue, indigo, violet, teal, green, orange, red, or slate"


def create_pptx(
    title: Annotated[str, Field(min_length=1, max_length=120)],
    slides: Annotated[
        list[Slide],
        Field(min_length=1, max_length=24, description="The slides, in order."),
    ],
    subtitle: Annotated[str | None, Field(max_length=160)] = None,
    author: Annotated[str | None, Field(max_length=80)] = None,
    date_line: Annotated[
        str | None,
        Field(
            max_length=40, description="The date shown on the cover. Defaults to today."
        ),
    ] = None,
    accent: Annotated[str, Field(description=_ACCENT)] = "blue",
    filename: Annotated[str | None, Field(max_length=80)] = None,
) -> str:
    """Create a designed PowerPoint deck and save it as a file.

    Use this when the user asks for a PowerPoint, a slide deck, or a
    presentation. Write the whole deck yourself as slides. Each slide is one
    claim: cover, section, statement, bullets, columns, metrics, comparison,
    timeline, chart, table, quote, or close. The frames own fonts, colors,
    and positions, so only describe content. Charts are bar, line, or pie
    drawn from numbers. This saves a new file and the source beside it. To
    change a file that already exists, call read_pptx_source and then
    update_pptx. Returns JSON with the saved path. The chat shows a card for
    that file, so the reply must not repeat the filename, the path, or a URL.
    """
    try:
        deck = Deck(
            title=title.strip(),
            slides=slides,
            subtitle=subtitle or None,
            author=author or None,
            date_line=date_line or _today(),
            accent=accent,
        )
        pptx = render(deck)
        target = _target(filename or deck.title)
        _publish(target, deck, pptx)
    except (ValueError, OSError, ValidationError) as exc:
        return f"The PowerPoint could not be built: {exc}"
    return _result(target, pptx, deck)


def read_pptx_source(
    filename: Annotated[
        str, Field(description="The saved PowerPoint name, such as hello.pptx.")
    ],
) -> str:
    """Return the source of a PowerPoint this agent created.

    The source is JSON with the title, the slides, and the deck fields.
    Call this before update_pptx when the user wants a change. A PowerPoint
    that has no source file cannot be edited.
    """
    try:
        return _source_path(_existing(filename)).read_text(encoding="utf-8")
    except MissingDeck as exc:
        return str(exc)
    except OSError as exc:
        return f"The source could not be read: {exc}"


def update_pptx(
    filename: Annotated[
        str,
        Field(
            description="The saved PowerPoint name to overwrite, such as hello.pptx."
        ),
    ],
    title: Annotated[str | None, Field(min_length=1, max_length=120)] = None,
    slides: Annotated[
        list[Slide] | None,
        Field(
            min_length=1,
            max_length=24,
            description="The whole deck, in order. Replaces every slide. Omit to keep the current slides.",
        ),
    ] = None,
    subtitle: Annotated[
        str | None,
        Field(max_length=160, description="Omit to keep. An empty string removes it."),
    ] = None,
    author: Annotated[
        str | None,
        Field(max_length=80, description="Omit to keep. An empty string removes it."),
    ] = None,
    date_line: Annotated[
        str | None,
        Field(
            min_length=1,
            max_length=40,
            description="Omit to keep the date already on the deck.",
        ),
    ] = None,
    accent: Annotated[
        str | None, Field(description=f"Omit to keep. {_ACCENT}.")
    ] = None,
) -> str:
    """Revise a PowerPoint this agent already created, and overwrite that same file.

    Call read_pptx_source first and pass its filename. Omit every field that
    should stay as it is. Send slides only when the deck changes, and then
    send the whole deck: the list replaces every current slide. Pass an empty
    string to remove the subtitle or the author. The filename does not change.
    Returns JSON with the saved path. The chat shows a card for that file, so
    the reply must not repeat the filename, the path, or a URL.
    """
    try:
        target = _existing(filename)
        deck = Deck.model_validate_json(
            _source_path(target).read_text(encoding="utf-8")
        )
    except MissingDeck as exc:
        return str(exc)
    except (OSError, ValidationError, json.JSONDecodeError) as exc:
        return f"The source could not be read: {exc}"
    try:
        deck = _merge(
            deck,
            title=title,
            slides=slides,
            subtitle=subtitle,
            author=author,
            date_line=date_line,
            accent=accent,
        )
        pptx = render(deck)
        _publish(target, deck, pptx)
    except (ValueError, OSError, ValidationError) as exc:
        return f"The PowerPoint could not be built: {exc}"
    return _result(target, pptx, deck)


def _merge(deck: Deck, **changes: object) -> Deck:
    """Apply the fields the caller sent. ``None`` keeps the stored value."""
    data = deck.model_dump(mode="json")
    for key, value in changes.items():
        if value is None:
            continue
        if key in _CLEARABLE and value == "":
            data[key] = None
            continue
        if key == "slides" and isinstance(value, list):
            data[key] = [
                item.model_dump(mode="json") if isinstance(item, BaseModel) else item
                for item in value
            ]
            continue
        if key == "title" and isinstance(value, str):
            data[key] = value.strip()
            continue
        data[key] = value
    return Deck.model_validate(data)


def _publish(target: Path, deck: Deck, pptx: bytes) -> None:
    """Write the source and then the file, restoring the source if the write fails."""
    target.parent.mkdir(exist_ok=True)
    source = _source_path(target)
    previous = source.read_text(encoding="utf-8") if source.is_file() else None
    file_part = target.with_name(target.name + ".part")
    source_part = source.with_name(source.name + ".part")
    try:
        source_part.write_text(_source_text(deck), encoding="utf-8")
        file_part.write_bytes(pptx)
        source_part.replace(source)
        file_part.replace(target)
    except Exception:
        if source.is_file() and previous is None:
            source.unlink()
        elif previous is not None:
            source.write_text(previous, encoding="utf-8")
        raise
    finally:
        file_part.unlink(missing_ok=True)
        source_part.unlink(missing_ok=True)


def _result(target: Path, pptx: bytes, deck: Deck) -> str:
    return json.dumps(
        {
            "saved": str(target),
            "filename": target.name,
            "title": deck.title,
            "bytes": len(pptx),
            "slides": len(deck.slides),
        }
    )


def _source_text(deck: Deck) -> str:
    return json.dumps(deck.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n"


def _source_path(pptx: Path) -> Path:
    return pptx.with_name(f"{pptx.stem}.source.json")


class MissingDeck(Exception):
    """The named file is not a PowerPoint this plugin can revise."""


def _existing(filename: str) -> Path:
    name = Path(str(filename)).name
    if not _FILE_NAME.fullmatch(name):
        raise MissingDeck("Name the file as it was saved, for example hello.pptx.")
    folder = (Path.cwd() / "exports").resolve()
    path = (folder / name).resolve()
    if path.parent != folder or not path.is_file():
        raise MissingDeck(
            "Name the file as it was saved, for example hello.pptx."
            if path.parent != folder
            else f"{name} is not a saved PowerPoint."
        )
    source = _source_path(path)
    if not source.is_file():
        raise MissingDeck(
            f"{name} has no saved source, so it cannot be edited. Create it again with create_pptx."
        )
    return path


def _target(name: str) -> Path:
    folder = Path.cwd() / "exports"
    folder.mkdir(exist_ok=True)
    stem = re.sub(r"[^\w\-]+", "-", Path(name).stem.lower(), flags=re.ASCII).strip("-")[
        :60
    ]
    stem = stem or "deck"
    target = folder / f"{stem}.pptx"
    counter = 2
    while target.exists():
        target = folder / f"{stem}-{counter}.pptx"
        counter += 1
    return target


def _today() -> str:
    today = date.today()
    return f"{today.day} {today:%B %Y}"


class PptxDeckPlugin:
    """Designed PowerPoint decks, registered under the name listed in config.toml."""

    name = "pptx_deck"

    def tools(self) -> list[Callable[..., object]]:
        """Return the callables this plugin contributes."""
        return [create_pptx, read_pptx_source, update_pptx]


plugin = PptxDeckPlugin()
