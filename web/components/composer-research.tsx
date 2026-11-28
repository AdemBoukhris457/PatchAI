"use client"

import { useAui, type LanguageModelConfig } from "@assistant-ui/react"
import { Check, ChevronDown, Telescope } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

import { useDismiss } from "@/components/composer-model"
import {
  RESEARCH_DEPTHS,
  researchDepth,
  setResearchDepth,
  setResearchMode,
  useResearchDepth,
  useResearchMode,
  type ResearchDepthId,
} from "@/lib/research-mode"

export function ComposerResearchToggle() {
  const aui = useAui()
  const on = useResearchMode()
  const depthId = useResearchDepth()
  const depth = researchDepth(depthId)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const [open, setOpen] = useState(false)

  useDismiss(open, root, setOpen)

  useEffect(() => {
    if (!on) return
    const config: LanguageModelConfig & { research: ResearchDepthId } = { research: depthId }
    return aui.modelContext.register({ getModelContext: () => ({ config }) })
  }, [aui, on, depthId])

  function choose(id: ResearchDepthId) {
    setResearchDepth(id)
    setResearchMode(true)
    setOpen(false)
  }

  const tone = on
    ? "bg-sky-500/10 text-sky-600 hover:bg-sky-500/15 dark:text-sky-400"
    : "text-muted-foreground hover:text-foreground hover:bg-muted"

  return (
    <div ref={root} className="relative inline-flex items-center">
      <button
        type="button"
        aria-pressed={on}
        title={on ? `Research is on at ${depth.name} depth` : "Research the web in depth"}
        onClick={() => setResearchMode(!on)}
        className={`inline-flex h-8 items-center gap-1 px-2 text-xs whitespace-nowrap outline-none focus-visible:ring-2 ${
          on ? "rounded-l-full pr-1" : "rounded-full"
        } ${tone}`}
      >
        <Telescope className="size-3.5" />
        Research
      </button>
      {on ? (
        <button
          type="button"
          aria-label={`Research depth, ${depth.name}`}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          className={`inline-flex h-8 items-center gap-0.5 rounded-r-full pr-2 pl-1 text-xs whitespace-nowrap outline-none focus-visible:ring-2 ${tone}`}
        >
          {depth.name}
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      ) : null}
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Research depth"
          className="bg-popover text-popover-foreground absolute bottom-full left-0 z-30 mb-2 w-60 rounded-[6px] border p-1 shadow-md"
        >
          {RESEARCH_DEPTHS.map((item) => {
            const selected = item.id === depthId
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(item.id)}
                className="hover:bg-muted flex w-full items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-left outline-none focus-visible:bg-muted"
              >
                <span className="min-w-0 flex-1 text-sm">{item.name}</span>
                <span className="text-muted-foreground text-xs">{item.detail}</span>
                <Check className={`size-3.5 shrink-0 ${selected ? "opacity-100" : "opacity-0"}`} />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
