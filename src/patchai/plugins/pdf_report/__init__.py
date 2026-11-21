"""Designed PDF documents built from blocks the agent describes.

Typst lays out the pages from a fixed template, matplotlib draws the charts,
and the file is saved under ``exports/`` in the working directory.
"""

import base64
import json
import re
import tempfile
import urllib.error
import urllib.request
from collections.abc import Callable
from datetime import date
from pathlib import Path
from typing import Annotated, Literal

import typst
from pydantic import BaseModel, Field, ValidationError

from patchai.plugins.pdf_report import charts, inline
from patchai.plugins.pdf_report.blocks import (
    Block,
    BulletList,
    Callout,
    Chart,
    Code,
    Divider,
    Document,
    Heading,
    Image,
    Metrics,
    PageBreak,
    Paragraph,
    Quote,
    Table,
)

_TEMPLATE = Path(__file__).with_name("template.typ")
_IMAGE_BYTES = 15_000_000
_ACCENTS = {
    "blue": "#2563eb",
    "indigo": "#4f46e5",
    "violet": "#7c3aed",
    "teal": "#0d9488",
    "green": "#15803d",
    "orange": "#ea580c",
    "red": "#dc2626",
    "slate": "#334155",
}
_SANS = ["Inter", "Segoe UI", "Helvetica Neue", "Arial", "Liberation Sans", "DejaVu Sans"]
_SERIF = ["Libertinus Serif", "Georgia", "Times New Roman"]
_MONO = ["Cascadia Code", "Consolas", "Menlo", "DejaVu Sans Mono"]
_NUMERIC = re.compile(r"^[\s~≈<>(+\-−]*[$€£¥]?\s*\d[\d.,]*\s*(%|[A-Za-z]{1,4})?\)?$")
_FILE_NAME = re.compile(r"^[a-z0-9][a-z0-9_-]{0,70}\.pdf$")
_CLEARABLE = frozenset({"subtitle", "kicker", "author", "summary"})


def create_pdf(
    title: Annotated[str, Field(min_length=1, max_length=160)],
    blocks: Annotated[
        list[Block],
        Field(min_length=1, max_length=400, description="The body, top to bottom."),
    ],
    subtitle: Annotated[str | None, Field(max_length=200)] = None,
    kicker: Annotated[
        str | None,
        Field(max_length=40, description='A short label above the title, e.g. "Quarterly report".'),
    ] = None,
    author: Annotated[str | None, Field(max_length=120)] = None,
    date_line: Annotated[
        str | None,
        Field(max_length=40, description="The date shown on the document. Defaults to today."),
    ] = None,
    summary: Annotated[
        str | None,
        Field(max_length=3000, description="A lead paragraph shown under the title or on the cover."),
    ] = None,
    style: Annotated[
        Literal["modern", "classic"],
        Field(description="modern sets everything in a sans face; classic sets body text in a serif."),
    ] = "modern",
    accent: Annotated[
        str,
        Field(description="blue, indigo, violet, teal, green, orange, red, slate, or a #rrggbb color."),
    ] = "blue",
    cover: Annotated[bool, Field(description="Open with a full cover page. Best for long reports.")] = False,
    table_of_contents: bool = False,
    numbered_headings: bool = False,
    paper: Literal["a4", "us-letter"] = "a4",
    landscape: bool = False,
    language: Annotated[
        str, Field(pattern=r"^[a-z]{2}$", description="ISO 639-1 code of the text, for hyphenation.")
    ] = "en",
    filename: Annotated[str | None, Field(max_length=80)] = None,
) -> str:
    """Create a designed PDF document and save it as a file.

    Use this when the user asks for a PDF, a report, a brief, a handout, or
    any document to download or print. Write the full content yourself as
    blocks: headings, paragraphs, lists, tables, charts drawn from numbers,
    images from URLs, key-figure cards, callouts, quotes, and code. The
    layout, fonts, colors, page numbers, and figure numbering come from the
    template, so only describe content. This saves a new file and the source
    beside it. To change a file that already exists, call read_pdf_source and
    then update_pdf. Returns JSON with the saved path. The chat shows a card
    for that file, so the reply must not repeat the filename, the path, or a URL.
    """
    try:
        document = Document(
            title=title.strip(),
            blocks=blocks,
            subtitle=subtitle or None,
            kicker=kicker or None,
            author=author or None,
            date_line=date_line or _today(),
            summary=summary or None,
            style=style,
            accent=accent,
            cover=cover,
            table_of_contents=table_of_contents,
            numbered_headings=numbered_headings,
            paper=paper,
            landscape=landscape,
            language=language,
        )
        pdf = _compile(document)
        target = _target(filename or document.title)
        _publish(target, document, pdf)
    except (ValueError, OSError, RuntimeError, typst.TypstError, ValidationError) as exc:
        return f"The PDF could not be built: {exc}"
    return _result(target, pdf, document.title)


