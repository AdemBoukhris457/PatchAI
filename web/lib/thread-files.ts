import type { ThreadMessage } from "@assistant-ui/react"

const FILE_TOOLS = new Set([
  "create_pdf",
  "update_pdf",
  "create_pptx",
  "update_pptx",
])

const FILE_NAME = /^[a-z0-9][a-z0-9_-]{0,70}\.(pdf|pptx)$/

export type ThreadFile = {
  filename: string
  title: string | null
  kind: "pdf" | "pptx"
}

export function fileRequest(filename: string) {
  return `Use the file ${filename}.`
}

export function threadFiles(messages: readonly ThreadMessage[]): ThreadFile[] {
  const saved = new Map<string, ThreadFile>()
  for (const message of messages) {
    if (message.role !== "assistant") continue
    for (const part of message.content) {
      const file = fileFrom(part)
      if (file) saved.set(file.filename, file)
    }
  }
  return [...saved.values()]
}

export function threadFileKey(messages: readonly ThreadMessage[]) {
  return JSON.stringify(threadFiles(messages))
}

function fileFrom(part: ThreadMessage["content"][number]): ThreadFile | null {
  if (part.type !== "tool-call" || part.isError || part.isPreliminary) return null
  if (!FILE_TOOLS.has(part.toolName)) return null
  const record = recordOf(part.result)
  if (!record) return null
  const filename = record.filename
  if (typeof filename !== "string" || !FILE_NAME.test(filename)) return null
  const kind = filename.endsWith(".pptx") ? "pptx" : "pdf"
  const title = textOf(record.title) ?? textOf(argsTitle(part))
  return { filename, title, kind }
}

function argsTitle(part: { args: unknown }) {
  if (!part.args || typeof part.args !== "object" || !("title" in part.args)) return null
  return part.args.title
}

function textOf(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function recordOf(result: unknown) {
  const value = typeof result === "string" ? parseJson(result) : result
  if (!value || typeof value !== "object") return null
  return value as { filename?: unknown; title?: unknown }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
