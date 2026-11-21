"""Draw a deck into a 16:9 PowerPoint file.

The model names a slide type and its words. Every position lives here, on
one 12-column grid with four type sizes.
"""

import io
import re

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_DATA_LABEL_POSITION, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_VERTICAL_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

from patchai.plugins.pptx_deck.slides import (
    Bullets,
    Chart,
    Close,
    Columns,
    Comparison,
    Cover,
    Deck,
    Metrics,
    Quote,
    Section,
    Slide,
    Statement,
    Table,
    Timeline,
)

_TITLE_FACE = "Georgia"
_BODY_FACE = "Calibri"
_DISPLAY = 40
_TITLE = 28
_BODY = 18
_CAPTION = 12
_WHITE = "FFFFFF"
_HAIR = "E4E7EC"
_SLIDE_W = Emu(12_192_000)
_SLIDE_H = Emu(6_858_000)
_MARGIN = Inches(0.5)
_GUTTER = Inches(0.2)
_COL = Emu(772_160)
_TITLE_TOP = Inches(0.5)
_TITLE_H = Inches(0.92)
_BODY_TOP = Inches(1.62)
_FOOTER_TOP = Inches(7.08)
_NUMERIC = re.compile(r"^[\s~≈<>(+\-−]*[$€£¥]?\s*\d[\d.,]*\s*(%|[A-Za-z]{1,4})?\)?$")
_NEUTRALS = ("1C2430", "64748B", "94A3B8", "CBD5E1")


class Palette:
    def __init__(self, ink: str, accent: str, muted: str, mist: str) -> None:
        self.ink = ink
        self.paper = _WHITE
        self.accent = accent
        self.muted = muted
        self.mist = mist


PALETTES = {
    "blue": Palette("0F1C2E", "2563EB", "5C6B80", "D5DEEA"),
    "indigo": Palette("1A1640", "4F46E5", "5E5A78", "D9D6EA"),
    "violet": Palette("241433", "7C3AED", "6B6178", "E4D8F0"),
    "teal": Palette("0F2C2A", "0D9488", "5C6F6C", "D2E4E1"),
    "green": Palette("122616", "15803D", "5C6B60", "D5E4D8"),
    "orange": Palette("2C160C", "EA580C", "7A6458", "F3DDD2"),
    "red": Palette("2C1014", "DC2626", "7A5C60", "F3D6DA"),
    "slate": Palette("1C2430", "334155", "64748B", "D8DEE6"),
}


def render(deck: Deck) -> bytes:
    """Draw ``deck`` and return the PowerPoint bytes."""
    presentation = Presentation()
    presentation.slide_width = _SLIDE_W
    presentation.slide_height = _SLIDE_H
    presentation.core_properties.title = deck.title
    if deck.author:
        presentation.core_properties.author = deck.author
    palette = PALETTES[deck.accent]
    blank = presentation.slide_layouts[6]
    total = len(deck.slides)
    for number, spec in enumerate(deck.slides, start=1):
        slide = presentation.slides.add_slide(blank)
        _draw(slide, spec, deck, palette, number, total)
    buffer = io.BytesIO()
    presentation.save(buffer)
    return buffer.getvalue()


def _draw(
    slide, spec: Slide, deck: Deck, palette: Palette, number: int, total: int
) -> None:
    dark = isinstance(spec, (Cover, Close))
    _background(slide, palette.ink if dark else _WHITE)
    if isinstance(spec, Cover):
        _cover(slide, spec, deck, palette)
    elif isinstance(spec, Section):
        _section(slide, spec, palette)
    elif isinstance(spec, Statement):
        _statement(slide, spec, palette)
    elif isinstance(spec, Bullets):
        _bullets(slide, spec, palette)
    elif isinstance(spec, Columns):
        _columns(slide, spec, palette)
    elif isinstance(spec, Metrics):
        _metrics(slide, spec, palette)
    elif isinstance(spec, Comparison):
        _comparison(slide, spec, palette)
    elif isinstance(spec, Timeline):
        _timeline(slide, spec, palette)
    elif isinstance(spec, Chart):
        _chart(slide, spec, palette)
    elif isinstance(spec, Table):
        _table(slide, spec, palette)
    elif isinstance(spec, Quote):
        _quote(slide, spec, palette)
    elif isinstance(spec, Close):
        _close(slide, spec, palette)
    _footer(slide, palette, deck.title, number, total, dark=dark)
    if spec.notes:
        slide.notes_slide.notes_text_frame.text = spec.notes


