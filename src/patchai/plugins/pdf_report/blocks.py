"""The blocks a PDF is built from, checked before anything is drawn.

Each class docstring and field description becomes part of the tool schema
the model reads, so they describe what the reader of the PDF will see.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Cell = str | int | float | None


class _Block(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Heading(_Block):
    """A section title. Level 1 is a chapter, 2 a section, 3 a subsection."""

    type: Literal["heading"]
    text: str = Field(min_length=1, max_length=200)
    level: int = Field(default=1, ge=1, le=3)


class Paragraph(_Block):
    """Body text. Supports **bold**, *italic*, `code`, ~~strike~~ and
    [links](https://example.com). A blank line starts a new paragraph."""

    type: Literal["paragraph"]
    text: str = Field(min_length=1, max_length=20_000)


class BulletList(_Block):
    """A bulleted list, or a numbered one when ordered is true. Items accept
    the same inline markdown as paragraphs."""

    type: Literal["list"]
    items: list[str] = Field(min_length=1, max_length=200)
    ordered: bool = False


class Table(_Block):
    """A data table with a colored header row that repeats on every page.
    Numeric columns are right-aligned automatically."""

    type: Literal["table"]
    columns: list[str] = Field(min_length=1, max_length=12)
    rows: list[list[Cell]] = Field(min_length=1, max_length=2000)
    total: list[Cell] | None = Field(
        default=None,
        description="A closing row drawn in bold under a rule, such as totals.",
    )
    caption: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def _rows_match_columns(self) -> "Table":
        width = len(self.columns)
        for index, row in enumerate(self.rows):
            if len(row) != width:
                raise ValueError(
                    f"Row {index + 1} has {len(row)} cells; the table has {width} columns."
                )
        if self.total is not None and len(self.total) != width:
            raise ValueError(f"The total row needs {width} cells.")
        return self


class Series(BaseModel):
    """One named set of values, one value per label."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)
    values: list[float] = Field(min_length=1, max_length=500)


class Chart(_Block):
    """A chart drawn from numbers. bar and horizontal_bar group several
    series side by side; stacked_bar and stacked_area stack them. pie and
    donut take exactly one series of non-negative values. scatter needs
    numeric labels, used as the x values."""

    type: Literal["chart"]
    kind: Literal[
        "bar",
        "horizontal_bar",
        "stacked_bar",
        "line",
        "area",
        "stacked_area",
        "pie",
        "donut",
        "scatter",
    ]
    labels: list[str | float] = Field(
        min_length=1,
        max_length=500,
        description="The category or x value of each point.",
    )
    series: list[Series] = Field(min_length=1, max_length=8)
    caption: str | None = Field(default=None, max_length=300)
    x_label: str | None = Field(default=None, max_length=80)
    y_label: str | None = Field(default=None, max_length=80)
    prefix: str = Field(default="", max_length=4, description='Value prefix, e.g. "$".')
    suffix: str = Field(default="", max_length=6, description='Value suffix, e.g. "%".')

    @model_validator(mode="after")
    def _shape(self) -> "Chart":
        for series in self.series:
            if len(series.values) != len(self.labels):
                raise ValueError(
                    f"Series '{series.name}' has {len(series.values)} values "
                    f"for {len(self.labels)} labels."
                )
        if self.kind in ("pie", "donut"):
            if len(self.series) != 1:
                raise ValueError("A pie or donut chart takes exactly one series.")
            if any(value < 0 for value in self.series[0].values):
                raise ValueError("A pie or donut chart cannot show negative values.")
            if not any(self.series[0].values):
                raise ValueError("A pie or donut chart needs at least one value above 0.")
        if self.kind == "scatter" and not all(
            isinstance(label, (int, float)) for label in self.labels
        ):
            raise ValueError("A scatter chart needs numeric labels for the x axis.")
        return self


class Image(_Block):
    """A picture from an https URL or a data: URL. PNG, JPEG, GIF, WebP and
    SVG are supported."""

    type: Literal["image"]
    source: str = Field(min_length=8)
    caption: str | None = Field(default=None, max_length=300)
    width: int = Field(default=100, ge=20, le=100, description="Percent of the text width.")


class Metric(BaseModel):
    """One key figure."""

    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=40)
    value: str = Field(min_length=1, max_length=24, description='Already formatted, e.g. "$4.2M".')
    change: str | None = Field(default=None, max_length=24, description='e.g. "+12% vs 2025".')
    trend: Literal["up", "down", "flat"] | None = Field(
        default=None,
        description="Arrow and color of the change. Taken from its sign when omitted.",
    )


class Metrics(_Block):
    """A row of key-figure cards, for the numbers a reader should see first."""

    type: Literal["metrics"]
    items: list[Metric] = Field(min_length=1, max_length=8)


class Callout(_Block):
    """A tinted box that sets a note, result, warning or risk apart."""

    type: Literal["callout"]
    tone: Literal["info", "success", "warning", "danger"] = "info"
    title: str | None = Field(default=None, max_length=120)
    text: str = Field(min_length=1, max_length=4000)


class Quote(_Block):
    """A pull quote, with an optional source."""

    type: Literal["quote"]
    text: str = Field(min_length=1, max_length=2000)
    attribution: str | None = Field(default=None, max_length=120)


class Code(_Block):
    """A block of source code or terminal output, kept verbatim."""

    type: Literal["code"]
    code: str = Field(min_length=1, max_length=20_000)
    language: str | None = Field(default=None, max_length=24)


class Divider(_Block):
    """A thin horizontal rule between parts of a section."""

    type: Literal["divider"]


class PageBreak(_Block):
    """Start the next block on a new page."""

    type: Literal["page_break"]


Block = (
    Heading
    | Paragraph
    | BulletList
    | Table
    | Chart
    | Image
    | Metrics
    | Callout
    | Quote
    | Code
    | Divider
    | PageBreak
)


class Document(_Block):
    """The source saved beside a PDF. The template is applied later, at compile."""

    title: str = Field(min_length=1, max_length=160)
    blocks: list[Block] = Field(min_length=1, max_length=400)
    subtitle: str | None = Field(default=None, max_length=200)
    kicker: str | None = Field(default=None, max_length=40)
    author: str | None = Field(default=None, max_length=120)
    date_line: str = Field(min_length=1, max_length=40)
    summary: str | None = Field(default=None, max_length=3000)
    style: Literal["modern", "classic"] = "modern"
    accent: str = "blue"
    cover: bool = False
    table_of_contents: bool = False
    numbered_headings: bool = False
    paper: Literal["a4", "us-letter"] = "a4"
    landscape: bool = False
    language: str = Field(default="en", pattern=r"^[a-z]{2}$")
