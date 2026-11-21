"""The PDF plugin turns described blocks into a saved, laid-out document."""

import json
from pathlib import Path

import pytest
from langchain_core.tools import tool
from pydantic import ValidationError

from patchai.plugins.pdf_report import create_pdf, inline, read_pdf_source, update_pdf
from patchai.plugins.pdf_report.blocks import Chart, Paragraph, Table
from patchai.plugins.registry import load_enabled

_PNG = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4"
    "nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg=="
)

_EVERY_BLOCK = [
    {"type": "metrics", "items": [{"label": "Revenue", "value": "$4.2M", "change": "+12%"}]},
    {"type": "heading", "text": "Results", "level": 1},
    {"type": "paragraph", "text": "Sales **rose**.\n\nSee [the source](https://example.com)."},
    {"type": "list", "items": ["One", "Two"], "ordered": True},
    {
        "type": "table",
        "columns": ["Region", "Sales"],
        "rows": [["North", 120], ["South", 80.5]],
        "total": ["Total", 200.5],
        "caption": "Sales by region",
    },
    {
        "type": "chart",
        "kind": "bar",
        "labels": ["Q1", "Q2"],
        "series": [{"name": "2025", "values": [1, 2]}, {"name": "2026", "values": [2, 3]}],
        "caption": "Quarterly sales",
    },
    {
        "type": "chart",
        "kind": "donut",
        "labels": ["A", "B"],
        "series": [{"name": "Mix", "values": [70, 30]}],
    },
    {"type": "image", "source": _PNG, "caption": "A swatch", "width": 30},
    {"type": "callout", "tone": "warning", "title": "Caveat", "text": "Preliminary."},
    {"type": "quote", "text": "Ship it.", "attribution": "Someone"},
    {"type": "code", "code": "print('hi')", "language": "python"},
    {"type": "divider"},
    {"type": "page_break"},
    {"type": "paragraph", "text": "Привет, мир."},
]


def test_inline_markdown_becomes_styled_runs() -> None:
    runs = inline.runs("A **bold [link](https://a.b)** and `code`")

    assert runs[0]["text"] == "A "
    assert runs[1] == {
        "text": "bold ",
        "bold": True,
        "italic": False,
        "strike": False,
        "code": False,
        "link": None,
    }
    assert runs[2]["text"] == "link"
    assert runs[2]["bold"] and runs[2]["link"] == "https://a.b"
    assert runs[-1]["code"] and runs[-1]["text"] == "code"


def test_inline_links_keep_only_web_and_mail_targets() -> None:
    (run,) = inline.runs("[open](javascript:alert`1`)")

    assert run["text"] == "open"
    assert run["link"] is None


def test_paragraphs_split_on_blank_lines_and_break_on_single_newlines() -> None:
    parts = inline.paragraphs("first\nline\n\nsecond")

    assert len(parts) == 2
    assert parts[0][1] == {"break": True}


