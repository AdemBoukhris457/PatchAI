"""Turn a document into a Word file with python-docx.

The default template owns the styles, so a heading, a list, a table, and a
quote are the styles Word itself ships. This module only chooses which of
those styles matches each block.
"""

from docx import Document as DocxDocument
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor
from docx.text.paragraph import Paragraph

from patchai.plugins.pdf_report import inline
from patchai.plugins.word_doc.blocks import (
    Block,
    BulletList,
    Code,
    Document,
    Heading,
    PageBreak,
    Paragraph as ParagraphBlock,
    Quote,
    Table,
)

_LINK = RGBColor(0x05, 0x63, 0xC1)
_MUTED = RGBColor(0x6B, 0x72, 0x80)


def render(document: Document) -> bytes:
    """Return the .docx bytes for one document."""
    docx = DocxDocument()
    title = _single_line(document.title)
    docx.core_properties.title = title
    if document.author:
        docx.core_properties.author = _single_line(document.author)
    if document.subtitle:
        docx.core_properties.subject = _single_line(document.subtitle)
    _chrome(docx, title)
    docx.add_heading(title, level=0)
    if document.subtitle:
        docx.add_paragraph(_single_line(document.subtitle), style="Subtitle")
    if document.author:
        byline = docx.add_paragraph()
        run = byline.add_run(_single_line(document.author))
        run.italic = True
        run.font.color.rgb = _MUTED
        run.font.size = Pt(11)
    for block in document.blocks:
        _write(docx, block)
    return _bytes(docx)


def _chrome(docx: DocxDocument, title: str) -> None:
    """A running title from the second page, and a page number on every page."""
    section = docx.sections[0]
    section.different_first_page_header_footer = True
    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = header.add_run(title)
    run.font.size = Pt(9)
    run.font.color.rgb = _MUTED
    _page_number(section.footer.paragraphs[0])
    _page_number(section.first_page_footer.paragraphs[0])


def _page_number(paragraph: Paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run()
    run.font.size = Pt(9)
    run.font.color.rgb = _MUTED
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instruction = OxmlElement("w:instrText")
    instruction.set(qn("xml:space"), "preserve")
    instruction.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instruction)
    run._r.append(end)


def _write(docx: DocxDocument, block: Block) -> None:
    if isinstance(block, Heading):
        docx.add_heading(_single_line(block.text), level=block.level)
        return
    if isinstance(block, ParagraphBlock):
        _write_runs(docx.add_paragraph(), block.text.strip())
        return
    if isinstance(block, BulletList):
        style = "List Number" if block.ordered else "List Bullet"
        for item in block.items:
            _write_runs(docx.add_paragraph(style=style), item)
        return
    if isinstance(block, Table):
        _table(docx, block)
        return
    if isinstance(block, Quote):
        _write_runs(docx.add_paragraph(style="Intense Quote"), block.text.strip())
        return
    if isinstance(block, Code):
        _code(docx, block)
        return
    if isinstance(block, PageBreak):
        docx.add_page_break()


def _table(docx: DocxDocument, block: Table) -> None:
    table = docx.add_table(rows=1, cols=len(block.columns))
    table.style = "Table Grid"
    header = table.rows[0].cells
    for index, column in enumerate(block.columns):
        paragraph = header[index].paragraphs[0]
        paragraph.clear()
        run = paragraph.add_run(_single_line(column))
        run.bold = True
    for row in block.rows:
        cells = table.add_row().cells
        for index, value in enumerate(row):
            cells[index].text = _single_line(value)


def _code(docx: DocxDocument, block: Code) -> None:
    paragraph = docx.add_paragraph()
    _shade(paragraph, "F4F4F5")
    lines = block.text.strip("\n").split("\n")
    for index, line in enumerate(lines):
        run = paragraph.add_run(line)
        run.font.name = "Consolas"
        run.font.size = Pt(10)
        if index < len(lines) - 1:
            run.add_break()


def _write_runs(paragraph: Paragraph, text: str) -> None:
    for piece in inline.runs(text):
        if piece.get("break"):
            paragraph.add_run().add_break()
            continue
        content = str(piece["text"])
        link = piece.get("link")
        if isinstance(link, str):
            _link(
                paragraph,
                content,
                link,
                bold=bool(piece["bold"]),
                italic=bool(piece["italic"]),
            )
            continue
        run = paragraph.add_run(content)
        if piece["bold"]:
            run.bold = True
        if piece["italic"]:
            run.italic = True
        if piece["strike"]:
            run.font.strike = True
        if piece["code"]:
            run.font.name = "Consolas"
            run.font.size = Pt(10)


def _link(paragraph: Paragraph, text: str, url: str, *, bold: bool, italic: bool) -> None:
    relation = paragraph.part.relate_to(url, RT.HYPERLINK, is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), relation)
    run = paragraph.add_run(text)
    run.bold = True if bold else None
    run.italic = True if italic else None
    run.underline = True
    run.font.color.rgb = _LINK
    hyperlink.append(run._r)
    paragraph._p.append(hyperlink)


def _shade(paragraph: Paragraph, fill: str) -> None:
    shading = OxmlElement("w:shd")
    shading.set(qn("w:val"), "clear")
    shading.set(qn("w:color"), "auto")
    shading.set(qn("w:fill"), fill)
    paragraph._p.get_or_add_pPr().append(shading)


def _bytes(docx: DocxDocument) -> bytes:
    from io import BytesIO

    buffer = BytesIO()
    docx.save(buffer)
    return buffer.getvalue()


def _single_line(text: str) -> str:
    return " ".join(text.split())
