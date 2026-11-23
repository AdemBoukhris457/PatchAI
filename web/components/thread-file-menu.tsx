"use client"

import { FileText, Paperclip, Presentation } from "lucide-react"
import { useAuiState } from "@assistant-ui/react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { usePdfPreview } from "@/components/pdf-preview"
import { threadFiles, threadInputs, type ThreadFile, type ThreadInput } from "@/lib/thread-files"

export function ThreadFileMenu() {
  const root = useRef<HTMLDivElement>(null)
  const preview = usePdfPreview()
  const [open, setOpen] = useState(false)
  const messages = useAuiState((state) => state.thread.messages)
  const outputs = useMemo(() => threadFiles(messages), [messages])
  const inputs = useMemo(() => threadInputs(messages), [messages])
  const count = outputs.length + inputs.length

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (count === 0) return null

  function openOutput(file: ThreadFile) {
    setOpen(false)
    preview?.open({ filename: file.filename, title: file.title ?? file.filename })
  }

  function openInput(file: ThreadInput) {
    setOpen(false)
    if (!file.href) return
    const link = document.createElement("a")
    link.href = file.href
    link.download = file.name
    link.click()
  }

  return (
    <div ref={root} className="relative ml-auto mr-12">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="thread-file-index"
        onClick={() => setOpen((value) => !value)}
        className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-[6px] border px-2 text-xs outline-none focus-visible:ring-2"
      >
        Files
        <span className="tabular-nums">{count}</span>
      </button>
      {open ? (
        <div
          id="thread-file-index"
          role="listbox"
          aria-label="Files"
          className="bg-popover text-popover-foreground absolute top-full right-0 z-30 mt-1 max-h-64 w-64 overflow-y-auto rounded-[6px] border p-1 shadow-md"
        >
          {outputs.length > 0 ? (
            <FileGroup label="Output">
              {outputs.map((file) => (
                <FileChoice
                  key={file.filename}
                  title={file.title ?? file.filename}
                  detail={`${file.kind === "pptx" ? "PowerPoint" : "PDF"} · ${file.filename}`}
                  source="output"
                  kind={file.kind}
                  selected={preview?.document?.filename === file.filename}
                  onPick={() => openOutput(file)}
                />
              ))}
            </FileGroup>
          ) : null}
          {outputs.length > 0 && inputs.length > 0 ? (
            <div className="bg-foreground/10 -mx-1 my-1 h-px" />
          ) : null}
          {inputs.length > 0 ? (
            <FileGroup label="Input">
              {inputs.map((file) => (
                <FileChoice
                  key={file.id}
                  title={file.name}
                  detail={`Attached · ${file.kind}`}
                  source="input"
                  selected={false}
                  onPick={() => openInput(file)}
                />
              ))}
            </FileGroup>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function FileGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground px-2 py-1.5 font-mono text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

function FileChoice({
  title,
  detail,
  source,
  kind,
  selected,
  onPick,
}: {
  title: string
  detail: string
  source: "output" | "input"
  kind?: ThreadFile["kind"]
  selected: boolean
  onPick: () => void
}) {
  const Icon = source === "input" ? Paperclip : kind === "pptx" ? Presentation : FileText
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={`hover:bg-muted flex w-full items-start gap-2 rounded-[4px] px-2 py-1.5 text-left outline-none focus-visible:ring-2 ${selected ? "bg-muted" : ""}`}
    >
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate text-sm">{title}</span>
        <span className="text-muted-foreground block truncate text-xs">{detail}</span>
      </span>
    </button>
  )
}