def read_pdf_source(
    filename: Annotated[str, Field(description="The saved PDF name, such as hello.pdf.")],
) -> str:
    """Return the source of a PDF this agent created.

    The source is JSON with the title, the blocks, and the document fields.
    Call this before update_pdf when the user wants a change. A PDF that has
    no source file cannot be edited.
    """
    try:
        return _source_path(_existing_pdf(filename)).read_text(encoding="utf-8")
    except MissingDocument as exc:
        return str(exc)
    except OSError as exc:
        return f"The source could not be read: {exc}"


def update_pdf(
    filename: Annotated[
        str,
        Field(description="The saved PDF name to overwrite, such as hello.pdf."),
    ],
    title: Annotated[str | None, Field(min_length=1, max_length=160)] = None,
    blocks: Annotated[
        list[Block] | None,
        Field(
            min_length=1,
            max_length=400,
            description="The whole body, top to bottom. Replaces every block. Omit to keep the current body.",
        ),
    ] = None,
    subtitle: Annotated[
        str | None,
        Field(max_length=200, description="Omit to keep. An empty string removes it."),
    ] = None,
    kicker: Annotated[
        str | None,
        Field(max_length=40, description="Omit to keep. An empty string removes it."),
    ] = None,
    author: Annotated[
        str | None,
        Field(max_length=120, description="Omit to keep. An empty string removes it."),
    ] = None,
    date_line: Annotated[
        str | None,
        Field(min_length=1, max_length=40, description="Omit to keep the date already on the document."),
    ] = None,
    summary: Annotated[
        str | None,
        Field(max_length=3000, description="Omit to keep. An empty string removes it."),
    ] = None,
    style: Literal["modern", "classic"] | None = None,
    accent: Annotated[
        str | None,
        Field(description="Omit to keep. blue, indigo, violet, teal, green, orange, red, slate, or #rrggbb."),
    ] = None,
    cover: bool | None = None,
    table_of_contents: bool | None = None,
    numbered_headings: bool | None = None,
    paper: Literal["a4", "us-letter"] | None = None,
    landscape: bool | None = None,
    language: Annotated[
        str | None,
        Field(pattern=r"^[a-z]{2}$", description="Omit to keep. ISO 639-1 code of the text."),
    ] = None,
) -> str:
    """Revise a PDF this agent already created, and overwrite that same file.

    Call read_pdf_source first and pass its filename. Omit every field that
    should stay as it is. Send blocks only when the body changes, and then
    send the whole body: the list replaces every current block. Pass an empty
    string to remove the subtitle, kicker, author, or summary. The filename
    does not change. Returns JSON with the saved path. The chat shows a card
    for that file, so the reply must not repeat the filename, the path, or a URL.
    """
    try:
        target = _existing_pdf(filename)
        document = Document.model_validate_json(_source_path(target).read_text(encoding="utf-8"))
    except MissingDocument as exc:
        return str(exc)
    except (OSError, ValidationError, json.JSONDecodeError) as exc:
        return f"The source could not be read: {exc}"
    try:
        document = _merge(
            document,
            title=title,
            blocks=blocks,
            subtitle=subtitle,
            kicker=kicker,
            author=author,
            date_line=date_line,
            summary=summary,
            style=style,
            accent=accent,
            cover=cover,
            table_of_contents=table_of_contents,
            numbered_headings=numbered_headings,
            paper=paper,
            landscape=landscape,
            language=language,
        )
        pdf = _compile(document)
        _publish(target, document, pdf)
    except (ValueError, OSError, RuntimeError, typst.TypstError, ValidationError) as exc:
        return f"The PDF could not be built: {exc}"
    return _result(target, pdf, document.title)


