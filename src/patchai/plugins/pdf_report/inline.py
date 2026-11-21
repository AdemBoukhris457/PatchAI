"""Split inline markdown into styled runs the Typst template draws as text.

The template never evaluates these strings as markup, so nothing the model
writes can run as Typst code.
"""

import re

_INLINE = re.compile(
    r"`(?P<code>[^`\n]+)`"
    r"|\[(?P<label>[^\]\n]+)\]\((?P<url>[^)\s]+)\)"
    r"|\*\*(?P<bold>.+?)\*\*"
    r"|__(?P<bold_alt>.+?)__"
    r"|~~(?P<strike>.+?)~~"
    r"|(?<![\w*])\*(?P<italic>[^*\s](?:[^*\n]*?[^*\s])?)\*(?![\w*])"
    r"|(?<![\w_])_(?P<italic_alt>[^_\s](?:[^_\n]*?[^_\s])?)_(?![\w_])"
)
_STYLE_OF = {
    "bold": "bold",
    "bold_alt": "bold",
    "strike": "strike",
    "italic": "italic",
    "italic_alt": "italic",
}

Run = dict[str, object]


def runs(text: str) -> list[Run]:
    """The styled runs of one paragraph. A single newline becomes a line break."""
    return _parse(text.strip(), frozenset(), None)


def paragraphs(text: str) -> list[list[Run]]:
    """The runs of each paragraph in ``text``. A blank line separates paragraphs."""
    blocks = re.split(r"\n\s*\n", text.strip())
    return [runs(block) for block in blocks if block.strip()]


def _parse(text: str, style: frozenset[str], link: str | None) -> list[Run]:
    out: list[Run] = []
    position = 0
    for match in _INLINE.finditer(text):
        out.extend(_plain(text[position : match.start()], style, link))
        kind = match.lastgroup
        if kind == "code":
            out.append(_run(match["code"], style | {"code"}, link))
        elif kind == "url":
            out.extend(_parse(match["label"], style, _safe_url(match["url"])))
        else:
            out.extend(_parse(match[kind], style | {_STYLE_OF[kind]}, link))
        position = match.end()
    out.extend(_plain(text[position:], style, link))
    return out


def _plain(text: str, style: frozenset[str], link: str | None) -> list[Run]:
    out: list[Run] = []
    for index, line in enumerate(text.split("\n")):
        if index:
            out.append({"break": True})
        if line:
            out.append(_run(line, style, link))
    return out


def _run(text: str, style: frozenset[str], link: str | None) -> Run:
    return {
        "text": text,
        "bold": "bold" in style,
        "italic": "italic" in style,
        "strike": "strike" in style,
        "code": "code" in style,
        "link": link,
    }


def _safe_url(url: str) -> str | None:
    return url if re.match(r"(?i)^(https?://|mailto:)", url) else None
