---
name: write-pptx
description: Build or revise a designed PowerPoint deck with claims, figures, charts, and tables. Use when the user asks for a PowerPoint, a slide deck, a presentation, or a change to a deck this agent already created.
---

# write-pptx

## Steps

1. Gather the facts first. Call the other tools you need before writing, so every number in the deck comes from a source or from the user.
2. Plan the talk: who is in the room, the decision the deck is for, and the claims that get them there. One claim per slide.
3. Call `create_pptx` once with the whole deck. Describe content only; the frames own fonts, colors, and positions. This saves a new file. To change a file that already exists, follow Revising a deck.
4. Answer with a two-line summary of what the deck argues. The card already shows the file, so do not write the filename, the path, or a URL anywhere in the reply.
5. If the tool returned an error, fix the slides it names and call it again.

## Revising a deck

When the user asks to change a PowerPoint this agent created:

1. Call `read_pptx_source` with the saved filename, such as `hello.pptx`.
2. Call `update_pptx` with that same filename and only the fields that change. Omit every other field.
3. To change a slide, send `slides` as the full list from the source with that change applied. `slides` replaces the whole deck.
4. To remove a subtitle or an author, pass an empty string for that field.
5. The file keeps its name, and the card downloads the new deck. Say what changed in a sentence or two. Do not write the filename. Do not call `create_pptx` for a revision: that saves a second file.
6. If `read_pptx_source` says the file has no source, the deck cannot be edited. Build it again with `create_pptx`.

## Choosing slides

- Open with `cover`. Use `close` for the last slide and its next steps.
- Use `section` only to divide a long deck.
- The title of every slide after the cover is one sentence, about fifteen words, one or two lines. "Revenue rose through the year" rather than "Results".
- Put the two to four numbers that matter in one `metrics` slide.
- Use `chart` when the shape of the numbers matters: `line` for change over time, `bar` to compare categories, `pie` for one series as shares of a whole. The caption states the finding. Pass `source` on a chart or a table when you know where the numbers come from.
- Use `comparison` for two sides, `columns` for two short explanations, `timeline` for steps in order, and `table` when the reader needs the exact cells.
- Use `statement` for one claim that needs a sentence under it. Use `bullets` for at most five short lines. Use `quote` rarely.
- Put what the speaker says in `notes`. Keep the slide itself short enough to read across a room.
- Keep one `accent` for the whole deck.

## Done when

The tool returned a saved file, and the reply says what the deck argues. The filename stays on the card.
