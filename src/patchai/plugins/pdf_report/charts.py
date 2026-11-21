"""Draw a chart block as an SVG that matches the document's palette."""

import io
import math

import matplotlib
from cycler import cycler
from matplotlib.figure import Figure
from matplotlib.ticker import FuncFormatter

from patchai.plugins.pdf_report.blocks import Chart

_INK = "#1f2933"
_MUTED = "#667085"
_GRID = "#e4e7ec"
_SANS = ["Inter", "Segoe UI", "Helvetica Neue", "Arial", "Liberation Sans", "DejaVu Sans"]
_COMPANIONS = ["#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#64748b", "#ec4899"]


def palette(accent: str) -> list[str]:
    """The accent first, then companions that stay apart from it."""
    return [accent, *(color for color in _COMPANIONS if _distance(color, accent) > 90)][:8]


def draw(chart: Chart, accent: str) -> bytes:
    """Return ``chart`` as SVG bytes with text drawn as outlines."""
    colors = palette(accent)
    style = {
        "svg.fonttype": "path",
        "svg.hashsalt": "patchai",
        "font.family": "sans-serif",
        "font.sans-serif": _SANS,
        "font.size": 9,
        "text.color": _INK,
        "axes.prop_cycle": cycler(color=colors),
        "axes.edgecolor": _GRID,
        "axes.labelcolor": _MUTED,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.axisbelow": True,
        "axes.titleweight": "bold",
        "xtick.color": _MUTED,
        "ytick.color": _MUTED,
        "xtick.major.size": 0,
        "ytick.major.size": 0,
        "grid.color": _GRID,
        "grid.linewidth": 0.8,
        "legend.frameon": False,
        "legend.fontsize": 8.5,
    }
    with matplotlib.rc_context(style):
        round_chart = chart.kind in ("pie", "donut")
        figure = Figure(figsize=(6.6, _height(chart)), layout="constrained")
        axes = figure.add_subplot()
        _DRAWERS[chart.kind](axes, chart, colors)
        if chart.x_label and not round_chart:
            axes.set_xlabel(chart.x_label)
        if chart.y_label and not round_chart:
            axes.set_ylabel(chart.y_label)
        if len(chart.series) > 1:
            figure.legend(loc="outside upper left", ncols=min(len(chart.series), 4))
        buffer = io.BytesIO()
        figure.savefig(buffer, format="svg", transparent=True, metadata={"Date": None})
    return buffer.getvalue()


def _bars(axes, chart: Chart, colors: list[str], *, horizontal: bool, stacked: bool) -> None:
    labels = [_label(label) for label in chart.labels]
    positions = list(range(len(labels)))
    count = len(chart.series)
    width = 0.72 if stacked or count == 1 else 0.8 / count
    base = [0.0] * len(labels)
    for index, series in enumerate(chart.series):
        offset = 0.0 if stacked else (index - (count - 1) / 2) * width
        spots = [position + offset for position in positions]
        draw_bar = axes.barh if horizontal else axes.bar
        extent = {"height": width} if horizontal else {"width": width}
        stack = {"left": base} if horizontal else {"bottom": base}
        bars = draw_bar(spots, series.values, label=series.name, **extent, **(stack if stacked else {}))
        if count == 1 and len(labels) <= 16:
            axes.bar_label(bars, labels=[_number(v, chart) for v in series.values],
                           padding=3, fontsize=8, color=_MUTED)
        if stacked:
            base = [low + value for low, value in zip(base, series.values)]
    value_axis = axes.xaxis if horizontal else axes.yaxis
    value_axis.set_major_formatter(FuncFormatter(lambda value, _: _number(value, chart)))
    axes.grid(axis="x" if horizontal else "y")
    if horizontal:
        axes.set_yticks(positions, labels)
        axes.invert_yaxis()
        axes.spines["left"].set_visible(False)
        axes.margins(y=0.02)
    else:
        axes.set_xticks(positions, labels, rotation=_rotation(labels))
        axes.margins(x=0.02)


