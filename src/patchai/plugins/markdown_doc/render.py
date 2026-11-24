"""Turn a document into Markdown with mdutils.

mdutils owns headings, paragraphs, lists, tables, and fenced code. This
module only chooses which of those calls matches each block.
"""

import re

from mdutils.mdutils import MdUtils

from patchai.plugins.markdown_doc.blocks import (
    Block,
    BulletList,
    Code,
    Document,
    Heading,
    Paragraph,
    Quote,
    Table,
)

_LANGUAGE = re.compile(r"^[A-Za-z0-9#+.-]{1,20}$")


def render(document: Document) -> str:
    """Return the Markdown for one document."""
    title = _single_line(document.title)
    md = MdUtils(file_name="document", title=title, title_header_style="atx")
    # The constructor writes the title, but only new_header records a heading
    # for the contents list. A level-2 heading needs that level-1 entry first.
    md._table_titles.append(title)
    md._table_titles.append([])
    if document.subtitle:
        md.new_paragraph(_single_line(document.subtitle))
    if document.author:
        md.new_paragraph(_single_line(document.author))
    for block in document.blocks:
        _write(md, block)
    if document.table_of_contents:
        md.new_table_of_contents(table_title="Contents", depth=3)
    return (md.title + md.table_of_contents + md.file_data_text).lstrip("\n")


def _write(md: MdUtils, block: Block) -> None:
    if isinstance(block, Heading):
        md.new_header(level=block.level, title=_single_line(block.text), style="atx")
        return
    if isinstance(block, Paragraph):
        md.new_paragraph(block.text.strip())
        return
    if isinstance(block, BulletList):
        items = [_single_line(item) for item in block.items]
        md.new_list(items, marked_with="1" if block.ordered else "-")
        return
    if isinstance(block, Table):
        cells = [_cell(column) for column in block.columns]
        for row in block.rows:
            cells.extend(_cell(cell) for cell in row)
        md.new_table(
            columns=len(block.columns),
            rows=1 + len(block.rows),
            text=cells,
            text_align="left",
        )
        return
    if isinstance(block, Quote):
        quoted = "\n".join(f"> {line}" for line in block.text.strip().splitlines())
        md.new_paragraph(quoted)
        return
    if isinstance(block, Code):
        language = block.language.strip()
        if not _LANGUAGE.fullmatch(language):
            language = ""
        md.insert_code(block.text.replace("```", "``\u200b`"), language)


def _single_line(text: str) -> str:
    return " ".join(text.split())


def _cell(text: str) -> str:
    return _single_line(text).replace("|", "/")