def _cover(slide, spec: Cover, deck: Deck, palette: Palette) -> None:
    left, width = _span(0, 12)
    if spec.kicker:
        _write(
            slide,
            left,
            Inches(1.9),
            width,
            Inches(0.28),
            spec.kicker,
            size=_CAPTION,
            color=palette.mist,
            font=_BODY_FACE,
        )
    _write(
        slide,
        left,
        Inches(2.3),
        width,
        Inches(1.6),
        spec.title,
        size=_DISPLAY,
        color=palette.paper,
        bold=True,
        font=_TITLE_FACE,
    )
    if spec.subtitle:
        _write(
            slide,
            left,
            Inches(4.1),
            _span(0, 8)[1],
            Inches(0.9),
            spec.subtitle,
            size=_BODY,
            color=palette.mist,
        )
    meta = "  ·  ".join(part for part in (deck.author, deck.date_line) if part)
    if meta:
        _write(
            slide,
            left,
            Inches(6.5),
            width,
            Inches(0.28),
            meta,
            size=_CAPTION,
            color=palette.mist,
        )


def _section(slide, spec: Section, palette: Palette) -> None:
    left, width = _span(0, 12)
    if spec.kicker:
        _write(
            slide,
            left,
            Inches(2.5),
            width,
            Inches(0.28),
            spec.kicker,
            size=_CAPTION,
            color=palette.muted,
        )
    _write(
        slide,
        left,
        Inches(2.9),
        width,
        Inches(1.5),
        spec.title,
        size=_DISPLAY,
        color=palette.ink,
        bold=True,
        font=_TITLE_FACE,
    )


def _statement(slide, spec: Statement, palette: Palette) -> None:
    _title(slide, spec.title, palette)
    left, width = _span(0, 9)
    _write(
        slide,
        left,
        _BODY_TOP,
        width,
        Inches(4.2),
        spec.body,
        size=_BODY,
        color=palette.ink,
    )


def _bullets(slide, spec: Bullets, palette: Palette) -> None:
    _title(slide, spec.title, palette)
    left, width = _span(0, 12)
    text_left = left + Inches(0.28)
    text_width = width - Inches(0.28)
    top = _BODY_TOP
    for item in spec.items:
        _write(
            slide,
            left,
            top,
            Inches(0.24),
            Inches(0.4),
            "—",
            size=_BODY,
            color=palette.muted,
        )
        _write(
            slide,
            text_left,
            top,
            text_width,
            Inches(0.7),
            item,
            size=_BODY,
            color=palette.ink,
        )
        top += Inches(0.78)


def _columns(slide, spec: Columns, palette: Palette) -> None:
    _title(slide, spec.title, palette)
    _pair(
        slide,
        spec.left.title,
        [spec.left.body],
        spec.right.title,
        [spec.right.body],
        palette,
        points=False,
    )


def _metrics(slide, spec: Metrics, palette: Palette) -> None:
    _title(slide, spec.title, palette)
    count = len(spec.items)
    span = 12 // count
    for index, item in enumerate(spec.items):
        left, width = _span(index * span, span)
        _write(
            slide,
            left,
            _BODY_TOP,
            width,
            Inches(0.3),
            item.label,
            size=_CAPTION,
            color=palette.muted,
        )
        _write(
            slide,
            left,
            Inches(2.0),
            width,
            Inches(0.85),
            item.value,
            size=_DISPLAY,
            color=palette.accent,
            bold=True,
            font=_TITLE_FACE,
        )
        if item.note:
            _write(
                slide,
                left,
                Inches(2.95),
                width,
                Inches(0.7),
                item.note,
                size=_CAPTION,
                color=palette.muted,
            )


def _comparison(slide, spec: Comparison, palette: Palette) -> None:
    _title(slide, spec.title, palette)
    _pair(
        slide,
        spec.left.title,
        spec.left.points,
        spec.right.title,
        spec.right.points,
        palette,
        points=True,
    )


