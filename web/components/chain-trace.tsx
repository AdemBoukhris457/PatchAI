"use client"

import { useScrollLock, useAuiState, type PartState } from "@assistant-ui/react"
import { ChevronDownIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "@/components/collapsible-root"
import { toolLabel, workSummary } from "@/lib/tool-labels"
import { cn } from "@/lib/utils"

const FOLD_MS = 250

type TraceGroup = {
  indices: readonly number[]
}

function headingFrom(text: string) {
  const marks = text.match(/\*\*([^*\n]{2,80})\*\*/g)
  const raw = marks?.at(-1)?.replaceAll("*", "").trim()
  return raw ? raw : null
}

function isTool(
  part: PartState | undefined,
): part is PartState & { type: "tool-call"; toolName: string; isError?: boolean } {
  return part?.type === "tool-call"
}

function failed(part: PartState & { type: "tool-call"; isError?: boolean }) {
  return part.isError === true || part.status.type === "incomplete"
}

function liveLabel(parts: readonly (PartState | undefined)[]) {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index]
    if (isTool(part) && part.status.type === "running") {
      return toolLabel(part.toolName, false)
    }
  }
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index]
    if (part?.type === "reasoning") {
      const heading = headingFrom(part.text)
      if (heading) return heading
    }
  }
  return "Working"
}

function doneLabel(parts: readonly (PartState | undefined)[]) {
  const tools = parts.filter(isTool)
  const failures = tools.filter(failed).length
  const work = workSummary(
    tools
      .filter((part) => !failed(part) && part.status.type === "complete")
      .map((part) => toolLabel(part.toolName, true)),
  )
  if (work && failures > 0) return `${work} · ${failures} failed`
  if (work) return work
  if (failures > 0) return `${failures} failed`
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index]
    if (part?.type === "reasoning") {
      const heading = headingFrom(part.text)
      if (heading) return heading
    }
  }
  return parts.some((part) => part?.type === "reasoning") ? "Thought" : "Worked"
}

function ReasoningFade({ side }: { side: "top" | "bottom" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 h-8",
        side === "top"
          ? "top-0 bg-[linear-gradient(to_bottom,var(--color-background),transparent)]"
          : "bottom-0 bg-[linear-gradient(to_top,var(--color-background),transparent)]",
      )}
    />
  )
}

export function ReasoningTrace({
  streaming,
  children,
}: {
  streaming: boolean
  children: ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!streaming) return
    const scrollEl = scrollRef.current
    const contentEl = contentRef.current
    if (!scrollEl || !contentEl) return

    let pinned = true
    let lastScrollTop = scrollEl.scrollTop
    let lastScrollHeight = scrollEl.scrollHeight
    const atBottom = () =>
      Math.abs(
        scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight,
      ) <= 1 || scrollEl.scrollHeight <= scrollEl.clientHeight
    const pin = () => {
      if (!pinned) return
      scrollEl.scrollTop = scrollEl.scrollHeight
    }
    const onScroll = () => {
      if (atBottom()) {
        pinned = true
      } else if (
        scrollEl.scrollTop < lastScrollTop &&
        scrollEl.scrollHeight === lastScrollHeight
      ) {
        pinned = false
      }
      lastScrollTop = scrollEl.scrollTop
      lastScrollHeight = scrollEl.scrollHeight
    }

    pin()
    scrollEl.addEventListener("scroll", onScroll)
    const observer = new ResizeObserver(pin)
    observer.observe(contentEl)
    return () => {
      scrollEl.removeEventListener("scroll", onScroll)
      observer.disconnect()
    }
  }, [streaming])

  if (!streaming) {
    return (
      <div className="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed">
        {children}
      </div>
    )
  }

  return (
    <div className="relative">
      <ReasoningFade side="top" />
      <div
        ref={scrollRef}
        className="text-muted-foreground max-h-64 overflow-y-auto text-sm leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div ref={contentRef} className="flex flex-col gap-3 py-2">
          {children}
        </div>
      </div>
      <ReasoningFade side="bottom" />
    </div>
  )
}

function finishedLine(done: string, seconds: number | null) {
  const parts = [
    seconds === null ? null : `Worked for ${seconds}s`,
    done === "Worked" ? null : done,
  ].filter((part) => part !== null)
  return parts.length > 0 ? parts.join(" · ") : "Worked"
}

export function ChainOfThought({
  group,
  children,
}: {
  group: TraceGroup
  children: ReactNode
}) {
  const live = useAuiState((state) =>
    liveLabel(group.indices.map((index) => state.message.parts[index])),
  )
  const done = useAuiState((state) =>
    doneLabel(group.indices.map((index) => state.message.parts[index])),
  )
  const working = useAuiState((state) => {
    if (state.message.status?.type !== "running") return false
    let last = -1
    for (let index = state.message.parts.length - 1; index >= 0; index -= 1) {
      const type = state.message.parts[index]?.type
      if (type === "reasoning" || type === "tool-call") {
        last = index
        break
      }
    }
    return group.indices.includes(last)
  })
  const [open, setOpen] = useState(working)
  const [seenWorking, setSeenWorking] = useState(working)
  const [seconds, setSeconds] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const lockScroll = useScrollLock(rootRef, FOLD_MS)

  if (seenWorking !== working) {
    setSeenWorking(working)
    setOpen(working)
  }

  useEffect(() => {
    if (!working) return
    const start = Date.now()
    return () => {
      setSeconds(Math.max(1, Math.round((Date.now() - start) / 1000)))
    }
  }, [working])

  const label = working ? live : finishedLine(done, seconds)
  const waiting = working && label === "Working"

  return (
    <CollapsibleRoot
      ref={rootRef}
      open={open}
      onOpenChange={(next) => {
        lockScroll()
        setOpen(next)
      }}
      className="group/chain my-1 w-full"
    >
      <CollapsibleTrigger
        className="group/trigger text-muted-foreground hover:text-foreground flex max-w-full origin-left items-center gap-2 py-1 text-left text-sm transition-colors active:scale-[0.98] motion-reduce:transition-none"
      >
        {waiting ? (
          <span
            className="bg-foreground/70 size-1.5 shrink-0 animate-pulse rounded-full motion-reduce:animate-none"
            aria-hidden
          />
        ) : null}
        <span
          className={cn(
            "min-w-0 leading-snug",
            working && "shimmer motion-reduce:animate-none",
          )}
        >
          {label}
        </span>
        <ChevronDownIcon
          className="size-3.5 shrink-0 -rotate-90 transition-transform duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)] group-data-open/trigger:rotate-0 group-data-panel-open/trigger:rotate-0 motion-reduce:transition-none"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "overflow-hidden outline-none",
          "data-closed:animate-collapsible-up data-open:animate-collapsible-down",
          "data-closed:fill-mode-forwards data-closed:pointer-events-none",
          "motion-reduce:animate-none",
          "[--tw-duration:250ms]",
        )}
      >
        <div className="flex flex-col gap-2 py-1 ps-1">{children}</div>
      </CollapsibleContent>
    </CollapsibleRoot>
  )
}
