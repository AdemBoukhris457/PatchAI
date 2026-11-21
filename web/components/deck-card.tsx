"use client"

import { ArrowUpRight, Presentation } from "lucide-react"
import type { ToolCallMessagePartProps } from "@assistant-ui/react"

import { usePdfPreview } from "@/components/pdf-preview"
import { mono, paper, ShimmerLabel } from "@/components/surfaces"
import { cn } from "@/lib/utils"

const FILE_NAME = /^[a-z0-9][a-z0-9_-]{0,70}\.pptx$/

type SavedDeck = {
  filename: string
  slides: number | null
  title: string | null
}

export function DeckArtifact({
  argsText,
  result,
  status,
  isError,
}: Pick<ToolCallMessagePartProps, "argsText" | "result" | "status" | "isError">) {
  const generating = status.type === "running"
  const saved = generating ? null : readSaved(result)
  const failed = !generating && saved === null && (isError || typeof result === "string")
  const title = titleOf(argsText) ?? saved?.title ?? stemOf(argsText) ?? "Deck"
  const slides = saved?.slides
  const meta = saved
    ? slides === 1
      ? "PowerPoint · 1 slide"
      : slides
        ? `PowerPoint · ${slides} slides`
        : "PowerPoint"
    : failed
      ? "The PowerPoint could not be built"
      : "PowerPoint"
  const preview = usePdfPreview()
  const href = saved && !preview ? `/api/files/${encodeURIComponent(saved.filename)}` : undefined
  const onOpen =
    saved && preview ? () => preview.open({ filename: saved.filename, title }) : undefined
  const className = cn(
    paper,
    "group flex w-full max-w-xs items-center gap-3 rounded-[20px] p-3.5 text-left transition-transform duration-150",
    (href || onOpen) && "hover:-translate-y-px active:scale-[0.98]",
    preview?.document?.filename === saved?.filename && "ring-1 ring-foreground/15",
  )
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] text-muted-foreground">
        <Presentation
          className={cn("size-4", generating && "animate-pulse motion-reduce:animate-none")}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{title}</span>
        {generating ? (
          <span className={cn(mono, "flex items-center gap-1 text-muted-foreground")}>
            <ShimmerLabel className="relative inline-block leading-none">Writing</ShimmerLabel>
            <span>·</span>
            <span className="tabular-nums">{countWords(argsText)} words</span>
          </span>
        ) : (
          <span className={cn(mono, "text-muted-foreground")}>{meta}</span>
        )}
      </span>
      <ArrowUpRight className="size-3.5 text-foreground/35 opacity-0 transition-opacity group-hover:opacity-100" />
    </>
  )

  return (
    <div data-slot="aui_assistant-message-pptx" className="py-1">
      {onOpen ? (
        <button
          type="button"
          data-slot="artifact-card"
          onClick={onOpen}
          aria-expanded={preview?.document?.filename === saved?.filename}
          className={className}
        >
          {body}
        </button>
      ) : href ? (
        <a data-slot="artifact-card" href={href} download={saved?.filename} className={className}>
          {body}
        </a>
      ) : (
        <div data-slot="artifact-card" className={className}>
          {body}
        </div>
      )}
    </div>
  )
}

function titleOf(argsText: string) {
  const match = argsText.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/)
  if (!match?.[1]) return null
  return match[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim() || null
}

function stemOf(argsText: string) {
  const match = argsText.match(/"filename"\s*:\s*"([a-z0-9][a-z0-9_-]{0,70})\.pptx"/)
  return match?.[1]?.replace(/-/g, " ") || null
}

function countWords(argsText: string) {
  const chunks = argsText.matchAll(
    /"(?:text|title|caption|body|label|value|note|kicker|subtitle|attribution)"\s*:\s*"((?:\\.|[^"\\])*)"/g,
  )
  let count = 0
  for (const chunk of chunks) {
    count += chunk[1]?.split(/\s+/).filter(Boolean).length ?? 0
  }
  return count
}

function readSaved(result: unknown): SavedDeck | null {
  const value = typeof result === "string" ? parseJson(result) : result
  if (!value || typeof value !== "object") return null
  const record = value as { filename?: unknown; slides?: unknown; title?: unknown }
  if (typeof record.filename !== "string" || !FILE_NAME.test(record.filename)) return null
  return {
    filename: record.filename,
    slides: typeof record.slides === "number" ? record.slides : null,
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