def _compile(document: Document) -> bytes:
    """Draw ``document`` with the fixed template and return the PDF bytes."""
    color = _accent(document.accent)
    with tempfile.TemporaryDirectory(prefix="patchai-pdf-") as folder:
        root = Path(folder)
        author = document.author
        laid_out = {
            "title": document.title,
            "subtitle": document.subtitle,
            "kicker": document.kicker,
            "author": author,
            "authors": [author] if author else [],
            "date": document.date_line,
            "meta": " · ".join(part for part in (author, document.date_line) if part),
            "summary": inline.paragraphs(document.summary) if document.summary else None,
            "accent": color,
            "fonts": {
                "body": _SANS if document.style == "modern" else _SERIF,
                "heading": _SANS,
                "mono": _MONO,
            },
            "lang": document.language,
            "paper": document.paper,
            "landscape": document.landscape,
            "cover": document.cover,
            "contents": document.table_of_contents,
            "numbered": document.numbered_headings,
            "blocks": [
                _layout(block, index, root, color) for index, block in enumerate(document.blocks)
            ],
        }
        (root / "document.json").write_text(json.dumps(laid_out), encoding="utf-8")
        (root / "main.typ").write_text(_TEMPLATE.read_text(encoding="utf-8"), encoding="utf-8")
        return typst.compile(str(root / "main.typ"), root=str(root))


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
                item.model_dump(mode="json") if isinstance(item, BaseModel) else item for item in value
            ]
            continue
        if key == "title" and isinstance(value, str):
            data[key] = value.strip()
            continue
        data[key] = value
    return Document.model_validate(data)


def _publish(target: Path, document: Document, pdf: bytes) -> None:
    """Write the source and then the PDF, restoring the source if the PDF write fails."""
    target.parent.mkdir(exist_ok=True)
    source = _source_path(target)
    previous = source.read_text(encoding="utf-8") if source.is_file() else None
    pdf_part = target.with_name(target.name + ".part")
    source_part = source.with_name(source.name + ".part")
    try:
        source_part.write_text(_source_text(document), encoding="utf-8")
        pdf_part.write_bytes(pdf)
        source_part.replace(source)
        pdf_part.replace(target)
    except Exception:
        if source.is_file() and previous is None:
            source.unlink()
        elif previous is not None:
            source.write_text(previous, encoding="utf-8")
        raise
    finally:
        pdf_part.unlink(missing_ok=True)
        source_part.unlink(missing_ok=True)


def _result(target: Path, pdf: bytes, title: str) -> str:
    return json.dumps(
        {
            "saved": str(target),
            "filename": target.name,
            "title": title,
            "bytes": len(pdf),
            "pages": _page_count(pdf),
        }
    )