def _lines(axes, chart: Chart, colors: list[str], *, fill: bool, stacked: bool) -> None:
    labels = [_label(label) for label in chart.labels]
    positions = list(range(len(labels)))
    if stacked:
        axes.stackplot(positions, *[s.values for s in chart.series],
                       labels=[s.name for s in chart.series], alpha=0.85,
                       colors=colors, edgecolor="white", linewidth=0.8)
    else:
        markers = len(labels) <= 24
        for color, series in zip(colors, chart.series):
            axes.plot(positions, series.values, label=series.name, color=color,
                      linewidth=2, marker="o" if markers else None, markersize=3.5)
            if fill:
                axes.fill_between(positions, series.values, color=color, alpha=0.12)
    axes.yaxis.set_major_formatter(FuncFormatter(lambda value, _: _number(value, chart)))
    axes.grid(axis="y")
    step = max(1, math.ceil(len(labels) / 12))
    axes.set_xticks(positions[::step], labels[::step], rotation=_rotation(labels[::step]))
    axes.margins(x=0.01)


def _round(axes, chart: Chart, colors: list[str], *, hole: bool) -> None:
    values = chart.series[0].values
    total = sum(values)
    wedges, _texts, _numbers = axes.pie(
        values,
        labels=[_label(label) for label in chart.labels],
        colors=(colors * math.ceil(len(values) / len(colors)))[: len(values)],
        startangle=90,
        counterclock=False,
        autopct=lambda share: f"{share:.0f}%" if share >= 4 else "",
        pctdistance=0.79 if hole else 0.68,
        labeldistance=1.08,
        wedgeprops={"width": 0.42 if hole else 1, "edgecolor": "white", "linewidth": 1.6},
        textprops={"fontsize": 8.5, "color": _INK},
    )
    for number in _numbers:
        number.set_color("white")
        number.set_fontweight("bold")
    if hole:
        axes.text(0, 0.06, _number(total, chart), ha="center", va="center",
                  fontsize=15, fontweight="bold", color=_INK)
        axes.text(0, -0.14, chart.series[0].name, ha="center", va="center",
                  fontsize=8, color=_MUTED)
    axes.set_aspect("equal")


def _scatter(axes, chart: Chart, colors: list[str]) -> None:
    xs = [float(label) for label in chart.labels]
    for color, series in zip(colors, chart.series):
        axes.scatter(xs, series.values, label=series.name, color=color, s=22,
                     alpha=0.85, edgecolors="white", linewidths=0.6)
    axes.yaxis.set_major_formatter(FuncFormatter(lambda value, _: _number(value, chart)))
    axes.grid(axis="both")


_DRAWERS = {
    "bar": lambda a, c, p: _bars(a, c, p, horizontal=False, stacked=False),
    "horizontal_bar": lambda a, c, p: _bars(a, c, p, horizontal=True, stacked=False),
    "stacked_bar": lambda a, c, p: _bars(a, c, p, horizontal=False, stacked=True),
    "line": lambda a, c, p: _lines(a, c, p, fill=False, stacked=False),
    "area": lambda a, c, p: _lines(a, c, p, fill=True, stacked=False),
    "stacked_area": lambda a, c, p: _lines(a, c, p, fill=True, stacked=True),
    "pie": lambda a, c, p: _round(a, c, p, hole=False),
    "donut": lambda a, c, p: _round(a, c, p, hole=True),
    "scatter": _scatter,
}


def _number(value: float, chart: Chart) -> str:
    """Compact the value unless the suffix already names a unit such as "K"."""
    magnitude = abs(value)
    units = () if chart.suffix[:1].isalpha() else ((1e12, "T"), (1e9, "B"), (1e6, "M"), (1e3, "K"))
    for size, unit in units:
        if magnitude >= size:
            text = f"{value / size:.1f}".removesuffix(".0") + unit
            break
    else:
        text = f"{value:,.2f}".rstrip("0").rstrip(".") if magnitude < 100 else f"{value:,.0f}"
    return f"{chart.prefix}{text}{chart.suffix}"


def _height(chart: Chart) -> float:
    if chart.kind in ("pie", "donut"):
        return 3.9
    if chart.kind == "horizontal_bar":
        rows = len(chart.labels) * (1 if len(chart.series) == 1 else 0.6 + 0.4 * len(chart.series))
        return min(9.0, max(2.0, 0.42 * rows + 0.9))
    return 3.5


def _label(label: str | float) -> str:
    if isinstance(label, float) and label.is_integer():
        return str(int(label))
    return str(label)


def _rotation(labels: list[str]) -> int:
    return 30 if len(labels) > 6 and max(map(len, labels)) > 6 else 0


def _distance(first: str, second: str) -> float:
    a = [int(first[i : i + 2], 16) for i in (1, 3, 5)]
    b = [int(second[i : i + 2], 16) for i in (1, 3, 5)]
    return math.dist(a, b)