def _timeline(slide, spec: Timeline, palette: Palette) -> None:
    _title(slide, spec.title, palette)
    count = len(spec.steps)
    span = 12 // count
    left, width = _span(0, span * count)
    _hair(slide, left, Inches(2.15), width, vertical=False)
    for index, step in enumerate(spec.steps):
        col, col_w = _span(index * span, span)
        _write(
            slide,
            col,
            Inches(1.85),
            col_w,
            Inches(0.32),
            f"{index + 1:02d}",
            size=_CAPTION,
            color=palette.muted,
            font=_TITLE_FACE,
        )
        _write(
            slide,
            col,
            Inches(2.4),
            col_w - _GUTTER,
            Inches(0.55),
            step.label,
            size=_BODY,
            color=palette.ink,
            bold=True,
            font=_TITLE_FACE,
        )
        _write(
            slide,
            col,
            Inches(3.05),
            col_w - _GUTTER,
            Inches(1.5),
            step.text,
            size=_CAPTION,
            color=palette.muted,
        )


def _chart(slide, spec: Chart, palette: Palette) -> None:
    _title(slide, spec.title, palette)
    left, width = _span(0, 12)
    data = CategoryChartData()
    data.categories = list(spec.categories)
    for series in spec.series:
        data.add_series(series.name, tuple(series.values))
    kind = {
        "bar": XL_CHART_TYPE.COLUMN_CLUSTERED,
        "line": XL_CHART_TYPE.LINE,
        "pie": XL_CHART_TYPE.PIE,
    }[spec.kind]
    chart = slide.shapes.add_chart(
        kind, left, _BODY_TOP, width, Inches(4.15), data
    ).chart
    many = len(spec.series) > 1 and spec.kind != "pie"
    chart.has_legend = many
    if many:
        chart.legend.include_in_layout = False
        chart.legend.position = XL_LEGEND_POSITION.BOTTOM
        chart.legend.font.size = Pt(_CAPTION)
        chart.legend.font.name = _BODY_FACE
    _quiet_axes(chart, palette)
    _labels(chart, spec, palette)
    _paint(chart, spec, palette)
    _exhibit_notes(slide, spec.caption, spec.source, palette, top=Inches(5.9))


def _table(slide, spec: Table, palette: Palette) -> None:
    _title(slide, spec.title, palette)
    left, width = _span(0, 12)
    rows = len(spec.rows) + 1
    cols = len(spec.columns)
    table = slide.shapes.add_table(
        rows, cols, left, _BODY_TOP, width, Inches(4.0)
    ).table
    numeric = [
        all(
            _NUMERIC.fullmatch(_cell(row[index]))
            for row in spec.rows
            if _cell(row[index])
        )
        for index in range(cols)
    ]
    for index, name in enumerate(spec.columns):
        _cell_text(
            table.cell(0, index),
            name,
            _CAPTION,
            palette.ink,
            bold=True,
            align=PP_ALIGN.RIGHT if numeric[index] else PP_ALIGN.LEFT,
        )
    for row_index, row in enumerate(spec.rows, start=1):
        for index, value in enumerate(row):
            _cell_text(
                table.cell(row_index, index),
                _cell(value),
                _BODY,
                palette.ink,
                align=PP_ALIGN.RIGHT if numeric[index] else PP_ALIGN.LEFT,
            )
    _exhibit_notes(slide, None, spec.source, palette, top=Inches(5.85))


def _quote(slide, spec: Quote, palette: Palette) -> None:
    left, width = _span(0, 10)
    _write(
        slide,
        left,
        Inches(2.15),
        width,
        Inches(2.4),
        spec.text,
        size=_TITLE,
        color=palette.ink,
        italic=True,
        font=_TITLE_FACE,
    )
    if spec.attribution:
        _write(
            slide,
            left,
            Inches(4.7),
            width,
            Inches(0.35),
            spec.attribution,
            size=_CAPTION,
            color=palette.muted,
        )


def _close(slide, spec: Close, palette: Palette) -> None:
    left, width = _span(0, 12)
    _write(
        slide,
        left,
        Inches(1.2),
        width,
        Inches(1.15),
        spec.title,
        size=_DISPLAY,
        color=palette.paper,
        bold=True,
        font=_TITLE_FACE,
    )
    top = Inches(2.7)
    for index, item in enumerate(spec.items, start=1):
        _write(
            slide,
            left,
            top,
            Inches(0.55),
            Inches(0.45),
            f"{index:02d}",
            size=_BODY,
            color=palette.mist,
            font=_TITLE_FACE,
            anchor=MSO_VERTICAL_ANCHOR.MIDDLE,
        )
        _write(
            slide,
            left + Inches(0.7),
            top,
            width - Inches(0.7),
            Inches(0.45),
            item,
            size=_BODY,
            color=palette.paper,
            anchor=MSO_VERTICAL_ANCHOR.MIDDLE,
        )
        top += Inches(0.72)


