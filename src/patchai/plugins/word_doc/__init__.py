"""Word documents built from blocks the agent describes.

python-docx writes the file with Word's own styles, and it is saved under
``exports/`` in the working directory. The source is stored beside it so a
later turn can revise the same file.
"""

import json
import re
from collections.abc import Callable
from io import BytesIO
from pathlib import Path
from typing import Annotated

from docx import Document as DocxDocument
from pydantic import BaseModel, Field, ValidationError

from patchai.plugins.word_doc.blocks import Block, Document
from patchai.plugins.word_doc.render import render

_FILE_NAME = re.compile(r"^[a-z0-9][a-z0-9_-]{0,70}\.docx$")
_CLEARABLE = frozenset({"subtitle", "author"})


def create_docx(
    title: Annotated[str, Field(min_length=1, max_length=120)],
    blocks: Annotated[
        list[Block],
        Field(min_length=1, max_length=80, description="The document, in order."),
    ],
    subtitle: Annotated[str | None, Field(max_length=200)] = None,
    author: Annotated[str | None, Field(max_length=80)] = None,
    filename: Annotated[str | None, Field(max_length=80)] = None,
) -> str:
    """Create a Word document and save it as a file.

    Use this when the user asks for a Word document, a .docx file, or a
    brief they will open in Word. Write the whole document yourself as
    blocks. The title uses Word's Title style. Blocks are heading,
    paragraph, list, table, quote, code, or page_break. Paragraphs accept
    **bold**, *italic*, `code`, and links. This saves a new file and the
    source beside it. To change a file that already exists, call
    read_docx_source and then update_docx. Returns JSON with the saved path.
    The chat shows a card for that file, so the reply must not repeat the
    filename, the path, or a URL.
    """
    try:
        document = Document(
            title=title.strip(),
            blocks=blocks,
            subtitle=subtitle or None,
            author=author or None,
        )
        docx = render(document)
        target = _target(filename or document.title)
        _publish(target, document, docx)
    except (ValueError, OSError, ValidationError) as exc:
        return f"The Word document could not be built: {exc}"
    return _result(target, docx, document.title)


def read_docx_source(
    filename: Annotated[
        str, Field(description="The saved Word name, such as hello.docx.")
    ],
) -> str:
    """Return the source of a Word document this agent created.

    The source is JSON with the title and the blocks. Call this before
    update_docx when the user wants a change. A file that has no source
    cannot be edited.
    """
    try:
        return _source_path(_existing(filename)).read_text(encoding="utf-8")
    except MissingWord as exc:
        return str(exc)
    except OSError as exc:
        return f"The source could not be read: {exc}"


def update_docx(
    filename: Annotated[
        str,
        Field(description="The saved Word name to overwrite, such as hello.docx."),
    ],
    title: Annotated[str | None, Field(min_length=1, max_length=120)] = None,
    blocks: Annotated[
        list[Block] | None,
        Field(
            min_length=1,
            max_length=80,
            description="The whole document, in order. Replaces every block. Omit to keep the current blocks.",
        ),
    ] = None,
    subtitle: Annotated[
        str | None,
        Field(max_length=200, description="Omit to keep. An empty string removes it."),
    ] = None,
    author: Annotated[
        str | None,
        Field(max_length=80, description="Omit to keep. An empty string removes it."),
    ] = None,
) -> str:
    """Revise a Word document this agent already created, and overwrite that same file.

    Call read_docx_source first and pass its filename. Omit every field that
    should stay as it is. Send blocks only when the body changes, and then
    send the whole document: the list replaces every current block. Pass an
    empty string to remove the subtitle or the author. The filename does not
    change. Returns JSON with the saved path. The chat shows a card for that
    file, so the reply must not repeat the filename, the path, or a URL.
    """
    try:
        target = _existing(filename)
        document = Document.model_validate_json(
            _source_path(target).read_text(encoding="utf-8")
        )
    except MissingWord as exc:
        return str(exc)
    except (OSError, ValidationError, json.JSONDecodeError) as exc:
        return f"The source could not be read: {exc}"
    try:
        document = _merge(
            document,
            title=title,
            blocks=blocks,
            subtitle=subtitle,
            author=author,
        )
        docx = render(document)
        _publish(target, document, docx)
    except (ValueError, OSError, ValidationError) as exc:
        return f"The Word document could not be built: {exc}"
    return _result(target, docx, document.title)


def _merge(document: Document, **changes: object) -> Document:
    """Apply the fields the caller sent. ``None`` keeps the stored value."""
    data = document.model_dump(mode="json")
    for key, value in changes.items():
        if value is None:
            continue
        if key in _CLEARABLE and value == "":
            data[key] = None
            continue
        if key == "blocks" and isinstance(value, list):
            data[key] = [
                item.model_dump(mode="json") if isinstance(item, BaseModel) else item
                for item in value
            ]
            continue
        if key == "title" and isinstance(value, str):
            data[key] = value.strip()
            continue
        data[key] = value
    return Document.model_validate(data)


def _publish(target: Path, document: Document, docx: bytes) -> None:
    """Write the source and then the file, restoring the source if the write fails."""
    target.parent.mkdir(exist_ok=True)
    source = _source_path(target)
    previous = source.read_text(encoding="utf-8") if source.is_file() else None
    file_part = target.with_name(target.name + ".part")
    source_part = source.with_name(source.name + ".part")
    try:
        source_part.write_text(_source_text(document), encoding="utf-8")
        file_part.write_bytes(docx)
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


def _result(target: Path, docx: bytes, title: str) -> str:
    return json.dumps(
        {
            "saved": str(target),
            "filename": target.name,
            "title": title,
            "bytes": len(docx),
            "words": _words(docx),
        }
    )


def _words(docx: bytes) -> int:
    document = DocxDocument(BytesIO(docx))
    chunks = [paragraph.text for paragraph in document.paragraphs]
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                chunks.append(cell.text)
    return len(" ".join(chunks).split())


def _source_text(document: Document) -> str:
    return json.dumps(document.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n"


def _source_path(docx: Path) -> Path:
    return docx.with_name(f"{docx.name}.source.json")


class MissingWord(Exception):
    """The named file is not a Word document this plugin can revise."""


def _existing(filename: str) -> Path:
    name = Path(str(filename)).name
    if not _FILE_NAME.fullmatch(name):
        raise MissingWord("Name the file as it was saved, for example hello.docx.")
    folder = (Path.cwd() / "exports").resolve()
    path = (folder / name).resolve()
    if path.parent != folder or not path.is_file():
        raise MissingWord(
            "Name the file as it was saved, for example hello.docx."
            if path.parent != folder
            else f"{name} is not a saved Word document."
        )
    source = _source_path(path)
    if not source.is_file():
        raise MissingWord(
            f"{name} has no saved source, so it cannot be edited. Create it again with create_docx."
        )
    return path


def _target(name: str) -> Path:
    folder = Path.cwd() / "exports"
    folder.mkdir(exist_ok=True)
    stem = re.sub(r"[^\w\-]+", "-", Path(name).stem.lower(), flags=re.ASCII).strip("-")[
        :60
    ]
    stem = stem or "brief"
    target = folder / f"{stem}.docx"
    counter = 2
    while target.exists():
        target = folder / f"{stem}-{counter}.docx"
        counter += 1
    return target


class WordDocPlugin:
    """Word documents, registered under the name listed in config.toml."""

    name = "word_doc"

    def tools(self) -> list[Callable[..., object]]:
        """Return the callables this plugin contributes."""
        return [create_docx, read_docx_source, update_docx]


plugin = WordDocPlugin()
