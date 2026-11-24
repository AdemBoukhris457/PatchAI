"use client"

import { X } from "lucide-react"
import { toSpecCatalog } from "@assistant-ui/generative-ui/spec"
import type { Spec } from "generative-frame/spec"
import { SpecRenderer } from "generative-frame/spec/react"
import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

import { styledGenerativeUILibrary } from "@/components/generative-ui"
import { ghostButton } from "@/components/surfaces"
import { cn } from "@/lib/utils"

const { catalog, components } = toSpecCatalog(styledGenerativeUILibrary)

export type OpenReport = {
  id: string
  title: string
  spec: Spec
  revision: number
}

type ReportPreviewApi = {
  report: OpenReport | null
  open: (report: { id: string; title: string; spec: Spec }) => void
  close: () => void
}

const ReportPreviewContext = createContext<ReportPreviewApi | null>(null)

export function ReportPreviewProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<OpenReport | null>(null)
  const api = useMemo<ReportPreviewApi>(
    () => ({
      report,
      open(next) {
        setReport((current) => ({
          id: next.id,
          title: next.title,
          spec: next.spec,
          revision: current?.id === next.id ? current.revision + 1 : 1,
        }))
      },
      close() {
        setReport(null)
      },
    }),
    [report],
  )
  return <ReportPreviewContext.Provider value={api}>{children}</ReportPreviewContext.Provider>
}

export function useReportPreview() {
  return useContext(ReportPreviewContext)
}

export function ReportPreviewPanel() {
  const preview = useReportPreview()
  if (!preview?.report) return null
  return <ReportCanvas report={preview.report} onClose={preview.close} />
}

function ReportCanvas({ report, onClose }: { report: OpenReport; onClose: () => void }) {
  return (
    <aside className="bg-background flex h-full min-h-0 w-[min(52rem,62%)] shrink-0 flex-col border-l max-lg:absolute max-lg:inset-0 max-lg:z-30 max-lg:w-full max-lg:border-l-0">
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{report.title}</p>
          <p className="text-muted-foreground text-xs">Report</p>
        </div>
        <button
          type="button"
          aria-label="Close the report"
          onClick={onClose}
          className={cn(ghostButton, "size-7")}
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <SpecRenderer
            key={`${report.id}:${report.revision}`}
            spec={report.spec}
            catalog={catalog}
            components={components}
          />
        </div>
      </div>
    </aside>
  )
}