def _pair(
    slide,
    left_title: str,
    left_lines: list[str],
    right_title: str,
    right_lines: list[str],
    palette: Palette,
    *,
    points: bool,
) -> None:
    _column(slide, 0, left_title, left_lines, palette, points=points)
    _column(slide, 6, right_title, right_lines, palette, points=points)
    mid = _span(6, 6)[0] - _GUTTER / 2
    _hair(slide, mid, _BODY_TOP, Inches(4.4), vertical=True)


def _column(
    slide, start: int, title: str, lines: list[str], palette: Palette, *, points: bool
) -> None:
    left, width = _span(start, 6)
    width -= _GUTTER / 2
    _write(
        slide,
        left,
        _BODY_TOP,
        width,
        Inches(0.45),
        title,
        size=_BODY,
        color=palette.ink,
        bold=True,
    )
    top = Inches(2.2)
    for line in lines:
        if points:
            _write(
                slide,
                left,
                top,
                Inches(0.24),
                Inches(0.4),
                "—",
                size=_BODY,
                color=palette.muted,
            )
            _write(
                slide,
                left + Inches(0.28),
                top,
                width - Inches(0.28),
                Inches(0.65),
                line,
                size=_BODY,
                color=palette.ink,
            )
            top += Inches(0.72)
        else:
            _write(
                slide,
                left,
                top,
                width,
                Inches(3.4),
                line,
                size=_BODY,
                color=palette.ink,
            )


def _title(slide, title: str, palette: Palette) -> None:
    left, width = _span(0, 12)
    _write(
        slide,
        left,
        _TITLE_TOP,
        width,
        _TITLE_H,
        title,
        size=_TITLE,
        color=palette.ink,
        bold=True,
        font=_TITLE_FACE,
    )


def _exhibit_notes(
    slide, caption: str | None, source: str | None, palette: Palette, *, top
) -> None:
    left, width = _span(0, 12)
    if caption:
        _write(
            slide,
            left,
            top,
            width,
            Inches(0.36),
            caption,
            size=_BODY,
            color=palette.ink,
        )
        top += Inches(0.36)
    if source:
        _write(
            slide,
            left,
            top,
            width,
            Inches(0.26),
            source,
            size=_CAPTION,
            color=palette.muted,
        )


def _footer(
    slide, palette: Palette, title: str, number: int, total: int, *, dark: bool
) -> None:
    color = palette.mist if dark else palette.muted
    left, width = _span(0, 8)
    _write(
        slide, left, _FOOTER_TOP, width, Inches(0.26), title, size=_CAPTION, color=color
    )
    number_left, number_width = _span(8, 4)
    _write(
        slide,
        number_left,
        _FOOTER_TOP,
        number_width,
        Inches(0.26),
        f"{number}  /  {total}",
        size=_CAPTION,
        color=color,
        align=PP_ALIGN.RIGHT,
    )


def _span(start: int, count: int):
    left = _MARGIN + (_COL + _GUTTER) * start
    width = _COL * count + _GUTTER * (count - 1)
    return left, width


def _background(slide, color: str) -> None:
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = RGBColor.from_string(color)


def _hair(slide, left, top, length, *, vertical: bool) -> None:
    if vertical:
        shape = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, left, top, Emu(6350), length
        )
    else:
        shape = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, left, top, length, Emu(6350)
        )
    shape.fill.solid()
    shape.fill.fore_color.rgb = RGBColor.from_string(_HAIR)
    shape.line.fill.background()


