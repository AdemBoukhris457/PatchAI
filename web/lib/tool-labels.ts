const LABELS: Record<string, { running: string; done: string; plain?: string }> = {
  write_todos: { running: "Planning", done: "Made a plan" },
  task: { running: "Working with a helper agent", done: "Helper agent finished" },
  ls: { running: "Listing files", done: "Listed files" },
  read_file: { running: "Reading a file", done: "Read a file" },
  write_file: { running: "Saving a file", done: "Saved a file" },
  edit_file: { running: "Editing a file", done: "Edited a file" },
  glob: { running: "Finding files", done: "Found files" },
  grep: { running: "Searching files", done: "Searched files" },
  read_pdf_source: {
    running: "Reading the document",
    done: "Read the document",
    plain: "the document",
  },
  read_pptx_source: {
    running: "Reading the deck",
    done: "Read the deck",
    plain: "the deck",
  },
}

function humanize(name: string) {
  return name.replace(/[_-]+/g, " ").trim().toLowerCase()
}

export function toolPhrase(
  name: string,
  state: "running" | "done" | "waiting" | "failed" | "cancelled",
) {
  if (state === "running") return toolLabel(name, false)
  if (state === "done") return toolLabel(name, true)
  const plain = LABELS[name]?.plain ?? humanize(name)
  if (state === "waiting") return `Waiting on ${plain}`
  if (state === "cancelled") return `Stopped checking ${plain}`
  return `Couldn't check ${plain}`
}

/** A short phrase for a tool step, in the tense that matches its state. */
export function toolLabel(name: string, finished: boolean) {
  const known = LABELS[name]
  if (known) {
    return finished ? known.done : known.running
  }
  return finished ? `Checked ${humanize(name)}` : `Checking ${humanize(name)}`
}

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1)
}

function withoutSharedVerb(label: string, verb: string) {
  const prefix = `${verb} `
  if (label.toLowerCase().startsWith(prefix.toLowerCase())) {
    return label.slice(prefix.length)
  }
  return lowerFirst(label)
}

function repeated(label: string, count: number) {
  if (count === 1) {
    return label
  }
  if (label === "Read a file") {
    return `Read ${count} files`
  }
  return `${label} ${count} times`
}

/**
 * The closed line for a finished run. One or two actions are named.
 * A longer run keeps those two and counts the rest.
 */
export function workSummary(labels: string[]) {
  if (labels.length === 0) {
    return ""
  }
  if (labels.every((label) => label === labels[0])) {
    return repeated(labels[0], labels.length)
  }
  const verb = labels[0].split(" ")[0] ?? ""
  if (labels.length === 2) {
    return `${labels[0]} and ${withoutSharedVerb(labels[1], verb)}`
  }
  if (labels.length === 3) {
    return `${labels[0]}, ${withoutSharedVerb(labels[1], verb)}, and ${withoutSharedVerb(labels[2], verb)}`
  }
  return `${labels[0]}, ${withoutSharedVerb(labels[1], verb)}, and ${labels.length - 2} more`
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
