// Lays out document.json. Every string from the model arrives as data and
// is drawn as text; nothing here evaluates it as markup.

#let doc = json("document.json")

#let accent = rgb(doc.accent)
#let ink = rgb("#1f2933")
#let muted = rgb("#667085")
#let hairline = rgb("#e4e7ec")
#let wash = accent.lighten(92%)
#let stripe = rgb("#f6f7f9")
#let tones = (
  info: accent,
  success: rgb("#15803d"),
  warning: rgb("#b45309"),
  danger: rgb("#be123c"),
)
#let trends = (up: rgb("#15803d"), down: rgb("#be123c"), flat: muted)
#let arrows = (up: "↑ ", down: "↓ ", flat: "")
#let alignments = (left: left, right: right, center: center)
#let first-page = if doc.cover { 2 } else { 1 }

#set document(title: doc.title, author: doc.authors)

#set page(
  paper: doc.paper,
  flipped: doc.landscape,
  margin: (x: 2.3cm, top: 2.7cm, bottom: 2.5cm),
  header: context {
    if here().page() > first-page {
      set text(size: 8pt, fill: muted)
      grid(columns: (1fr, auto), [#doc.title], [#doc.date])
      v(-3pt)
      line(length: 100%, stroke: 0.5pt + hairline)
    }
  },
  footer: context {
    if here().page() >= first-page {
      set text(size: 8pt, fill: muted)
      let total = counter(page).final().first()
      grid(
        columns: (1fr, auto),
        [#doc.author],
        [#counter(page).get().first() #text(fill: hairline.darken(25%))[/] #total],
      )
    }
  },
)

#set text(font: doc.fonts.body, size: 10.5pt, fill: ink, lang: doc.lang)
#set par(justify: true, leading: 0.7em, spacing: 1.2em)
#set heading(numbering: if doc.numbered { "1.1" } else { none })
#set list(marker: text(fill: accent)[•], indent: 3pt, body-indent: 8pt, spacing: 0.75em)
#set enum(indent: 3pt, body-indent: 8pt, spacing: 0.75em)

#show heading: set text(font: doc.fonts.heading, fill: ink)
#show heading: set par(justify: false)
#show heading.where(level: 1): it => block(above: 2em, below: 1.1em, sticky: true, stack(
  spacing: 8pt,
  text(size: 17pt, weight: "bold", it),
  line(length: 26pt, stroke: 2.5pt + accent),
))
#show heading.where(level: 2): set text(size: 13pt, weight: "bold")
#show heading.where(level: 2): set block(above: 1.6em, below: 0.8em)
#show heading.where(level: 3): set text(size: 10.5pt, weight: "bold", fill: accent.darken(15%))
#show heading.where(level: 3): set block(above: 1.4em, below: 0.7em)

#show link: it => {
  if type(it.dest) == str {
    text(fill: accent.darken(10%), underline(offset: 2pt, stroke: 0.5pt + accent.lighten(40%), it))
  } else { it }
}
#show raw: set text(font: doc.fonts.mono, size: 0.9em)
#show raw.where(block: false): box.with(
  fill: wash, inset: (x: 3pt), outset: (y: 2.5pt), radius: 2pt,
)
#show raw.where(block: true): it => block(
  width: 100%, fill: stripe, stroke: 0.5pt + hairline, inset: 11pt, radius: 4pt,
  above: 1.2em, below: 1.2em, it,
)

#set figure(gap: 0.9em)
#show figure: set block(above: 1.6em, below: 1.6em)
#show figure.where(kind: table): set figure.caption(position: top)
#show figure.where(kind: table): set block(breakable: true)
#show figure.caption: it => {
  set text(size: 8.5pt, fill: muted)
  set par(justify: false)
  [#text(weight: "bold", fill: ink)[#it.supplement #context it.counter.display(it.numbering)]#it.separator#it.body]
}

