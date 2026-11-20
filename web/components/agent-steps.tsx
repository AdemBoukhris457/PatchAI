"use client"

import type { DynamicToolUIPart, ReasoningUIPart } from "ai"
import { CheckIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"

import { Spinner } from "@/components/ui/spinner"
import { toolLabel, toolSummary } from "@/lib/tool-labels"
import { cn } from "@/lib/utils"

export type ActivityPart = DynamicToolUIPart | ReasoningUIPart

function failed(part: DynamicToolUIPart) {
  return part.state === "output-error" || part.state === "output-denied"
}

function finished(part: DynamicToolUIPart) {
  return part.state === "output-available" || failed(part)
}

function busy(part: ActivityPart) {
  return part.type === "reasoning" ? part.state === "streaming" : !finished(part)
}

function headline(parts: ActivityPart[], working: boolean) {
  const tools = parts.filter(
    (part): part is DynamicToolUIPart => part.type === "dynamic-tool",
  )
  if (working) {
    const current = parts.findLast(busy)
    if (current?.type === "dynamic-tool") {
      return toolLabel(current.toolName, false)
    }
    return "Thinking"
  }
  if (tools.length === 0) {
    return "Thought it through"
  }
  const used = `Used ${tools.length} ${tools.length === 1 ? "tool" : "tools"}`
  const failures = tools.filter(failed).length
  return failures > 0 ? `${used}, ${failures} failed` : used
}

/** Height-animated region that stays out of the tab order while closed. */
function Reveal({
  id,
  open,
  children,
}: {
  id?: string
  open: boolean
  children: ReactNode
}) {
  return (
    <div
      id={id}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

function Marker({ part }: { part: ActivityPart }) {
  if (part.type === "reasoning") {
    return <span className="size-1.5 rounded-full bg-muted-foreground/60" />
  }
  if (failed(part)) {
    return <XIcon aria-label="Failed" className="size-3.5 text-destructive" />
  }
  if (finished(part)) {
    return <CheckIcon aria-label="Done" className="size-3.5 text-muted-foreground" />
  }
  return <Spinner aria-label="Running" className="size-3.5 text-muted-foreground" />
}

function Detail({ title, children }: { title: string; children: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{title}</p>
      <pre className="max-h-60 overflow-auto rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs leading-5 whitespace-pre-wrap break-words text-foreground/90">
        {children}
      </pre>
    </div>
  )
}

function asText(value: unknown) {
  if (typeof value === "string") {
    return value
  }
  return JSON.stringify(value, null, 2) ?? ""
}

function hasInput(input: unknown) {
  if (input === undefined || input === null) {
    return false
  }
  return typeof input !== "object" || Object.keys(input).length > 0
}

function ToolRow({ part }: { part: DynamicToolUIPart }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const done = finished(part)
  const summary = toolSummary(part.input)

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="group/row flex min-w-0 items-center gap-2 rounded-md py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "shrink-0 transition-colors group-hover/row:text-foreground",
            done ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {toolLabel(part.toolName, done)}
        </span>
        {summary ? (
          <span className="min-w-0 truncate text-muted-foreground/80">
            {summary}
          </span>
        ) : null}
        <ChevronRightIcon
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover/row:opacity-100 group-focus-visible/row:opacity-100",
            open && "rotate-90 opacity-100",
          )}
        />
      </button>
      <Reveal id={id} open={open}>
        <div className="flex flex-col gap-3 pt-1 pb-2">
          {hasInput(part.input) ? (
            <Detail title="Input">{asText(part.input)}</Detail>
          ) : null}
          {part.state === "output-available" ? (
            <Detail title="Result">{asText(part.output)}</Detail>
          ) : null}
          {part.state === "output-error" ? (
            <p className="text-sm text-destructive">{part.errorText}</p>
          ) : null}
          {!done ? (
            <p className="text-sm text-muted-foreground">Waiting for the result…</p>
          ) : null}
        </div>
      </Reveal>
    </div>
  )
}

function Step({ part }: { part: ActivityPart }) {
  const helper =
    part.type === "dynamic-tool" && part.toolMetadata?.subagent === true
  return (
    <li className={cn("relative pl-5", helper && "ml-4")}>
      <span className="absolute top-[7px] -left-2 flex size-4 items-center justify-center bg-background">
        <Marker part={part} />
      </span>
      {part.type === "reasoning" ? (
        <p className="py-1 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
          {part.text}
        </p>
      ) : (
        <ToolRow part={part} />
      )}
    </li>
  )
}

/**
 * One run of agent work inside a reply. It stays open with a live headline
 * while the agent works, then folds into a one-line summary.
 */
export function AgentActivity({
  parts,
  working,
}: {
  parts: ActivityPart[]
  working: boolean
}) {
  const [choice, setChoice] = useState<boolean | null>(null)
  const open = choice ?? working
  const id = useId()

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setChoice(!open)}
        className="group/head flex items-center gap-1 self-start rounded-md py-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn(working && "activity-shimmer")}>
          {headline(parts, working)}
        </span>
        <ChevronRightIcon
          aria-hidden="true"
          className={cn(
            "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
      </button>
      <Reveal id={id} open={open}>
        <ol className="mt-1 ml-2 flex flex-col border-l border-border pb-1">
          {parts.map((part, index) => (
            <Step
              key={part.type === "dynamic-tool" ? part.toolCallId : `reasoning-${index}`}
              part={part}
            />
          ))}
        </ol>
      </Reveal>
    </div>
  )
}
