"""The slides a deck is built from, checked before anything is drawn.

Each class docstring and field description becomes part of the tool schema
the model reads, so they describe what the audience will see.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ACCENTS = ("blue", "indigo", "violet", "teal", "green", "orange", "red", "slate")

Cell = str | int | float | None
Line = Annotated[str, Field(min_length=1, max_length=90)]


class _Slide(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: str | None = Field(
        default=None,
        max_length=500,
        description="What the speaker says. This stays in the notes, off the slide.",
    )


class Cover(_Slide):
    """The opening slide. A dark field, the deck title, and a short subtitle."""

    type: Literal["cover"]
    title: str = Field(min_length=1, max_length=80)
    kicker: str | None = Field(default=None, max_length=40)
    subtitle: str | None = Field(default=None, max_length=140)


class Section(_Slide):
    """A divider that names the next part of the talk."""

    type: Literal["section"]
    title: str = Field(min_length=1, max_length=60)
    kicker: str | None = Field(default=None, max_length=40)


class Statement(_Slide):
    """One claim in a large title, with a short explanation under it."""

    type: Literal["statement"]
    title: str = Field(min_length=1, max_length=90)
    body: str = Field(min_length=1, max_length=280)


class Bullets(_Slide):
    """A claim plus up to five short points. Each point is one line."""

    type: Literal["bullets"]
    title: str = Field(min_length=1, max_length=80)
    items: list[Line] = Field(min_length=1, max_length=5)


class Column(BaseModel):
    """One headed side of a two-column slide."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=40)
    body: str = Field(min_length=1, max_length=220)


class Columns(_Slide):
    """Two headed columns under one claim."""

    type: Literal["columns"]
    title: str = Field(min_length=1, max_length=80)
    left: Column
    right: Column


class Metric(BaseModel):
    """One figure: a short label, the value, and an optional note."""

    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=32)
    value: str = Field(min_length=1, max_length=16)
    note: str | None = Field(default=None, max_length=40)


class Metrics(_Slide):
    """Two to four figures under one claim."""

    type: Literal["metrics"]
    title: str = Field(min_length=1, max_length=80)
    items: list[Metric] = Field(min_length=2, max_length=4)


class Side(BaseModel):
    """One side of a comparison."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=32)
    points: list[Line] = Field(min_length=1, max_length=4)


class Comparison(_Slide):
    """Two sides under one claim, such as before and after."""

    type: Literal["comparison"]
    title: str = Field(min_length=1, max_length=80)
    left: Side
    right: Side


class Step(BaseModel):
    """One step on a timeline."""

    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=24)
    text: str = Field(min_length=1, max_length=80)


class Timeline(_Slide):
    """Three to five steps in order, under one claim."""

    type: Literal["timeline"]
    title: str = Field(min_length=1, max_length=80)
    steps: list[Step] = Field(min_length=3, max_length=5)


class Series(BaseModel):
    """One named set of values, one value per category."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=40)
    values: list[float] = Field(min_length=1, max_length=8)


class Chart(_Slide):
    """A native PowerPoint chart. bar compares categories, line shows change
    over time, and pie shows one series as shares of a whole."""

    type: Literal["chart"]
    title: str = Field(min_length=1, max_length=80)
    caption: str = Field(min_length=1, max_length=140)
    kind: Literal["bar", "line", "pie"] = "bar"
    categories: list[Annotated[str, Field(min_length=1, max_length=24)]] = Field(
        min_length=1, max_length=8
    )
    series: list[Series] = Field(min_length=1, max_length=4)
    source: str | None = Field(
        default=None,
        max_length=80,
        description="Where the numbers come from, shown under the chart.",
    )

    @model_validator(mode="after")
    def _series_match(self) -> "Chart":
        width = len(self.categories)
        for series in self.series:
            if len(series.values) != width:
                raise ValueError(
                    f"Series {series.name!r} has {len(series.values)} values; "
                    f"the chart has {width} categories."
                )
        if self.kind == "pie" and len(self.series) != 1:
            raise ValueError("A pie chart takes one series.")
        return self


class Table(_Slide):
    """A small table. Up to five columns and six rows."""

    type: Literal["table"]
    title: str = Field(min_length=1, max_length=80)
    columns: list[Annotated[str, Field(min_length=1, max_length=24)]] = Field(
        min_length=1, max_length=5
    )
    rows: list[list[Cell]] = Field(min_length=1, max_length=6)
    source: str | None = Field(
        default=None,
        max_length=80,
        description="Where the numbers come from, shown under the table.",
    )

    @model_validator(mode="after")
    def _rows_match_columns(self) -> "Table":
        width = len(self.columns)
        for index, row in enumerate(self.rows):
            if len(row) != width:
                raise ValueError(
                    f"Row {index + 1} has {len(row)} cells; the table has {width} columns."
                )
            for cell in row:
                if isinstance(cell, str) and len(cell) > 40:
                    raise ValueError("A table cell can be at most 40 characters.")
        return self


class Quote(_Slide):
    """A short quotation and, when there is one, who said it."""

    type: Literal["quote"]
    text: str = Field(min_length=1, max_length=220)
    attribution: str | None = Field(default=None, max_length=60)


class Close(_Slide):
    """The last slide. A dark field, one closing line, and up to four next steps."""

    type: Literal["close"]
    title: str = Field(min_length=1, max_length=80)
    items: list[Line] = Field(min_length=1, max_length=4)


Slide = (
    Cover
    | Section
    | Statement
    | Bullets
    | Columns
    | Metrics
    | Comparison
    | Timeline
    | Chart
    | Table
    | Quote
    | Close
)


class Deck(BaseModel):
    """The source saved beside a PowerPoint file. The frames are applied later."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)
    slides: list[Slide] = Field(min_length=1, max_length=24)
    subtitle: str | None = Field(default=None, max_length=160)
    author: str | None = Field(default=None, max_length=80)
    date_line: str = Field(min_length=1, max_length=40)
    accent: str = "blue"

    @model_validator(mode="after")
    def _known_accent(self) -> "Deck":
        if self.accent not in ACCENTS:
            raise ValueError("Accent must be " + ", ".join(ACCENTS) + ".")
        return self
