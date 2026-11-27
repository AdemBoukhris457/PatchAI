"use client"

import { useAuiState } from "@assistant-ui/react"
import { GlobeIcon } from "lucide-react"
import { Children, useMemo, type ComponentProps, type ReactNode } from "react"
import { defaultComponents } from "streamdown"

import { numberedSources, openedPage } from "@/lib/citations"

type LinkProps = ComponentProps<typeof defaultComponents.a>

function citationNumber(children: ReactNode) {
  const items = Children.toArray(children)
  if (items.length !== 1) return null
  const only = items[0]
  if (typeof only !== "string" && typeof only !== "number") return null
  const text = String(only).trim()
  return /^\d{1,3}$/.test(text) ? text : null
}

/** A `[n](url)` link becomes a numbered pill when that page was opened. */
export function AnswerLink(props: LinkProps) {
  const number = citationNumber(props.children)
  if (number === null || typeof props.href !== "string") {
    return <defaultComponents.a {...props} />
  }
  return <CitationPill number={number} href={props.href} />
}

function CitationPill({ number, href }: { number: string; href: string }) {
  const parts = useAuiState((state) => state.message.parts)
  const sources = useMemo(() => numberedSources(parts), [parts])
  const page = openedPage(sources, href)
  if (page === null) {
    return <span className="text-muted-foreground text-xs">[{number}]</span>
  }
  return (
    <span className="group/cite relative inline-block align-baseline">
      <a
        href={page.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Source ${number}: ${page.title}`}
        data-slot="aui_citation"
        className="bg-muted text-muted-foreground hover:bg-foreground hover:text-background focus-visible:bg-foreground focus-visible:text-background mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 align-[0.1em] text-[10px] leading-none font-medium no-underline transition-colors outline-none"
      >
        {number}
      </a>
      <span
        role="tooltip"
        className="bg-popover text-popover-foreground pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-1.5 w-64 -translate-x-1/2 rounded-[6px] border p-2.5 text-left opacity-0 shadow-md transition-opacity duration-150 group-focus-within/cite:visible group-focus-within/cite:opacity-100 group-hover/cite:visible group-hover/cite:opacity-100"
      >
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <GlobeIcon aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{page.host}</span>
        </span>
        <span className="mt-1 line-clamp-2 block text-sm leading-snug font-medium">{page.title}</span>
        <span className="text-muted-foreground mt-1 block truncate text-xs">{page.url}</span>
      </span>
    </span>
  )
}
