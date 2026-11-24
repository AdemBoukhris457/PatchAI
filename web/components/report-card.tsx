"use client"

import { LayoutDashboard } from "lucide-react"
import { useEffect, useRef } from "react"
import type { ToolCallMessagePartProps } from "@assistant-ui/react"

import { usePdfPreview } from "@/components/pdf-preview"
import { useReportPreview } from "@/components/report-preview"
import { paper } from "@/components/surfaces"
import { readReport } from "@/lib/report"
import { cn } from "@/lib/utils"

export function ReportArtifact({
  argsText,
  result,
  status,
  isError,
}: Pick<ToolCallMessagePartProps, "argsText" | "result" | "status" | "isError">) {
  const generating = status.type === "running"
  const saved = generating ? null : readReport(result)
  const failed = !generating && saved === null && (isError || typeof result === "string")
  const preview = useReportPreview()
  const pdf = usePdfPreview()
  const title = saved?.title ?? titleOf(argsText) ?? "Report"
  const live = useRef(false)

  useEffect(() => {
    if (generating) {
      live.current = true
      return
    }
    if (!live.current || !saved || !preview) return
    live.current = false
    pdf?.close()
    preview.open(saved)
  }, [generating, pdf, preview, saved])

  return (
    <div data-slot="aui_assistant-message-report" className="py-1">
      <button
        type="button"
        data-slot="artifact-card"
        disabled={!saved}
        aria-expanded={preview?.report?.id === saved?.id}
        onClick={() => {
          if (!saved || !preview) return
          pdf?.close()
          preview.open(saved)
        }}
        className={cn(
          paper,
          "group flex w-full max-w-xs items-center gap-3 rounded-[20px] p-3.5 text-left transition-transform duration-150",
          saved && "hover:-translate-y-px active:scale-[0.98]",
          preview?.report?.id === saved?.id && "ring-foreground/15 ring-1",
        )}
      >
        <span className="bg-foreground/[0.05] text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
          <LayoutDashboard className={cn("size-4", generating && "animate-pulse motion-reduce:animate-none")} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium">{title}</span>
          <span className="text-muted-foreground font-mono text-xs">
            {generating ? "Composing" : failed || (saved && !saved.ok) ? "The report needs a revision" : "Report"}
          </span>
        </span>
      </button>
    </div>
  )
}

function titleOf(argsText: string) {
  const match = argsText.match(/"title"\s*:\s*"([a-z][a-z0-9_]{0,40})"/)
  if (!match?.[1]) return null
  const words = match[1].replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