def _write(
    slide,
    left,
    top,
    width,
    height,
    text: str,
    *,
    size: int,
    color: str,
    bold: bool = False,
    italic: bool = False,
    font: str = _BODY_FACE,
    align=PP_ALIGN.LEFT,
    anchor=MSO_VERTICAL_ANCHOR.TOP,
) -> None:
    shape = slide.shapes.add_textbox(left, top, width, height)
    frame = shape.text_frame
    frame.word_wrap = True
    frame.margin_left = frame.margin_right = frame.margin_top = frame.margin_bottom = (
        Emu(0)
    )
    frame.vertical_anchor = anchor
    paragraph = frame.paragraphs[0]
    paragraph.alignment = align
    paragraph.text = text
    paragraph.font.name = font
    paragraph.font.size = Pt(size)
    paragraph.font.bold = bold
    paragraph.font.italic = italic
    paragraph.font.color.rgb = RGBColor.from_string(color)


def _quiet_axes(chart, palette: Palette) -> None:
    try:
        chart.value_axis.has_major_gridlines = False
        chart.value_axis.tick_labels.font.size = Pt(_CAPTION)
        chart.value_axis.tick_labels.font.name = _BODY_FACE
        chart.value_axis.tick_labels.font.color.rgb = RGBColor.from_string(
            palette.muted
        )
        chart.category_axis.tick_labels.font.size = Pt(_CAPTION)
        chart.category_axis.tick_labels.font.name = _BODY_FACE
        chart.category_axis.tick_labels.font.color.rgb = RGBColor.from_string(
            palette.muted
        )
    except ValueError:
        return


def _labels(chart, spec: Chart, palette: Palette) -> None:
    single = len(spec.series) == 1
    if spec.kind != "pie" and not single:
        return
    plot = chart.plots[0]
    plot.has_data_labels = True
    labels = plot.data_labels
    labels.font.size = Pt(_CAPTION)
    labels.font.name = _BODY_FACE
    labels.font.color.rgb = RGBColor.from_string(palette.ink)
    if spec.kind == "pie":
        labels.show_category_name = True
        labels.show_percentage = True
        labels.show_value = False
        labels.position = XL_DATA_LABEL_POSITION.BEST_FIT
    elif spec.kind == "bar":
        labels.position = XL_DATA_LABEL_POSITION.OUTSIDE_END
    else:
        labels.position = XL_DATA_LABEL_POSITION.ABOVE


def _paint(chart, spec: Chart, palette: Palette) -> None:
    colors = (palette.accent, *_NEUTRALS)
    if spec.kind == "pie":
        for index, point in enumerate(chart.series[0].points):
            fill = point.format.fill
            fill.solid()
            fill.fore_color.rgb = RGBColor.from_string(colors[index % len(colors)])
        return
    for index, series in enumerate(chart.series):
        color = RGBColor.from_string(colors[index % len(colors)])
        if spec.kind == "line":
            series.format.line.color.rgb = color
            series.format.line.width = Pt(2.25)
        else:
            fill = series.format.fill
            fill.solid()
            fill.fore_color.rgb = color


def _cell_text(
    cell, text: str, size: int, color: str, *, bold: bool = False, align=PP_ALIGN.LEFT
) -> None:
    cell.fill.solid()
    cell.fill.fore_color.rgb = RGBColor.from_string(_WHITE)
    cell.margin_left = Inches(0.08)
    cell.margin_right = Inches(0.08)
    cell.vertical_anchor = MSO_VERTICAL_ANCHOR.MIDDLE
    frame = cell.text_frame
    frame.word_wrap = True
    paragraph = frame.paragraphs[0]
    paragraph.alignment = align
    paragraph.text = text
    paragraph.font.name = _BODY_FACE
    paragraph.font.size = Pt(size)
    paragraph.font.bold = bold
    paragraph.font.color.rgb = RGBColor.from_string(color)
    _borders(cell, _HAIR)


def _borders(cell, color: str) -> None:
    lines = cell._tc.get_or_add_tcPr()
    for edge in ("lnL", "lnR", "lnT", "lnB"):
        line = lines.find(qn(f"a:{edge}"))
        if line is None:
            line = lines.makeelement(
                qn(f"a:{edge}"),
                {"w": "6350", "cap": "flat", "cmpd": "sng", "algn": "ctr"},
            )
            lines.append(line)
        else:
            line.set("w", "6350")
        solid = line.find(qn("a:solidFill"))
        if solid is None:
            solid = line.makeelement(qn("a:solidFill"), {})
            line.append(solid)
        scheme = solid.find(qn("a:srgbClr"))
        if scheme is None:
            scheme = solid.makeelement(qn("a:srgbClr"), {"val": color})
            solid.append(scheme)
        else:
            scheme.set("val", color)


def _cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)
