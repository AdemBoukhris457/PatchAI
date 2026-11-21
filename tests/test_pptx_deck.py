"""The PowerPoint plugin turns described slides into a saved deck."""

import json
from pathlib import Path

import pytest
from langchain_core.tools import tool
from pptx import Presentation

from patchai.plugins.pptx_deck import create_pptx, read_pptx_source, update_pptx
from patchai.plugins.registry import load_enabled

_DECK = [
    {
        "type": "cover",
        "title": "Juniper and Co.",
        "kicker": "2025",
        "subtitle": "A short review",
    },
    {
        "type": "chart",
        "title": "Revenue rose through the year",
        "caption": "Each quarter cleared the one before it.",
        "kind": "bar",
        "categories": ["Q1", "Q2", "Q3"],
        "series": [{"name": "Revenue", "values": [3, 4, 5]}],
        "source": "Company accounts",
        "notes": "Start with the shape, then the number.",
    },
    {
        "type": "table",
        "title": "Where it came from",
        "columns": ["Channel", "Share"],
        "rows": [["Stores", "60%"], ["Wholesale", 40]],
    },
    {"type": "close", "title": "Keep the gain", "items": ["Hold the margin"]},
]


def _words(slide) -> str:
    return "\n".join(
        shape.text_frame.text for shape in slide.shapes if shape.has_text_frame
    )


def test_create_saves_a_deck_and_its_source(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)

    reply = json.loads(
        create_pptx("Juniper and Co.", _DECK, accent="teal", author="Ada")
    )

    folder = tmp_path / "exports"
    pptx = folder / "juniper-and-co.pptx"
    source = json.loads(
        (folder / "juniper-and-co.source.json").read_text(encoding="utf-8")
    )
    deck = Presentation(pptx)
    assert reply["filename"] == "juniper-and-co.pptx"
    assert reply["title"] == "Juniper and Co."
    assert reply["slides"] == 4
    assert pptx.read_bytes().startswith(b"PK")
    assert source["accent"] == "teal"
    assert source["author"] == "Ada"
    assert len(deck.slides) == 4
    assert "Juniper and Co." in _words(deck.slides[0])
    cover = next(
        shape
        for shape in deck.slides[0].shapes
        if shape.has_text_frame and "Juniper" in shape.text_frame.text
    )
    assert cover.text_frame.paragraphs[0].font.name == "Georgia"
    assert any(shape.has_chart for shape in deck.slides[1].shapes)
    assert "Company accounts" in _words(deck.slides[1])
    assert "Start with the shape" in deck.slides[1].notes_slide.notes_text_frame.text


def test_update_keeps_omitted_slides_and_can_clear_a_field(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    create_pptx("Notes", _DECK, subtitle="Stay", accent="teal")
    before = json.loads(
        (tmp_path / "exports" / "notes.source.json").read_text(encoding="utf-8")
    )

    reply = json.loads(update_pptx("notes.pptx", subtitle=""))

    source = json.loads(
        (tmp_path / "exports" / "notes.source.json").read_text(encoding="utf-8")
    )
    assert reply["filename"] == "notes.pptx"
    assert source["subtitle"] is None
    assert source["accent"] == "teal"
    assert source["date_line"] == before["date_line"]
    assert source["slides"] == before["slides"]


def test_update_through_the_tool_replaces_the_deck(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    create_pptx("Notes", [{"type": "cover", "title": "Before"}], subtitle="Stay")
    revise = tool(update_pptx)

    reply = json.loads(
        revise.invoke(
            {
                "filename": "notes.pptx",
                "subtitle": "",
                "slides": [
                    {"type": "statement", "title": "After", "body": "The new claim."}
                ],
            }
        )
    )

    source = json.loads(
        (tmp_path / "exports" / "notes.source.json").read_text(encoding="utf-8")
    )
    deck = Presentation(tmp_path / "exports" / "notes.pptx")
    assert reply["filename"] == "notes.pptx"
    assert reply["slides"] == 1
    assert source["subtitle"] is None
    assert source["slides"][0]["type"] == "statement"
    assert "After" in _words(deck.slides[0])
    assert "slides" not in (
        revise.args_schema.model_json_schema().get("required") or []
    )


def test_a_failed_update_leaves_the_saved_deck(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    create_pptx("Notes", [{"type": "cover", "title": "Before"}])
    pptx = tmp_path / "exports" / "notes.pptx"
    source = tmp_path / "exports" / "notes.source.json"
    before_pptx = pptx.read_bytes()
    before_source = source.read_text(encoding="utf-8")

    assert "Accent must be" in update_pptx("notes.pptx", accent="mauve")

    assert pptx.read_bytes() == before_pptx
    assert source.read_text(encoding="utf-8") == before_source
    assert not list((tmp_path / "exports").glob("*.part"))


def test_a_deck_without_source_cannot_be_revised(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    folder = tmp_path / "exports"
    folder.mkdir()
    (folder / "orphan.pptx").write_bytes(b"PK")

    assert "no saved source" in read_pptx_source("orphan.pptx")
    assert "no saved source" in update_pptx("orphan.pptx", title="Revised")
    assert "not a saved PowerPoint" in update_pptx("missing.pptx", title="Revised")
    assert "hello.pptx" in read_pptx_source("../.env")
    assert (folder / "orphan.pptx").read_bytes() == b"PK"


def test_pptx_deck_is_a_plugin() -> None:
    (loaded,) = load_enabled(["pptx_deck"])

    assert loaded.name == "pptx_deck"
    assert loaded.tools() == [create_pptx, read_pptx_source, update_pptx]
