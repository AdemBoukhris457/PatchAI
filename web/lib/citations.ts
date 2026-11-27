/** Numbered `[n](url)` citations, checked against the pages that were opened. */

import { pagesUsed, sourceKey, type WebSource } from "./web-sources.ts"

export type Citation = { number: number; url: string }

export type NumberedSource = WebSource & { number: number | null }

type PartLike = Parameters<typeof pagesUsed>[0][number] & { readonly text?: string }

const CITATION = /\[(\d{1,3})\]\(\s*<?(https?:\/\/[^\s)>]+)>?\s*\)/g
const DEFINITION = /^ {0,3}\[(\d{1,3})\]:[ \t]*<?(https?:\/\/[^\s>]+)>?(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/gm
const BARE = /\[(\d{1,3})\](?![(:[])/g

/**
 * `[1]` with a `[1]: url` line elsewhere becomes `[1](url)`, and the
 * definition lines are dropped. The chat renders each block on its own, so a
 * definition in another block would never reach its reference.
 */
export function inlineReferences(text: string): string {
  const urls = new Map<string, string>()
  for (const match of text.matchAll(DEFINITION)) {
    if (match[1] && match[2]) urls.set(match[1], match[2])
  }
  if (urls.size === 0) return text
  return text
    .replace(DEFINITION, "")
    .replace(BARE, (whole, number: string) => {
      const url = urls.get(number)
      return url ? `[${number}](${url})` : whole
    })
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
}

/** Each cited URL once, in the order it is first cited, with the number the answer used. */
export function citationsIn(text: string): Citation[] {
  const seen = new Set<string>()
  const found: Citation[] = []
  for (const match of inlineReferences(text).matchAll(CITATION)) {
    const url = match[2] ?? ""
    const key = sourceKey(url)
    if (key === null || seen.has(key)) continue
    seen.add(key)
    found.push({ number: Number(match[1]), url })
  }
  return found
}

/**
 * The opened pages, cited ones first in citation order with their number,
 * then the pages that were read but not cited, without a number.
 * A citation to a page that was never opened is left out.
 */
export function numberedSources(parts: readonly PartLike[], text?: string): NumberedSource[] {
  const opened = pagesUsed(parts)
  const answer = text ?? answerText(parts)
  const byKey = new Map(opened.map((source) => [sourceKey(source.url), source]))
  const cited: NumberedSource[] = []
  const used = new Set<string>()
  for (const citation of citationsIn(answer)) {
    const key = sourceKey(citation.url)
    const source = key === null ? undefined : byKey.get(key)
    if (!source || key === null || used.has(key)) continue
    used.add(key)
    cited.push({ ...source, number: citation.number })
  }
  const rest = opened
    .filter((source) => !used.has(sourceKey(source.url) ?? ""))
    .map((source) => ({ ...source, number: null }))
  return [...cited, ...rest]
}

/** The opened page a citation link points at, or `null` when it was never opened. */
export function openedPage(sources: readonly NumberedSource[], href: string): NumberedSource | null {
  const key = sourceKey(href)
  if (key === null) return null
  return sources.find((source) => sourceKey(source.url) === key) ?? null
}

function answerText(parts: readonly PartLike[]) {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n")
}
