---
name: write-pdf
description: Build or revise a designed PDF document with text, tables, charts, images, and key figures. Use when the user asks for a PDF, a report, a brief, a handout, or a change to a PDF this agent already created.
---

# write-pdf

## Steps

1. Gather the facts first. Call the other tools you need before writing, so every number in the document comes from a source or from the user.
2. Plan the document: who reads it, the one thing they should take away, and the sections that get them there.
3. Call `create_pdf` once with the whole document. Describe content only; the template owns fonts, colors, spacing, page numbers, and figure numbering. This saves a new file. To change a file that already exists, follow Revising a document.
4. Answer with a two-line summary of what is inside. The card already shows the document, so do not write the filename, the path, or a URL anywhere in the reply.
5. If the tool returned an error, fix the blocks it names and call it again. If the page count is off from what the user asked for, shorten or extend the content and call it once more.

## Revising a document

When the user asks to change a PDF this agent created:

1. Call `read_pdf_source` with the saved filename, such as `hello.pdf`.
2. Call `update_pdf` with that same filename and only the fields that change. Omit every other field.
3. To change the wording, send `blocks` as the full list from the source with that change applied. `blocks` replaces the whole body.
4. To remove a subtitle, kicker, author, or summary, pass an empty string for that field.
5. The file keeps its name, and the card downloads the new PDF. Say what changed in a sentence or two. Do not write the filename. Do not call `create_pdf` for a revision: that saves a second file.
6. If `read_pdf_source` says the file has no source, the PDF cannot be edited. Build it again with `create_pdf`.

## Choosing blocks

- Open with `summary`: the answer in two or three sentences.
- Put the three or four numbers that matter most in one `metrics` block near the top. Give each a `change` when there is a comparison.
- Use `chart` when the shape of the numbers matters: `line` or `area` for change over time, `bar` to compare categories, `horizontal_bar` for long category names or rankings, `stacked_bar` and `stacked_area` for parts of a total over time, `donut` for one share of a whole with up to six parts, `scatter` for two measures. Give every chart a caption that states the finding, not the axis names.
- Use `table` when the reader needs exact values. Pass numbers as numbers or as formatted strings; numeric columns align right. Add `total` for sums.
- Use `callout` for a conclusion (`success`), a caveat (`warning`), a risk (`danger`), or a side note (`info`).
- Use `image` only with an https URL or a data: URL you actually have. Never invent an image URL.
- Keep paragraphs short. Use **bold** for the key phrase of a paragraph, not for whole sentences.

## Document options

- `cover` and `table_of_contents` for documents longer than about four pages. Leave both off for a one- or two-page brief.
- `numbered_headings` for reports people will cite by section.
- `style`: `modern` by default; `classic` for essays, letters, and long reading.
- `accent`: pick one color that suits the subject and keep it.
- `language`: the language the document is written in.
- `landscape` for wide tables or dashboards.

## Done when

The tool returned a saved file, and the reply says what it contains. The filename stays on the card.