def _source_text(document: Document) -> str:
    return json.dumps(document.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n"


def _source_path(pdf: Path) -> Path:
    return pdf.with_name(f"{pdf.stem}.source.json")


class MissingDocument(Exception):
    """The named file is not a PDF this plugin can revise."""


def _existing_pdf(filename: str) -> Path:
    name = Path(str(filename)).name
    if not _FILE_NAME.fullmatch(name):
        raise MissingDocument("Name the file as it was saved, for example hello.pdf.")
    folder = (Path.cwd() / "exports").resolve()
    path = (folder / name).resolve()
    if path.parent != folder or not path.is_file():
        raise MissingDocument(
            "Name the file as it was saved, for example hello.pdf."
            if path.parent != folder
            else f"{name} is not a saved PDF."
        )
    source = _source_path(path)
    if not source.is_file():
        raise MissingDocument(
            f"{name} has no saved source, so it cannot be edited. Create it again with create_pdf."
        )
    return path


def _layout(block: Block, index: int, root: Path, color: str) -> dict[str, object]:
    """The JSON the template draws for one block."""
    if isinstance(block, Heading):
        return {"type": "heading", "level": block.level, "text": inline.runs(block.text)}
    if isinstance(block, Paragraph):
        return {"type": "paragraph", "paragraphs": inline.paragraphs(block.text)}
    if isinstance(block, BulletList):
        return {
            "type": "list",
            "ordered": block.ordered,
            "items": [inline.runs(item) for item in block.items],
        }
    if isinstance(block, Table):
        return _table(block)
    if isinstance(block, Chart):
        name = f"chart-{index}.svg"
        (root / name).write_bytes(charts.draw(block, color))
        return _figure(name, 100, block.caption)
    if isinstance(block, Image):
        name = f"image-{index}.{_fetch_image(block.source, root, index)}"
        return _figure(name, block.width, block.caption)
    if isinstance(block, Metrics):
        return {
            "type": "metrics",
            "items": [
                {
                    "label": item.label,
                    "value": item.value,
                    "change": item.change,
                    "trend": item.trend or _trend(item.change),
                }
                for item in block.items
            ],
        }
    if isinstance(block, Callout):
        return {
            "type": "callout",
            "tone": block.tone,
            "title": block.title,
            "paragraphs": inline.paragraphs(block.text),
        }
    if isinstance(block, Quote):
        return {
            "type": "quote",
            "paragraphs": inline.paragraphs(block.text),
            "attribution": block.attribution,
        }
    if isinstance(block, Code):
        return {"type": "code", "code": block.code.rstrip(), "language": block.language}
    if isinstance(block, Divider):
        return {"type": "divider"}
    if isinstance(block, PageBreak):
        return {"type": "page_break"}
    raise ValueError(f"Unknown block {block!r}")


def _table(table: Table) -> dict[str, object]:
    texts = [[_cell(cell) for cell in row] for row in table.rows]
    totals = [_cell(cell) for cell in table.total] if table.total else None
    widths: list[float] = []
    align: list[str] = []
    for column, name in enumerate(table.columns):
        values = [row[column] for row in texts if row[column]]
        numeric = bool(values) and all(_NUMERIC.match(value) for value in values)
        align.append("right" if numeric else "left")
        longest = max([len(name), *(len(value) for value in values)])
        average = sum(map(len, values)) / len(values) if values else len(name)
        widths.append(round(max(1.0, min(average * 1.2 + 2, longest, 40.0)), 2))
    return {
        "type": "table",
        "columns": table.columns,
        "rows": [[inline.runs(cell) for cell in row] for row in texts],
        "total": [inline.runs(cell) for cell in totals] if totals else None,
        "caption": inline.runs(table.caption) if table.caption else None,
        "widths": widths,
        "align": align,
    }


def _figure(path: str, width: int, caption: str | None) -> dict[str, object]:
    return {
        "type": "figure",
        "path": path,
        "width": width,
        "caption": inline.runs(caption) if caption else None,
    }


def _cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        return f"{value:,.2f}".rstrip("0").rstrip(".") if not value.is_integer() else f"{int(value)}"
    return str(value)


def _trend(change: str | None) -> str:
    if not change:
        return "flat"
    sign = change.strip()[:1]
    return "down" if sign in "-−" else "up" if sign == "+" else "flat"


def _accent(value: str) -> str:
    name = value.strip().lower()
    if name in _ACCENTS:
        return _ACCENTS[name]
    if re.fullmatch(r"#[0-9a-f]{6}", name):
        return name
    raise ValueError(f"Accent must be one of {', '.join(_ACCENTS)} or a #rrggbb color.")


def _fetch_image(source: str, root: Path, index: int) -> str:
    """Save the image for block ``index`` into ``root`` and return its extension."""
    if source.startswith("data:"):
        header, _, payload = source.partition(",")
        if ";base64" not in header:
            raise ValueError(f"Image {index + 1} must be a base64 data URL.")
        data = base64.b64decode(payload, validate=False)
    elif re.match(r"(?i)^https?://", source):
        request = urllib.request.Request(source, headers={"User-Agent": "PatchAI"})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                data = response.read(_IMAGE_BYTES + 1)
        except (urllib.error.URLError, TimeoutError) as exc:
            raise ValueError(f"Image {index + 1} could not be downloaded: {exc}") from exc
    else:
        raise ValueError(f"Image {index + 1} must be an https URL or a data: URL.")
    if len(data) > _IMAGE_BYTES:
        raise ValueError(f"Image {index + 1} is larger than 15 MB.")
    extension = _image_kind(data)
    if extension is None:
        raise ValueError(f"Image {index + 1} is not a PNG, JPEG, GIF, WebP, or SVG file.")
    (root / f"image-{index}.{extension}").write_bytes(data)
    return extension


def _image_kind(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG"):
        return "png"
    if data.startswith(b"\xff\xd8"):
        return "jpg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    head = data[:1024].lstrip().lower()
    if head.startswith(b"<svg") or (head.startswith(b"<?xml") and b"<svg" in head):
        return "svg"
    return None


def _target(name: str) -> Path:
    folder = Path.cwd() / "exports"
    folder.mkdir(exist_ok=True)
    stem = re.sub(r"[^\w\-]+", "-", Path(name).stem.lower(), flags=re.ASCII).strip("-")[:60]
    stem = stem or "document"
    target = folder / f"{stem}.pdf"
    counter = 2
    while target.exists():
        target = folder / f"{stem}-{counter}.pdf"
        counter += 1
    return target


def _today() -> str:
    today = date.today()
    return f"{today.day} {today:%B %Y}"


def _page_count(pdf: bytes) -> int | None:
    found = re.findall(rb"/Type\s*/Pages\b[^>]*?/Count\s+(\d+)", pdf)
    found += re.findall(rb"/Count\s+(\d+)[^>]*?/Type\s*/Pages\b", pdf)
    return max(map(int, found)) if found else None


class PdfReportPlugin:
    """Designed PDF documents, registered under the name listed in config.toml."""

    name = "pdf_report"

    def tools(self) -> list[Callable[..., object]]:
        """Return the callables this plugin contributes."""
        return [create_pdf, read_pdf_source, update_pdf]


plugin = PdfReportPlugin()
