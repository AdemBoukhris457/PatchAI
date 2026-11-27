/** A page the agent opened to write the answer. */

export type WebSource = {
  url: string
  title: string
  host: string
}

type PartLike = {
  readonly type: string
  readonly sourceType?: string
  readonly url?: string
  readonly title?: string
  readonly toolName?: string
  readonly result?: unknown
  readonly isError?: boolean
}

/**
 * Pages that were read, once each, in the order they were opened.
 *
 * A `source` part is the stream's own list and wins. Older replies have no
 * source parts, so the same list is taken from `read_web_page` results.
 * A search hit that was never opened is not a source.
 */
export function pagesUsed(parts: readonly PartLike[]): WebSource[] {
  const titles = new Map<string, string>()
  for (const part of parts) {
    if (part.type !== "tool-call" || part.toolName !== "search_web" || part.isError) {
      continue
    }
    for (const [key, title] of searchTitles(part.result)) {
      titles.set(key, title)
    }
  }
  const rows: { url?: string; title?: string }[] = []
  for (const part of parts) {
    if (part.type === "source" && part.sourceType === "url") {
      rows.push({ url: part.url, title: part.title })
    } else if (
      part.type === "tool-call" &&
      part.toolName === "read_web_page" &&
      !part.isError
    ) {
      const url = readUrl(part.result)
      if (url) rows.push({ url, title: titles.get(sourceKey(url) ?? "") })
    }
  }
  return unique(rows)
}

function unique(rows: readonly { url?: string; title?: string }[]): WebSource[] {
  const seen = new Set<string>()
  const sources: WebSource[] = []
  for (const row of rows) {
    if (typeof row.url !== "string") continue
    const key = sourceKey(row.url)
    if (key === null) continue
    const host = hostOf(row.url)
    const title = typeof row.title === "string" ? row.title.trim() : ""
    const label = intact(title) ? title : host
    const existing = sources.find((source) => sourceKey(source.url) === key)
    if (existing) {
      if (existing.title === existing.host && label !== host) existing.title = label
      continue
    }
    seen.add(key)
    sources.push({ url: row.url, title: label, host })
  }
  return sources
}

function searchTitles(result: unknown): [string, string][] {
  const results = objectOf(result)?.results
  const found = titlesFrom(results)
  if (found.length > 0 || typeof result !== "string") return found
  // The chat keeps a shortened tool result. Complete title/url pairs at the
  // start are still readable when the JSON no longer parses.
  const row = /"title"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"url"\s*:\s*"((?:\\.|[^"\\])*)"/g
  const recovered: [string, string][] = []
  for (const match of result.matchAll(row)) {
    const title = jsonString(match[1] ?? "")?.trim() ?? ""
    const url = jsonString(match[2] ?? "")
    const key = url ? sourceKey(url) : null
    if (key !== null && intact(title)) recovered.push([key, title])
  }
  return recovered
}

function titlesFrom(results: unknown): [string, string][] {
  if (!Array.isArray(results)) return []
  const found: [string, string][] = []
  for (const row of results) {
    if (!row || typeof row !== "object") continue
    const record = row as { url?: unknown; title?: unknown }
    if (typeof record.url !== "string" || typeof record.title !== "string") continue
    const key = sourceKey(record.url)
    const title = record.title.trim()
    if (key !== null && intact(title)) found.push([key, title])
  }
  return found
}

function readUrl(result: unknown): string | null {
  const url = objectOf(result)?.url
  if (typeof url === "string") return url
  if (typeof result !== "string" || !result.trimStart().startsWith("{")) return null
  return jsonString(field(result, "url") ?? "")
}

function objectOf(result: unknown): { url?: unknown; results?: unknown } | null {
  if (typeof result === "string") {
    try {
      return objectOf(JSON.parse(result) as unknown)
    } catch {
      return null
    }
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) return null
  return result as { url?: unknown; results?: unknown }
}

/** A title that was not glued together by a shortened tool result. */
function intact(title: string) {
  return title.length > 0 && title.length <= 180 && !title.includes("…")
}

function field(text: string, name: string): string | null {
  const match = new RegExp(`"${name}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`).exec(text)
  return match?.[1] ?? null
}

function jsonString(value: string): string | null {
  try {
    const parsed = JSON.parse(`"${value}"`) as unknown
    return typeof parsed === "string" && parsed ? parsed : null
  } catch {
    return null
  }
}

/** One identity for a page, ignoring a trailing slash and a fragment. */
function sourceKey(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (url.includes("…")) return null
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  if (parsed.username || parsed.password) return null
  const path = parsed.pathname.replace(/\/+$/, "") || "/"
  return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${path}${parsed.search}`
}

function hostOf(url: string): string {
  try {
    const host = new URL(url.trim()).hostname
    return host.toLowerCase().startsWith("www.") ? host.slice(4) : host
  } catch {
    return ""
  }
}