def test_every_block_kind_renders_a_pdf(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    create = tool(create_pdf)

    reply = json.loads(
        create.invoke(
            {
                "title": "Quarterly review",
                "subtitle": "Sales and outlook",
                "summary": "Sales grew.",
                "cover": True,
                "table_of_contents": True,
                "numbered_headings": True,
                "accent": "teal",
                "blocks": _EVERY_BLOCK,
            }
        )
    )

    saved = Path(reply["saved"])
    assert saved.parent == tmp_path / "exports"
    assert saved.name == "quarterly-review.pdf"
    assert saved.read_bytes().startswith(b"%PDF")
    assert reply["pages"] >= 3
    source = json.loads(saved.with_name("quarterly-review.source.json").read_text(encoding="utf-8"))
    assert source["accent"] == "teal"
    assert source["blocks"][2]["text"].startswith("Sales **rose**.")
    assert "chart-" not in saved.with_name("quarterly-review.source.json").read_text(encoding="utf-8")


def test_a_second_document_with_the_same_name_keeps_the_first(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    blocks = [Table(type="table", columns=["A"], rows=[["1"]])]

    first = json.loads(create_pdf("Notes", blocks))
    second = json.loads(create_pdf("Notes", blocks, filename="notes.pdf"))

    assert first["filename"] == "notes.pdf"
    assert second["filename"] == "notes-2.pdf"


def test_bad_inputs_come_back_as_a_message(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    blocks = [Table(type="table", columns=["A"], rows=[["1"]])]

    assert "Accent must be" in create_pdf("x", blocks, accent="mauve")
    image = [{"type": "image", "source": "file:///etc/passwd"}]
    assert "https URL or a data: URL" in tool(create_pdf).invoke({"title": "x", "blocks": image})
    assert not (tmp_path / "exports").exists()


def test_tables_and_charts_reject_mismatched_shapes() -> None:
    with pytest.raises(ValidationError, match="2 cells"):
        Table(type="table", columns=["A"], rows=[["1", "2"]])
    with pytest.raises(ValidationError, match="exactly one series"):
        Chart(
            type="chart",
            kind="pie",
            labels=["a"],
            series=[{"name": "x", "values": [1]}, {"name": "y", "values": [2]}],
        )
    with pytest.raises(ValidationError, match="numeric labels"):
        Chart(type="chart", kind="scatter", labels=["a"], series=[{"name": "x", "values": [1]}])


def test_an_update_overwrites_the_same_file_and_keeps_omitted_fields(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    created = json.loads(
        create_pdf(
            "Notes",
            [Paragraph(type="paragraph", text="Keep **this**.")],
            subtitle="Stay",
            accent="teal",
        )
    )
    pdf = tmp_path / "exports" / "notes.pdf"
    source_path = tmp_path / "exports" / "notes.source.json"
    before = json.loads(source_path.read_text(encoding="utf-8"))

    updated = json.loads(update_pdf(created["filename"], title="Revised"))

    assert updated["filename"] == "notes.pdf"
    assert updated["title"] == "Revised"
    assert not (tmp_path / "exports" / "notes-2.pdf").exists()
    source = json.loads(source_path.read_text(encoding="utf-8"))
    assert source["title"] == "Revised"
    assert source["subtitle"] == "Stay"
    assert source["accent"] == "teal"
    assert source["date_line"] == before["date_line"]
    assert source["blocks"] == [{"type": "paragraph", "text": "Keep **this**."}]
    assert pdf.read_bytes().startswith(b"%PDF")
    assert "Keep **this**." in read_pdf_source("notes.pdf")


def test_update_through_the_tool_replaces_the_body_and_can_clear_a_field(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    create_pdf("Notes", [Paragraph(type="paragraph", text="Before")], subtitle="Stay")
    revise = tool(update_pdf)

    reply = json.loads(
        revise.invoke(
            {
                "filename": "notes.pdf",
                "subtitle": "",
                "blocks": [{"type": "paragraph", "text": "After"}],
            }
        )
    )

    source = json.loads((tmp_path / "exports" / "notes.source.json").read_text(encoding="utf-8"))
    assert reply["filename"] == "notes.pdf"
    assert source["subtitle"] is None
    assert source["blocks"] == [{"type": "paragraph", "text": "After"}]
    assert "blocks" not in (revise.args_schema.model_json_schema().get("required") or [])


def test_a_failed_update_leaves_the_saved_document(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    create_pdf("Notes", [Paragraph(type="paragraph", text="Before")])
    pdf = tmp_path / "exports" / "notes.pdf"
    source = tmp_path / "exports" / "notes.source.json"
    before_pdf = pdf.read_bytes()
    before_source = source.read_text(encoding="utf-8")

    assert "Accent must be" in update_pdf("notes.pdf", accent="mauve")

    assert pdf.read_bytes() == before_pdf
    assert source.read_text(encoding="utf-8") == before_source
    assert not list((tmp_path / "exports").glob("*.part"))


def test_a_pdf_without_source_cannot_be_revised(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    folder = tmp_path / "exports"
    folder.mkdir()
    (folder / "orphan.pdf").write_bytes(b"%PDF")

    assert "no saved source" in read_pdf_source("orphan.pdf")
    assert "no saved source" in update_pdf("orphan.pdf", title="Revised")
    assert "not a saved PDF" in update_pdf("missing.pdf", title="Revised")
    assert "hello.pdf" in read_pdf_source("../.env")
    assert (folder / "orphan.pdf").read_bytes() == b"%PDF"


def test_pdf_report_is_a_plugin() -> None:
    (loaded,) = load_enabled(["pdf_report"])

    assert loaded.name == "pdf_report"
    assert loaded.tools() == [create_pdf, read_pdf_source, update_pdf]
