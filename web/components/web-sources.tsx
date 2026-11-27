"use client"

import { useAuiState } from "@assistant-ui/react"
import { GlobeIcon } from "lucide-react"
import { useMemo } from "react"

import { pagesUsed } from "@/lib/web-sources"

/** The pages opened to write this reply, listed once under the answer. */
export function WebSources() {
  const parts = useAuiState((state) => state.message.parts)
  const sources = useMemo(() => pagesUsed(parts), [parts])
  if (sources.length === 0) return null

  return (
    <div data-slot="aui_assistant-sources" className="mt-3">
      <p className="mb-1.5 text-xs text-muted-foreground">Sources</p>
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
              <GlobeIcon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{source.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
