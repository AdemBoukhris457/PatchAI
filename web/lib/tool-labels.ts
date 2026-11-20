const LABELS: Record<string, { running: string; done: string }> = {
  write_todos: { running: "Planning", done: "Made a plan" },
  task: { running: "Working with a helper agent", done: "Helper agent finished" },
  ls: { running: "Listing files", done: "Listed files" },
  read_file: { running: "Reading a file", done: "Read a file" },
  write_file: { running: "Saving a file", done: "Saved a file" },
  edit_file: { running: "Editing a file", done: "Edited a file" },
  glob: { running: "Finding files", done: "Found files" },
  grep: { running: "Searching files", done: "Searched files" },
}

function humanize(name: string) {
  return name.replace(/[_-]+/g, " ").trim().toLowerCase()
}

/** A short phrase for a tool step, in the tense that matches its state. */
export function toolLabel(name: string, finished: boolean) {
  const known = LABELS[name]
  if (known) {
    return finished ? known.done : known.running
  }
  return finished ? `Used ${humanize(name)}` : `Using ${humanize(name)}`
}

/** The first few plain values of a tool's input, such as a ticker or a state. */
export function toolSummary(input: unknown) {
  if (input === null || typeof input !== "object") {
    return ""
  }
  const values: string[] = []
  for (const value of Object.values(input as Record<string, unknown>)) {
    const items = Array.isArray(value) ? value : [value]
    for (const item of items) {
      if (typeof item === "string" || typeof item === "number") {
        values.push(String(item))
      }
    }
  }
  const summary = values.slice(0, 3).join(", ")
  return summary.length > 60 ? `${summary.slice(0, 60).trimEnd()}…` : summary
}
