"""The blocks a Word document is built from, checked before it is written.

Each class docstring and field description becomes part of the tool schema
the model reads, so they describe what the reader of the document will see.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _Block(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Heading(_Block):
    """A section title. Level 1 is a section, 2 a subsection, 3 a smaller heading.
    The document title is already the title of the file."""

    type: Literal["heading"]
    text: str = Field(min_length=1, max_length=200)
    level: int = Field(default=1, ge=1, le=3)


class Paragraph(_Block):
    """Body text. Write Markdown inline: **bold**, *italic*, `code`, and
    [links](https://example.com). A blank line starts a new paragraph."""

    type: Literal["paragraph"]
    text: str = Field(min_length=1, max_length=20_000)


class BulletList(_Block):
    """A bulleted list, or a numbered one when ordered is true. Items accept
    the same inline Markdown as paragraphs."""

    type: Literal["list"]
    items: list[str] = Field(min_length=1, max_length=40)
    ordered: bool = False


class Table(_Block):
    """A table. columns is the header row. Each row has one cell per column.
    Cells are plain text."""

    type: Literal["table"]
    columns: list[str] = Field(min_length=1, max_length=8)
    rows: list[list[str]] = Field(min_length=1, max_length=40)

    @model_validator(mode="after")
    def same_width(self) -> "Table":
        width = len(self.columns)
        for row in self.rows:
            if len(row) != width:
                raise ValueError("Each table row must have one cell per column.")
        return self


class Quote(_Block):
    """A short quotation, set off from the body in Word's quote style."""

    type: Literal["quote"]
    text: str = Field(min_length=1, max_length=2_000)


class Code(_Block):
    """A monospace block. language is a short name such as python or json.
    The name is kept in the source; the page shows the code itself."""

    type: Literal["code"]
    text: str = Field(min_length=1, max_length=20_000)
    language: str = Field(default="", max_length=20)


class PageBreak(_Block):
    """Start the following blocks on a new page."""

    type: Literal["page_break"]


Block = Heading | Paragraph | BulletList | Table | Quote | Code | PageBreak


class Document(BaseModel):
    """One Word file: a title and the blocks under it."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)
    blocks: list[Block] = Field(min_length=1, max_length=80)
    subtitle: str | None = Field(default=None, max_length=200)
    author: str | None = Field(default=None, max_length=80)
