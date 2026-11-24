---
name: write-markdown
description: Build or revise a Markdown document with headings, paragraphs, lists, tables, quotes, and code. Use when the user asks for a Markdown file, a .md document, a note to keep, or a change to a Markdown file this agent already created.
---

# write-markdown

## Steps

1. Gather the facts first. Call the other tools you need before writing, so every number in the document comes from a source or from the user.
2. Plan the document: who reads it, the one thing they should take away, and the sections that get them there.
3. Call `create_markdown` once with the whole document. The title is the level-1 heading. Blocks are the body. This saves a new file under `exports/` and the chat shows a card. Do not call `write_file` or `edit_file` for this document: those tools do not publish it and no card appears. To change a file that already exists, follow Revising a document.
4. Answer with a two-line summary of what is inside. The card already shows the document, so do not write the filename, the path, or a URL anywhere in the reply.
5. If the tool returned an error, fix the blocks it names and call it again.

## Revising a document

When the user asks to change a Markdown file this agent created:

1. Call `read_markdown_source` with the saved filename, such as `hello.md`.
2. Call `update_markdown` with that same filename and only the fields that change. Omit every other field.
3. To change the wording, send `blocks` as the full list from the source with that change applied. `blocks` replaces the whole body.
4. To remove a subtitle or an author, pass an empty string for that field.
5. The file keeps its name, and the card opens the new Markdown. Say what changed in a sentence or two. Do not write the filename. Do not call `create_markdown` for a revision: that saves a second file.
6. If `read_markdown_source` says the file has no source, the file cannot be edited. Build it again with `create_markdown`.

## Choosing blocks

- Put the answer in the first `paragraph`. Keep later paragraphs short.
- Use `heading` at level 2 for each section, and level 3 only when a section has parts.
- Use `list` for steps or a short set of points. Set `ordered` when the order matters.
- Use `table` when the reader needs exact values. `columns` is the header. Each row has one cell per column.
- Use `quote` for one sentence the reader should remember.
- Use `code` for a snippet the reader will copy. Set `language` when you know it.
- Use **bold** for the key phrase of a paragraph, not for whole sentences.

## Document options

- `table_of_contents` for a document with several sections. Leave it off for a short note.
- `author` only when the user named one.
