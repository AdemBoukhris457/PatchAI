/** The progress of one research run, read from the reply's parts. */

export const RESEARCH_AGENT = "research-agent"

export type ResearchPhase = "planning" | "researching" | "writing" | "done" | "stopped"

export type PlanItem = { text: string; status: "pending" | "in_progress" | "completed" }

export type ResearchWorker = {
  id: string
  topic: string
  state: "running" | "done" | "failed" | "stopped"
}

export type ResearchRun = {
  phase: ResearchPhase
  plan: PlanItem[]
  workers: ResearchWorker[]
  searches: number
  pages: number
}

type PartLike = {
  readonly type: string
  readonly toolName?: string
  readonly toolCallId?: string
  readonly args?: unknown
  readonly argsText?: string
  readonly isError?: boolean
  readonly status?: { readonly type: string; readonly reason?: string }
  readonly text?: string
  readonly providerMetadata?: unknown
}

/** Whether a tool step ran inside a research worker rather than the lead. */
export function fromWorker(part: { readonly providerMetadata?: unknown }) {
  const meta = part.providerMetadata
  if (!meta || typeof meta !== "object") return false
  const patchai = (meta as { patchai?: unknown }).patchai
  return !!patchai && typeof patchai === "object" && (patchai as { subagent?: unknown }).subagent === true
}

/**
 * The run, or `null` when the reply did not send a research worker.
 * A reply that is still running in research mode is planning until its
 * first worker starts.
 */
export function researchRun(
  parts: readonly PartLike[],
  running: boolean,
  requested = false,
): ResearchRun | null {
  const workers: ResearchWorker[] = []
  let plan: PlanItem[] = []
  let searches = 0
  let pages = 0
  let lastWorker = -1
  let lastText = -1
  parts.forEach((part, index) => {
    if (part.type === "text" && (part.text ?? "").trim()) lastText = index
    if (part.type !== "tool-call") return
    const args = argsOf(part)
    if (part.toolName === "task" && args?.subagent_type === RESEARCH_AGENT) {
      lastWorker = index
      const state = toolState(part)
      workers.push({
        id: part.toolCallId ?? String(index),
        topic: topicOf(args.description),
        state: state === "running" && !running ? "stopped" : state,
      })
    } else if (part.toolName === "write_todos" && !fromWorker(part)) {
      const next = planOf(args?.todos)
      if (next.length > 0) plan = next
    } else if (part.toolName === "search_web" && toolState(part) !== "failed") {
      searches += 1
    } else if (part.toolName === "read_web_page" && toolState(part) === "done") {
      pages += 1
    }
  })
  if (workers.length === 0) {
    return requested && running && lastText < 0
      ? { phase: "planning", plan, workers, searches, pages }
      : null
  }
  return { phase: phaseOf(workers, lastWorker, lastText, running), plan, workers, searches, pages }
}

/** "3 agents · 11 searches · 9 pages", leaving out a zero count. */
export function runCounts(run: ResearchRun) {
  return [
    count(run.workers.length, "agent"),
    count(run.searches, "search", "searches"),
    count(run.pages, "page"),
  ]
    .filter((item) => item !== null)
    .join(" · ")
}

/** "2m 14s" or "48s". */
export function duration(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

function phaseOf(
  workers: readonly ResearchWorker[],
  lastWorker: number,
  lastText: number,
  running: boolean,
): ResearchPhase {
  if (!running) return workers.some((worker) => worker.state === "stopped") ? "stopped" : "done"
  if (workers.some((worker) => worker.state === "running")) return "researching"
  return lastText > lastWorker ? "writing" : "researching"
}

function count(value: number, one: string, many = `${one}s`) {
  if (value === 0) return null
  return `${value} ${value === 1 ? one : many}`
}

function toolState(part: PartLike): ResearchWorker["state"] {
  if (part.status?.type === "incomplete" && part.status.reason === "cancelled") return "stopped"
  if (part.isError || part.status?.type === "incomplete") return "failed"
  return part.status?.type === "complete" ? "done" : "running"
}

function argsOf(part: PartLike): Record<string, unknown> | null {
  if (part.args && typeof part.args === "object" && !Array.isArray(part.args)) {
    return part.args as Record<string, unknown>
  }
  if (!part.argsText) return null
  try {
    const parsed = JSON.parse(part.argsText) as unknown
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** The first sentence of a worker's assignment, short enough for one row. */
function topicOf(description: unknown) {
  if (typeof description !== "string") return "Researching"
  const first = description.trim().split(/(?<=[.!?])\s|\n/)[0]?.trim() ?? ""
  const text = first.replace(/^(objective|task)\s*:\s*/i, "")
  if (!text) return "Researching"
  const topic = text.charAt(0).toUpperCase() + text.slice(1)
  return topic.length > 110 ? `${topic.slice(0, 110).trimEnd()}…` : topic
}

function planOf(todos: unknown): PlanItem[] {
  if (!Array.isArray(todos)) return []
  const items: PlanItem[] = []
  for (const todo of todos) {
    if (!todo || typeof todo !== "object") continue
    const record = todo as { content?: unknown; status?: unknown }
    if (typeof record.content !== "string" || !record.content.trim()) continue
    const status =
      record.status === "completed" || record.status === "in_progress" ? record.status : "pending"
    items.push({ text: record.content.trim(), status })
  }
  return items
}
