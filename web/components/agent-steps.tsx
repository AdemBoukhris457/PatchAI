"use client"

import type { DynamicToolUIPart, ReasoningUIPart } from "ai"
import { CheckIcon, ChevronRightIcon, XIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { toolLabel, toolSummary } from "@/lib/tool-labels"
import { cn } from "@/lib/utils"

const stepClass =
  "group rounded-xl border border-border/60 bg-muted/30 text-sm open:bg-muted/40"
const summaryClass =
  "flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-muted-foreground outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
const chevronClass =
  "ml-auto size-4 shrink-0 transition-transform group-open:rotate-90"

function StepIcon({ state }: { state: DynamicToolUIPart["state"] }) {
  if (state === "output-error" || state === "output-denied") {
    return <XIcon aria-hidden="true" className="size-4 shrink-0 text-destructive" />
  }
  if (state === "output-available") {
    return <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
  }
  return <Spinner aria-hidden="true" className="size-4 shrink-0" />
}

function Detail({ title, children }: { title: string; children: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <pre className="max-h-64 overflow-auto rounded-lg bg-background p-2 font-mono text-xs leading-5 whitespace-pre-wrap break-words">
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

/** One tool call: a compact row that opens to show its input and result. */
export function ToolStep({ part }: { part: DynamicToolUIPart }) {
  const finished =
    part.state === "output-available" ||
    part.state === "output-error" ||
    part.state === "output-denied"
  const summary = toolSummary(part.input)
  const helper = part.toolMetadata?.subagent === true
  const hasInput =
    part.input !== undefined &&
    !(typeof part.input === "object" && part.input !== null && Object.keys(part.input).length === 0)

  return (
    <details className={cn(stepClass, helper && "ml-4")}>
      <summary className={summaryClass}>
        <StepIcon state={part.state} />
        <span className={cn("shrink-0", !finished && "text-foreground")}>
          {toolLabel(part.toolName, finished)}
        </span>
        {summary ? <span className="min-w-0 truncate">{summary}</span> : null}
        <ChevronRightIcon aria-hidden="true" className={chevronClass} />
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3">
        {hasInput ? <Detail title="Input">{asText(part.input)}</Detail> : null}
        {part.state === "output-available" ? (
          <Detail title="Result">{asText(part.output)}</Detail>
        ) : null}
        {part.state === "output-error" ? (
          <p className="text-destructive">{part.errorText}</p>
        ) : null}
        {!finished ? <p className="text-muted-foreground">Waiting for the result…</p> : null}
      </div>
    </details>
  )
}

/** The model's shared reasoning, folded away once it is done. */
export function ReasoningStep({ part }: { part: ReasoningUIPart }) {
  const thinking = part.state === "streaming"
  return (
    <details className={stepClass} open={thinking || undefined}>
      <summary className={summaryClass}>
        {thinking ? <Spinner aria-hidden="true" className="size-4 shrink-0" /> : null}
        <span className={cn(thinking && "text-foreground")}>
          {thinking ? "Thinking" : "Thought it through"}
        </span>
        <ChevronRightIcon aria-hidden="true" className={chevronClass} />
      </summary>
      <p className="px-3 pb-3 leading-6 whitespace-pre-wrap text-muted-foreground">
        {part.text}
      </p>
    </details>
  )
}
