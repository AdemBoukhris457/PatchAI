import type { ThreadMessage } from "@assistant-ui/react"
import type { Spec } from "generative-frame/spec"

export type ReportRecord = {
  id: string
  title: string
  spec: Spec
  ok: boolean
}

export function threadReports(messages: readonly ThreadMessage[]): ReportRecord[] {
  const saved = new Map<string, ReportRecord>()
  for (const message of messages) {
    if (message.role !== "assistant") continue
    for (const part of message.content) {
      if (part.type !== "tool-call" || part.toolName !== "render_spec" || part.isError) continue
      const report = readReport(part.result)
      if (report) saved.set(report.id, report)
    }
  }
  return [...saved.values()]
}

export function readReport(result: unknown): ReportRecord | null {
  const value = typeof result === "string" ? parseJson(result) : result
  if (!value || typeof value !== "object") return null
  const record = value as { title?: unknown; spec?: unknown; ok?: unknown }
  if (typeof record.title !== "string" || !record.title.trim()) return null
  if (!isSpec(record.spec)) return null
  return {
    id: record.title,
    title: headingOf(record.spec) ?? labelOf(record.title),
    spec: record.spec,
    ok: record.ok !== false,
  }
}

function isSpec(value: unknown): value is Spec {
  if (!value || typeof value !== "object") return false
  const spec = value as { root?: unknown; elements?: unknown }
  return typeof spec.root === "string" && !!spec.elements && typeof spec.elements === "object"
}

function headingOf(spec: Spec) {
  for (const element of Object.values(spec.elements)) {
    if (element.type !== "Header") continue
    const text = element.props?.text
    if (typeof text === "string" && text.trim()) return text.trim()
  }
  return null
}

function labelOf(id: string) {
  const words = id.replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
