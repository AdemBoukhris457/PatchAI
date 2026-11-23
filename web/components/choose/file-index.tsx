"use client"

import { FileText, Paperclip, Presentation, X } from "lucide-react"
import { useState, type ReactNode } from "react"

const OUTPUTS = [
  {
    id: "hello",
    title: "Hello",
    file: "hello.pdf",
    kind: "PDF",
  },
  {
    id: "habits",
    title: "A Simple Guide to Better Daily Habits",
    file: "sample-daily-habits-guide.pdf",
    kind: "PDF",
  },
  {
    id: "deck",
    title: "Practical AI adoption",
    file: "practical-ai-adoption-example.pptx",
    kind: "PowerPoint",
  },
] as const

const INPUTS = [
  {
    id: "notes",
    title: "workshop-notes.pdf",
    file: "workshop-notes.pdf",
    kind: "PDF",
  },
  {
    id: "sheet",
    title: "costs.xlsx",
    file: "costs.xlsx",
    kind: "Spreadsheet",
  },
] as const

const FILES = [...OUTPUTS, ...INPUTS]

function Stage({
  children,
  className = "h-80",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-xl border bg-white ${className}`}>
      {children}
    </div>
  )
}

function FileRow({
  item,
  selected,
  source,
  onPick,
}: {
  item: (typeof FILES)[number]
  selected: boolean
  source: "output" | "input"
  onPick: () => void
}) {
  const Icon =
    source === "input" ? Paperclip : item.kind === "PDF" ? FileText : Presentation
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={`flex w-full items-start gap-2 rounded-[4px] px-2 py-1.5 text-left outline-none hover:bg-neutral-100 focus-visible:ring-2 ${selected ? "bg-neutral-100" : ""}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-neutral-500" />
      <span className="min-w-0">
        <span className="block truncate text-sm">{item.title}</span>
        <span className="block truncate text-xs text-neutral-500">
          {source === "output" ? `${item.kind} · ${item.file}` : `Attached · ${item.kind}`}
        </span>
      </span>
    </button>
  )
}

export function AssistantFileIndex() {
  const [open, setOpen] = useState(true)
  const [picked, setPicked] = useState<string>(FILES[0].id)
  const current = FILES.find((item) => item.id === picked) ?? FILES[0]

  return (
    <Stage className="h-[28rem]">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-sm font-medium">PatchAI</p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="aui-file-index"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border px-2 text-xs outline-none hover:bg-neutral-100 focus-visible:ring-2"
        >
          Files
          <span className="text-neutral-500 tabular-nums">{FILES.length}</span>
        </button>
      </header>
      <div className="min-h-0 flex-1 bg-neutral-50 p-3">
        <p className="ml-auto w-fit max-w-[14rem] rounded-2xl bg-neutral-200/80 px-3 py-2 text-xs">
          Make a short PDF.
        </p>
        <p className="mt-3 text-xs text-neutral-500">{current.title}</p>
        <p className="text-xs text-neutral-400">{current.file}</p>
      </div>
      {open ? (
        <div
          id="aui-file-index"
          role="listbox"
          aria-label="Files"
          className="absolute top-12 right-3 z-10 max-h-[calc(100%-3.5rem)] w-64 overflow-y-auto rounded-[6px] border bg-white p-1 shadow-md"
        >
          <p className="text-muted-foreground px-2 py-1.5 font-mono text-[11px] font-medium tracking-wide uppercase">
            Output
          </p>
          {OUTPUTS.map((item) => (
            <FileRow
              key={item.id}
              item={item}
              source="output"
              selected={item.id === picked}
              onPick={() => setPicked(item.id)}
            />
          ))}
          <div className="bg-foreground/10 -mx-1 my-1 h-px" />
          <p className="text-muted-foreground px-2 py-1.5 font-mono text-[11px] font-medium tracking-wide uppercase">
            Input
          </p>
          {INPUTS.map((item) => (
            <FileRow
              key={item.id}
              item={item}
              source="input"
              selected={item.id === picked}
              onPick={() => setPicked(item.id)}
            />
          ))}
        </div>
      ) : null}
    </Stage>
  )
}

export function NotraFileIndex() {
  const [open, setOpen] = useState(true)
  const [picked, setPicked] = useState<string>(OUTPUTS[0].id)

  return (
    <Stage>
      <header className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-sm font-medium">PatchAI</p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="inline-flex h-8 items-center rounded-lg border px-2.5 text-xs outline-none hover:bg-neutral-100 focus-visible:ring-2"
        >
          Files
        </button>
      </header>
      <div className="min-h-0 flex-1 bg-neutral-50" />
      {open ? (
        <aside className="absolute inset-y-0 right-0 flex w-60 flex-col border-l bg-white shadow-md">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-medium">Files</p>
            <button
              type="button"
              aria-label="Close files"
              onClick={() => setOpen(false)}
              className="inline-flex size-7 items-center justify-center rounded-md text-neutral-500 outline-none hover:bg-neutral-100 focus-visible:ring-2"
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
            {OUTPUTS.map((item) => {
              const selected = item.id === picked
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => setPicked(item.id)}
                    className={`flex w-full flex-col px-3 py-2.5 text-left outline-none hover:bg-neutral-50 focus-visible:ring-2 ${selected ? "bg-neutral-100" : ""}`}
                  >
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    <span className="truncate text-xs text-neutral-500">{item.file}</span>
                    <span className="mt-1 text-xs text-neutral-400">{item.kind}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>
      ) : null}
    </Stage>
  )
}
