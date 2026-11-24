"""The Markdown plugin turns described blocks into a saved file."""

import json
from pathlib import Path

import pytest

from patchai.plugins.markdown_doc import (
    create_markdown,
    read_markdown_source,
    update_markdown,
)
from patchai.plugins.registry import load_enabled

_BLOCKS = [
    {"type": "paragraph", "text": "Apple led the session."},
    {"type": "heading", "text": "Prices", "level": 2},
    {
        "type": "table",
        "columns": ["Symbol", "Price"],
        "rows": [["AAPL", "352.81"], ["NVDA", "153.69"]],
    },
    {"type": "list", "items": ["Hold the brief", "Check the claims"]},
    {"type": "quote", "text": "The count is the story."},
    {"type": "code", "language": "json", "text": '{"claims": 93589}'},
]


def test_create_saves_markdown_and_its_source(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)

    raw = create_markdown(
        "Market snapshot",
        _BLOCKS,
        subtitle="24 November 2026",
        author="PatchAI",
    )

    saved = json.loads(raw)
    path = tmp_path / "exports" / saved["filename"]
    text = path.read_text(encoding="utf-8")
    assert saved["filename"] == "market-snapshot.md"
    assert saved["title"] == "Market snapshot"
    assert saved["words"] == len(text.split())
    assert text.startswith("# Market snapshot")
    assert "24 November 2026" in text
    assert "|Symbol|Price|" in text
    assert "AAPL" in text
    assert "- Hold the brief" in text
    assert "> The count is the story." in text
    assert "```json" in text
    source = json.loads((path.parent / "market-snapshot.md.source.json").read_text())
    assert source["title"] == "Market snapshot"
    assert source["blocks"][0]["text"] == "Apple led the session."


def test_update_rewrites_the_same_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    created = json.loads(create_markdown("Notes", _BLOCKS, subtitle="Stay"))

    revised = json.loads(
        update_markdown(
            created["filename"],
            blocks=[{"type": "paragraph", "text": "The brief is shorter now."}],
            subtitle="",
        )
    )

    text = (tmp_path / "exports" / revised["filename"]).read_text(encoding="utf-8")
    assert revised["filename"] == created["filename"]
    assert "The brief is shorter now." in text
    assert "Stay" not in text
    assert "AAPL" not in text
    source = json.loads(read_markdown_source(created["filename"]))
    assert source["subtitle"] is None
    assert len(source["blocks"]) == 1


def test_a_missing_file_cannot_be_edited(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)

    message = update_markdown("missing.md", title="Nope")

    assert "not a saved Markdown file" in message


def test_a_bad_table_is_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)

    message = create_markdown(
        "Broken",
        [{"type": "table", "columns": ["A", "B"], "rows": [["only-one"]]}],
    )

    assert "could not be built" in message
    assert list((tmp_path / "exports").glob("*.md")) == []


def test_markdown_doc_is_a_plugin() -> None:
    (loaded,) = load_enabled(["markdown_doc"])

    assert loaded.name == "markdown_doc"
    assert loaded.tools() == [create_markdown, read_markdown_source, update_markdown]
