"use client"

import type { ToolCallMessagePartProps } from "@assistant-ui/react"

import { PdfCard } from "@/components/pdf-card"
import { usePdfPreview } from "@/components/pdf-preview"
import { useReportPreview } from "@/components/report-preview"

const FILE_NAME = /^[a-z0-9][a-z0-9_-]{0,70}\.docx$/

type SavedWord = {
  filename: string
  words: number | null
  title: string | null
}

export function WordArtifact({
  argsText,
  result,
  status,
  isError,
}: Pick<ToolCallMessagePartProps, "argsText" | "result" | "status" | "isError">) {
  const generating = status.type === "running"
  const saved = generating ? null : readSaved(result)
  const failed = !generating && saved === null && (isError || typeof result === "string")
  const preview = usePdfPreview()
  const reports = useReportPreview()
  const title = titleOf(argsText) ?? saved?.title ?? stemOf(argsText) ?? "Brief"
  const words = saved?.words
  const meta = saved
    ? words === 1
      ? "Word · 1 word"
      : words
        ? `Word · ${words} words`
        : "Word"
    : failed
      ? "The Word document could not be built"
      : "Word"

  return (
    <div data-slot="aui_assistant-message-word" className="py-1">
      <PdfCard
        title={title}
        meta={meta}
        generating={generating}
        words={countWords(argsText)}
        href={saved && !preview ? `/api/files/${encodeURIComponent(saved.filename)}` : undefined}
        filename={saved?.filename}
        active={preview?.document?.filename === saved?.filename}
        onOpen={
          saved && preview
            ? () => {
                reports?.close()
                preview.open({ filename: saved.filename, title })
              }
            : undefined
        }
      />
    </div>
  )
}

function titleOf(argsText: string) {
  const match = argsText.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/)
  if (!match?.[1]) return null
  return match[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim() || null
}

function stemOf(argsText: string) {
  const match = argsText.match(/"filename"\s*:\s*"([a-z0-9][a-z0-9_-]{0,70})\.docx"/)
  return match?.[1]?.replace(/-/g, " ") || null
}

function countWords(argsText: string) {
  const chunks = argsText.matchAll(
    /"(?:text|title|subtitle|author)"\s*:\s*"((?:\\.|[^"\\])*)"/g,
  )
  let count = 0
  for (const chunk of chunks) {
    count += chunk[1]?.split(/\s+/).filter(Boolean).length ?? 0
  }
  return count
}

function readSaved(result: unknown): SavedWord | null {
  const value = typeof result === "string" ? parseJson(result) : result
  if (!value || typeof value !== "object") return null
  const record = value as { filename?: unknown; words?: unknown; title?: unknown }
  if (typeof record.filename !== "string" || !FILE_NAME.test(record.filename)) return null
  return {
    filename: record.filename,
    words: typeof record.words === "number" ? record.words : null,
    title: typeof record.title === "string" && record.title.trim() ? record.title.trim() : null,
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
