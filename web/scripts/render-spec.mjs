import { toSpecCatalog } from "@assistant-ui/generative-ui/spec"
import { createSpecTools } from "generative-frame/spec/tools"

const { catalog } = toSpecCatalog()
const specs = new Map()

if (process.argv[2] === "prompt") {
  const text = catalog.prompt()
  if (process.argv[3]) {
    const { writeFileSync } = await import("node:fs")
    writeFileSync(process.argv[3], text)
  } else {
    process.stdout.write(text)
  }
  process.exit(0)
}

const raw = await new Response(process.stdin).text()
const body = raw.trim() ? JSON.parse(raw) : {}
const title = typeof body.title === "string" ? body.title : ""
const previous = body.previous
const version = Number.isInteger(body.version) ? body.version : 0
if (previous && typeof previous === "object") {
  specs.set(title, { spec: previous, version })
}

const tools = createSpecTools(catalog, {
  specs,
  customRules: [
    "A report opens with the takeaway, then the figures, then the evidence.",
    "Put the three or four numbers that matter in Fact components side by side.",
    "Use Chart for a shape, Table for exact values, Diagram for a flow, and Markdown for a short explanation.",
    "Bind a control to state with $bindState so a filter redraws the report without another message.",
    "Compute a figure the reader can change with $calc. Do not type a number that a formula can derive.",
  ],
})

const result = await tools.render_spec.execute({
  title,
  ...(typeof body.patches === "string" ? { patches: body.patches } : {}),
  ...(body.spec && typeof body.spec === "object" ? { spec: body.spec } : {}),
})
const stored = specs.get(result.title)
process.stdout.write(
  JSON.stringify({ ...result, spec: stored?.spec ?? null }),
)
