"use client"

import { useAuiState } from "@assistant-ui/react"
import {
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  CircleStopIcon,
  Loader2Icon,
  TelescopeIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"

import { duration, researchRun, runCounts, type ResearchRun } from "@/lib/research"
import { useResearchMode } from "@/lib/research-mode"
import { cn } from "@/lib/utils"

type StepState = "waiting" | "running" | "done" | "stopped"

const LIVE_LABEL = {
  planning: "Planning the research",
  researching: "Researching",
  writing: "Writing the report",
  done: "Researched",
  stopped: "Stopped",
} as const

export function ResearchActivity() {
  const parts = useAuiState((state) => state.message.parts)
  const running = useAuiState((state) => state.message.status?.type === "running")
  const isLast = useAuiState((state) => state.message.isLast)
  const requested = useResearchMode()
  const run = useMemo(
    () => researchRun(parts, running, requested && isLast),
    [parts, running, requested, isLast],
  )
  const working = run !== null && run.phase !== "done" && run.phase !== "stopped"
  const [open, setOpen] = useState(working)
  const [seenWorking, setSeenWorking] = useState(working)
  const [seconds, setSeconds] = useState<number | null>(null)
  const [now, setNow] = useState(0)

  if (seenWorking !== working) {
    setSeenWorking(working)
    setOpen(working)
  }

  useEffect(() => {
    if (!working) return
    const start = Date.now()
    const id = window.setInterval(() => setNow(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => {
      window.clearInterval(id)
      setSeconds(Math.max(1, Math.round((Date.now() - start) / 1000)))
    }
  }, [working])

  if (run === null) return null

  const counts = runCounts(run)
  const stopped = run.phase === "stopped"
  const verb = stopped ? "Stopped" : "Researched"
  const finished =
    seconds === null ? verb : `${verb} ${stopped ? "after" : "for"} ${duration(seconds)}`
  const header = working
    ? [LIVE_LABEL[run.phase], now > 0 ? duration(now) : null].filter(Boolean).join(" · ")
    : [finished, counts].filter(Boolean).join(" · ")

  return (
    <section
      data-slot="aui_research-activity"
      aria-label="Research progress"
      className="border-border bg-muted/20 my-2 rounded-lg border"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
      >
        <TelescopeIcon aria-hidden className="size-4 shrink-0" />
        <span
          role={working ? "status" : undefined}
          className={cn("min-w-0 flex-1 truncate", working && "shimmer motion-reduce:animate-none")}
        >
          {header}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn("size-3.5 shrink-0 transition-transform", open ? "rotate-0" : "-rotate-90")}
        />
      </button>
      {open ? <ResearchPhases run={run} /> : null}
    </section>
  )
}

function ResearchPhases({ run }: { run: ResearchRun }) {
  const order = ["planning", "researching", "writing", "done"] as const
  const stopped = run.phase === "stopped"
  const reached: (typeof order)[number] = run.phase !== "stopped"
    ? run.phase
    : run.workers.some((worker) => worker.state !== "done")
      ? "researching"
      : "writing"
  const at = order.indexOf(reached)
  const state = (phase: (typeof order)[number]): StepState => {
    const index = order.indexOf(phase)
    if (index < at) return "done"
    if (index > at) return "waiting"
    return stopped ? "stopped" : "running"
  }
  const reading = run.searches + run.pages > 0
  return (
    <ol className="border-border flex flex-col gap-3 border-t px-3 py-3 text-sm">
      <Phase title="Plan" state={state("planning")}>
        {run.plan.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {run.plan.map((item, index) => (
              <li key={index} className="text-muted-foreground flex items-start gap-2">
                <PlanMark status={item.status} live={!stopped} />
                <span className={cn(item.status === "completed" && "line-through decoration-1")}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Phase>
      <Phase
        title={run.workers.length > 0 ? `Research agents · ${run.workers.length}` : "Research agents"}
        state={state("researching")}
      >
        {run.workers.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {run.workers.map((worker) => (
              <li key={worker.id} className="text-muted-foreground flex items-start gap-2">
                {worker.state === "running" ? (
                  <Loader2Icon aria-label="Running" className="mt-0.5 size-3.5 shrink-0 animate-spin motion-reduce:animate-none" />
                ) : worker.state === "done" ? (
                  <CheckIcon aria-label="Done" className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : worker.state === "stopped" ? (
                  <CircleStopIcon aria-label="Stopped" className="mt-0.5 size-3.5 shrink-0" />
                ) : (
                  <XIcon aria-label="Failed" className="text-destructive mt-0.5 size-3.5 shrink-0" />
                )}
                <span>{worker.topic}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Phase>
      <Phase
        title="Reading"
        state={reading ? (run.phase === "researching" ? "running" : stopped ? state("researching") : "done") : state("researching")}
      >
        {reading ? (
          <p className="text-muted-foreground">
            {[
              run.searches > 0 ? `${run.searches} ${run.searches === 1 ? "search" : "searches"}` : null,
              `${run.pages} ${run.pages === 1 ? "page" : "pages"} read`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </Phase>
      <Phase title="Writing the report" state={state("writing")} />
    </ol>
  )
}

function Phase({
  title,
  state,
  children,
}: {
  title: string
  state: StepState
  children?: ReactNode
}) {
  return (
    <li className="flex gap-2.5">
      <PhaseMark state={state} />
      <div className="min-w-0 flex-1">
        <p className={cn(state === "waiting" ? "text-muted-foreground" : "text-foreground", "leading-5")}>
          {title}
        </p>
        {children ? <div className="mt-1 text-xs leading-5">{children}</div> : null}
      </div>
    </li>
  )
}

function PhaseMark({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-600 dark:text-emerald-400">
        <CheckIcon aria-hidden className="size-3" />
      </span>
    )
  }
  if (state === "running") {
    return <Loader2Icon aria-hidden className="text-foreground mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" />
  }
  if (state === "stopped") {
    return <CircleStopIcon aria-label="Stopped" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
  }
  return <CircleIcon aria-hidden className="text-muted-foreground/60 mt-0.5 size-4 shrink-0" />
}

function PlanMark({
  status,
  live,
}: {
  status: "pending" | "in_progress" | "completed"
  live: boolean
}) {
  if (status === "completed") return <CheckIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
  if (status === "in_progress" && live) {
    return <Loader2Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 animate-spin motion-reduce:animate-none" />
  }
  return <CircleIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 opacity-60" />
}