#show outline.entry.where(level: 1): set text(weight: "bold")
#show outline.entry.where(level: 1): set block(above: 1.1em)

// Inline runs: plain text with bold, italic, strike, code and links.
#let inline(runs) = {
  for run in runs {
    if run.at("break", default: false) {
      linebreak()
    } else {
      let body = if run.code { raw(run.text) } else { [#run.text] }
      if run.bold { body = strong(body) }
      if run.italic { body = emph(body) }
      if run.strike { body = strike(body) }
      if run.link != none { body = link(run.link, body) }
      body
    }
  }
}

#let prose(paragraphs) = {
  for runs in paragraphs {
    inline(runs)
    parbreak()
  }
}

#let caption-of(b) = if b.caption != none { inline(b.caption) } else { none }

#let data-table(b) = {
  set text(size: 9pt)
  set par(justify: false)
  let cells = (
    table.header(..b.columns.map(c => text(weight: "bold", fill: white)[#c])),
    ..b.rows.map(row => row.map(cell => inline(cell))).flatten(),
  )
  if b.total != none {
    cells.push(table.hline(stroke: 0.9pt + ink.lighten(45%)))
    cells.push(table.footer(repeat: false, ..b.total.map(cell => strong(inline(cell)))))
  }
  let grid-table = table(
    columns: b.widths.map(w => w * 1fr),
    align: (x, y) => alignments.at(b.align.at(x)) + horizon,
    inset: (x: 8pt, y: 6.5pt),
    stroke: (x, y) => if y > 0 { (bottom: 0.5pt + hairline) },
    fill: (x, y) => if y == 0 { accent } else if calc.even(y) { stripe },
    ..cells,
  )
  if b.caption != none {
    figure(grid-table, caption: caption-of(b))
  } else {
    block(above: 1.4em, below: 1.4em, grid-table)
  }
}

#let picture(b) = {
  let img = image(b.path, width: b.width * 1%)
  if b.caption != none {
    figure(img, caption: caption-of(b))
  } else {
    block(above: 1.4em, below: 1.4em, align(center, img))
  }
}

#let metrics(b) = {
  let n = b.items.len()
  let per-row = if n <= 4 { n } else if n <= 6 { 3 } else { 4 }
  let any-change = b.items.any(m => m.change != none)
  let longest = calc.max(..b.items.map(m => m.value.clusters().len())) * per-row
  let value-size = if longest <= 28 { 19pt } else if longest <= 36 { 15.5pt } else if longest <= 46 { 12.5pt } else { 11pt }
  block(above: 1.3em, below: 1.5em, grid(
    columns: (1fr,) * per-row,
    gutter: 9pt,
    ..b.items.map(m => block(
      width: 100%,
      fill: wash,
      radius: 6pt,
      inset: (x: 12pt, y: 11pt),
      breakable: false,
      stack(
        spacing: 7pt,
        text(size: 7.5pt, weight: "bold", fill: muted, tracking: 0.6pt)[#upper(m.label)],
        text(size: value-size, weight: "bold", fill: ink, font: doc.fonts.heading, hyphenate: false)[#m.value],
        ..if m.change != none {
          (text(size: 8.5pt, weight: "bold", fill: trends.at(m.trend))[#arrows.at(m.trend)#m.change],)
        } else if any-change {
          (hide(text(size: 8.5pt)[0]),)
        } else { () },
      ),
    )),
  ))
}

#let callout(b) = {
  let tone = tones.at(b.tone)
  block(
    width: 100%,
    above: 1.3em,
    below: 1.3em,
    breakable: false,
    fill: tone.lighten(92%),
    stroke: (left: 3pt + tone),
    radius: (right: 4pt),
    inset: (left: 13pt, right: 12pt, y: 11pt),
    {
      set par(justify: false, spacing: 0.75em)
      if b.title != none {
        block(below: 0.6em, text(weight: "bold", fill: tone.darken(20%))[#b.title])
      }
      prose(b.paragraphs)
    },
  )
}

#let pull-quote(b) = block(
  above: 1.4em,
  below: 1.4em,
  inset: (left: 15pt, y: 3pt),
  stroke: (left: 2pt + accent.lighten(25%)),
  {
    set par(justify: false)
    {
      set text(size: 11.5pt, style: "italic", fill: ink.lighten(12%))
      prose(b.paragraphs)
    }
    if b.attribution != none {
      text(size: 8.5pt, fill: muted)[— #b.attribution]
    }
  },
)

#let render(b) = {
  let kind = b.type
  if kind == "heading" {
    heading(level: b.level, inline(b.text))
  } else if kind == "paragraph" {
    prose(b.paragraphs)
  } else if kind == "list" {
    let items = b.items.map(item => inline(item))
    block(above: 1em, below: 1.2em, if b.ordered { enum(..items) } else { list(..items) })
  } else if kind == "table" {
    data-table(b)
  } else if kind == "figure" {
    picture(b)
  } else if kind == "metrics" {
    metrics(b)
  } else if kind == "callout" {
    callout(b)
  } else if kind == "quote" {
    pull-quote(b)
  } else if kind == "code" {
    raw(b.code, block: true, lang: b.language)
  } else if kind == "divider" {
    block(above: 1.4em, below: 1.4em, line(length: 100%, stroke: 0.5pt + hairline))
  } else if kind == "page_break" {
    pagebreak(weak: true)
  }
}

#let kicker() = text(size: 8.5pt, weight: "bold", tracking: 1.6pt)[#upper(doc.kicker)]

#let cover() = page(margin: 0pt, header: none, footer: none, {
  set par(justify: false)
  block(width: 100%, height: 47%, fill: accent, inset: (x: 2.3cm, top: 2.3cm, bottom: 2cm), {
    set text(fill: white)
    if doc.kicker != none { kicker() }
    place(bottom + left, stack(
      spacing: 15pt,
      text(size: 30pt, weight: "bold", font: doc.fonts.heading, hyphenate: false)[#doc.title],
      ..if doc.subtitle != none {
        (text(size: 13.5pt, fill: white.transparentize(15%))[#doc.subtitle],)
      } else { () },
    ))
  })
  block(width: 100%, inset: (x: 2.3cm, top: 1.2cm), {
    text(size: 9.5pt, fill: muted)[#doc.meta]
    if doc.summary != none {
      v(1.4em)
      line(length: 26pt, stroke: 2.5pt + accent)
      v(0.6em)
      set text(size: 11.5pt, fill: ink.lighten(8%))
      set par(leading: 0.8em)
      prose(doc.summary)
    }
  })
})

#let title-block() = block(width: 100%, below: 2em, {
  set par(justify: false)
  stack(
    spacing: 11pt,
    ..if doc.kicker != none { (text(fill: accent, kicker()),) } else { () },
    text(size: 25pt, weight: "bold", font: doc.fonts.heading, hyphenate: false)[#doc.title],
    ..if doc.subtitle != none { (text(size: 13pt, fill: muted)[#doc.subtitle],) } else { () },
    text(size: 9pt, fill: muted)[#doc.meta],
  )
  v(0.9em)
  line(length: 100%, stroke: 0.6pt + hairline)
  if doc.summary != none {
    v(0.8em)
    block(width: 100%, fill: wash, radius: 6pt, inset: (x: 14pt, y: 12pt), {
      set text(size: 11pt)
      set par(spacing: 0.8em)
      prose(doc.summary)
    })
  }
})

#if doc.cover {
  cover()
  counter(page).update(1)
} else {
  title-block()
}

#if doc.contents {
  outline(depth: 2, indent: auto)
  if doc.cover { pagebreak(weak: true) } else { v(1.5em) }
}

#for b in doc.blocks { render(b) }
