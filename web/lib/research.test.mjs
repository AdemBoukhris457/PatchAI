import { duration, researchRun, runCounts } from "./research.ts"

function check(name, condition) {
  if (!condition) throw new Error(name)
}

function tool(toolName, args, status = "complete", extra = {}) {
  return { type: "tool-call", toolName, args, status: { type: status }, ...extra }
}

const plan = tool("write_todos", {
  todos: [
    { content: "Rust release", status: "completed" },
    { content: "PostgreSQL release", status: "in_progress" },
    { content: "", status: "pending" },
  ],
})
const worker = (id, description, status) =>
  tool("task", { subagent_type: "research-agent", description }, status, { toolCallId: id })

const workerPlan = tool(
  "write_todos",
  { todos: [{ content: "Worker step", status: "pending" }] },
  "complete",
  { providerMetadata: { patchai: { subagent: true } } },
)
const kept = researchRun([plan, worker("w", "Rust", "running"), workerPlan], true)
check("a worker's own plan does not replace the lead's", kept?.plan[0].text === "Rust release")

check("a reply without workers is not research", researchRun([plan], false) === null)
check("a plain helper is not research", researchRun([tool("task", { subagent_type: "general-purpose" })], false) === null)

const planning = researchRun([plan], true, true)
check("research mode plans before the first worker", planning?.phase === "planning")
check("plan items with text are kept", planning?.plan.length === 2)
check("a plan item keeps its status", planning?.plan[1].status === "in_progress")

const live = researchRun(
  [
    plan,
    worker("a", "Objective: Find the latest stable Rust release. Use the official blog.", "complete"),
    worker("b", "Find the PostgreSQL 19 release date", "running"),
    tool("search_web", { query: "rust" }),
    tool("search_web", { query: "pg" }, "complete", { isError: true }),
    tool("read_web_page", { url: "https://blog.rust-lang.org/" }),
    tool("read_web_page", { url: "https://www.postgresql.org/" }, "running"),
  ],
  true,
)
check("a running worker keeps the run researching", live?.phase === "researching")
check("the topic is the first sentence", live?.workers[0].topic === "Find the latest stable Rust release.")
check("workers report their state", live?.workers[0].state === "done" && live?.workers[1].state === "running")
check("failed searches are not counted", live?.searches === 1)
check("only finished reads are counted", live?.pages === 1)

const writing = researchRun(
  [worker("a", "Rust", "complete"), { type: "text", text: "## Releases" }],
  true,
)
check("text after the last worker is the report", writing?.phase === "writing")

const done = researchRun([worker("a", "Rust", "complete"), worker("b", "Node", "complete")], false)
check("a finished reply is done", done?.phase === "done")
check("counts leave out zeros", runCounts(done) === "2 agents")
check("counts use plurals", runCounts({ ...done, searches: 11, pages: 1 }) === "2 agents · 11 searches · 1 page")

const stopped = researchRun([plan, worker("a", "Rust", "complete"), worker("b", "Node", "running")], false)
check("a reply stopped mid-run is stopped", stopped?.phase === "stopped")
check("an unfinished worker is stopped", stopped?.workers[1].state === "stopped")
const cancelled = researchRun(
  [tool("task", { subagent_type: "research-agent" }, "incomplete", { status: { type: "incomplete", reason: "cancelled" } })],
  false,
)
check("a cancelled worker is stopped", cancelled?.workers[0].state === "stopped")

check("seconds", duration(48) === "48s")
check("minutes and seconds", duration(134) === "2m 14s")
check("whole minutes", duration(120) === "2m")

console.log("research: ok")
