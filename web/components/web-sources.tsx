"use client"

import { useAuiState } from "@assistant-ui/react"
import { GlobeIcon } from "lucide-react"
import { useMemo } from "react"

import { numberedSources, type NumberedSource } from "@/lib/citations"

export function WebSources() {
  const parts = useAuiState((state) => state.message.parts)
  const sources = useMemo(() => numberedSources(parts), [parts])
  if (sources.length === 0) return null
  const cited = sources.filter((source) => source.number !== null)
  const rest = sources.filter((source) => source.number === null)
  return (
    <div data-slot="aui_assistant-sources" className="mt-3 flex flex-col gap-2">
      {cited.length > 0 ? (
        <SourceList label={`Sources · ${cited.length}`} sources={cited} />
      ) : null}
      {rest.length > 0 ? (
        <SourceList
          label={cited.length > 0 ? `Also read · ${rest.length}` : `Sources · ${rest.length}`}
          sources={rest}
        />
      ) : null}
    </div>
  )
}

function SourceList({ label, sources }: { label: string; sources: readonly NumberedSource[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <li key={source.url} className="max-w-full">
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              title={source.url}
              className="inline-flex max-w-72 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
            >
              {source.number !== null ? (
                <span className="bg-background text-muted-foreground inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-medium">
                  {source.number}
                </span>
              ) : (
                <GlobeIcon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{source.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
