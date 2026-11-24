"use client"

import { ArrowUpRight, FileText } from "lucide-react"
import type { ToolCallMessagePartProps } from "@assistant-ui/react"

import { usePdfPreview } from "@/components/pdf-preview"
import { useReportPreview } from "@/components/report-preview"
import { mono, paper, ShimmerLabel } from "@/components/surfaces"
import { cn } from "@/lib/utils"

const FILE_NAME = /^[a-z0-9][a-z0-9_-]{0,70}\.pdf$/

type SavedPdf = {
  filename: string
  pages: number | null
  title: string | null
}

export function PdfCard({
  title,
  meta,
  generating = false,
  words = 0,
  href,
  filename,
  onOpen,
  active = false,
}: {
  title: string
  meta: string
  generating?: boolean
  words?: number
  href?: string
  filename?: string
  onOpen?: () => void
  active?: boolean
}) {
  const className = cn(
    paper,
    "group flex w-full max-w-xs items-center gap-3 rounded-[20px] p-3.5 text-left transition-transform duration-150",
    (href || onOpen) && "hover:-translate-y-px active:scale-[0.98]",
    active && "ring-1 ring-foreground/15",
  )
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] text-muted-foreground">
        <FileText
          className={cn("size-4", generating && "animate-pulse motion-reduce:animate-none")}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{title}</span>
        {generating ? (
          <span className={cn(mono, "flex items-center gap-1 text-muted-foreground")}>
            <ShimmerLabel className="relative inline-block leading-none">Writing</ShimmerLabel>
            <span>·</span>
            <span className="tabular-nums">{words} words</span>
          </span>
        ) : (
          <span className={cn(mono, "text-muted-foreground")}>{meta}</span>
        )}
      </span>
      <ArrowUpRight className="size-3.5 text-foreground/35 opacity-0 transition-opacity group-hover:opacity-100" />
    </>
  )
  if (onOpen) {
    return (
      <button
        type="button"
        data-slot="artifact-card"
        onClick={onOpen}
        aria-expanded={active}
        className={className}
      >
        {body}
      </button>
    )
  }
  if (!href) {
    return (
      <div data-slot="artifact-card" className={className}>
        {body}
      </div>
    )
  }
  return (
    <a
      data-slot="artifact-card"
      href={href}
      download={filename}
      className={className}
    >
      {body}
    </a>
  )
}

export function PdfArtifact({
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
  const title = titleOf(argsText) ?? saved?.title ?? stemOf(argsText) ?? "Document"
  const pages = saved?.pages
  const meta = saved
    ? pages === 1
      ? "PDF · 1 page"
      : pages
        ? `PDF · ${pages} pages`
        : "PDF"
    : failed
      ? "The PDF could not be built"
      : "PDF"

  return (
    <div data-slot="aui_assistant-message-pdf" className="py-1">
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
  const match = argsText.match(/"filename"\s*:\s*"([a-z0-9][a-z0-9_-]{0,70})\.pdf"/)
  return match?.[1]?.replace(/-/g, " ") || null
}

function countWords(argsText: string) {
  const chunks = argsText.matchAll(
    /"(?:text|title|caption|summary|label|value|code|items)"\s*:\s*"((?:\\.|[^"\\])*)"/g,
  )
  let count = 0
  for (const chunk of chunks) {
    count += chunk[1]?.split(/\s+/).filter(Boolean).length ?? 0
  }
  return count
}

function readSaved(result: unknown): SavedPdf | null {
  const value = typeof result === "string" ? parseJson(result) : result
  if (!value || typeof value !== "object") return null
  const record = value as { filename?: unknown; pages?: unknown; title?: unknown }
  if (typeof record.filename !== "string" || !FILE_NAME.test(record.filename)) return null
  return {
    filename: record.filename,
    pages: typeof record.pages === "number" ? record.pages : null,
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
