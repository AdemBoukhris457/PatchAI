"""The Word plugin turns described blocks into a saved document."""

import json
from io import BytesIO
from pathlib import Path

import pytest
from docx import Document

from patchai.plugins.registry import load_enabled
from patchai.plugins.word_doc import create_docx, read_docx_source, update_docx

_BLOCKS = [
    {"type": "paragraph", "text": "Apple **led** the session. See [Apple](https://apple.com)."},
    {"type": "heading", "text": "Prices", "level": 1},
    {
        "type": "table",
        "columns": ["Symbol", "Price"],
        "rows": [["AAPL", "352.81"], ["NVDA", "153.69"]],
    },
    {"type": "list", "items": ["Hold the brief", "Check the claims"]},
    {"type": "quote", "text": "The count is the story."},
    {"type": "page_break"},
    {"type": "code", "language": "json", "text": '{"claims": 93589}'},
]


def _style(paragraph) -> str:
    name = paragraph.style.name if paragraph.style is not None else ""
    return name or ""


def test_create_saves_a_word_file_and_its_source(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)

    raw = create_docx(
        "Market snapshot",
        _BLOCKS,
        subtitle="24 November 2026",
        author="PatchAI",
    )

    saved = json.loads(raw)
    path = tmp_path / "exports" / saved["filename"]
    document = Document(BytesIO(path.read_bytes()))
    styles = [_style(paragraph) for paragraph in document.paragraphs]
    assert saved["filename"] == "market-snapshot.docx"
    assert saved["title"] == "Market snapshot"
    assert saved["words"] > 0
    assert document.core_properties.title == "Market snapshot"
    assert document.core_properties.author == "PatchAI"
    assert "Title" in styles
    assert "Subtitle" in styles
    assert "Heading 1" in styles
    assert "List Bullet" in styles
    assert "Intense Quote" in styles
    assert any(run.bold for paragraph in document.paragraphs for run in paragraph.runs)
    link = next(
        hyperlink
        for paragraph in document.paragraphs
        for hyperlink in paragraph.hyperlinks
    )
    assert link.address == "https://apple.com"
    assert document.tables[0].rows[1].cells[0].text == "AAPL"
    assert document.tables[0].rows[0].cells[0].paragraphs[0].runs[0].bold
    assert document.element.body.xml.count('w:type="page"') == 1
    assert "PAGE" in document.sections[0].footer.paragraphs[0]._p.xml
    assert document.sections[0].header.paragraphs[0].text == "Market snapshot"
    source = json.loads((path.parent / "market-snapshot.docx.source.json").read_text())
    assert source["blocks"][0]["text"].startswith("Apple")


def test_update_rewrites_the_same_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    created = json.loads(create_docx("Notes", _BLOCKS, subtitle="Stay"))

    revised = json.loads(
        update_docx(
            created["filename"],
            blocks=[{"type": "paragraph", "text": "The brief is shorter now."}],
            subtitle="",
        )
    )

    document = Document(BytesIO((tmp_path / "exports" / revised["filename"]).read_bytes()))
    text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    assert revised["filename"] == created["filename"]
    assert "The brief is shorter now." in text
    assert "Stay" not in text
    assert "AAPL" not in text
    source = json.loads(read_docx_source(created["filename"]))
    assert source["subtitle"] is None
    assert len(source["blocks"]) == 1


def test_a_missing_file_cannot_be_edited(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)

    message = update_docx("missing.docx", title="Nope")

    assert "not a saved Word document" in message


def test_a_bad_table_is_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)

    message = create_docx(
        "Broken",
        [{"type": "table", "columns": ["A", "B"], "rows": [["only-one"]]}],
    )

    assert "could not be built" in message
    assert list((tmp_path / "exports").glob("*.docx")) == []


def test_word_doc_is_a_plugin() -> None:
    (loaded,) = load_enabled(["word_doc"])

    assert loaded.name == "word_doc"
    assert loaded.tools() == [create_docx, read_docx_source, update_docx]
