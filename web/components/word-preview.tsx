"use client"

import { Download, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { OpenDocument } from "@/components/pdf-preview"
import { ghostButton } from "@/components/surfaces"
import { cn } from "@/lib/utils"

export function WordCanvas({
  document,
  onClose,
}: {
  document: OpenDocument
  onClose: () => void
}) {
  const page = useRef<HTMLDivElement>(null)
  const fileUrl = `/api/files/${encodeURIComponent(document.filename)}`
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const root = page.current
    if (!root) return
    const handle = { active: true }
    root.replaceChildren()
    setFailed(false)
    setReady(false)
    void (async () => {
      try {
        const response = await fetch(fileUrl, { cache: "no-store" })
        if (!response.ok) throw new Error("missing")
        const bytes = await response.arrayBuffer()
        const { renderAsync } = await import("docx-preview")
        if (!handle.active) return
        await renderAsync(bytes, root, root, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: true,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
        })
        if (handle.active) setReady(true)
      } catch {
        if (handle.active) setFailed(true)
      }
    })()
    return () => {
      handle.active = false
    }
  }, [document.filename, document.revision, fileUrl])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return
      }
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <aside className="flex h-full min-h-0 w-[min(40rem,46%)] shrink-0 flex-col border-l bg-muted max-lg:absolute max-lg:inset-0 max-lg:z-30 max-lg:w-full max-lg:border-l-0">
      <header className="flex items-center gap-2 border-b bg-background px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{document.title}</p>
          <p className="text-xs text-muted-foreground">Word</p>
        </div>
        <a
          href={fileUrl}
          download={document.filename}
          aria-label="Download"
          className={cn(ghostButton, "size-7")}
        >
          <Download className="size-4" />
        </a>
        <button
          type="button"
          aria-label="Close the document"
          onClick={onClose}
          className={cn(ghostButton, "size-7")}
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {failed ? (
          <p className="px-6 py-5 text-sm text-muted-foreground">This Word document could not be opened.</p>
        ) : null}
        {!failed && !ready ? (
          <p className="px-6 py-5 text-sm text-muted-foreground">Opening…</p>
        ) : null}
        <div ref={page} className={ready ? "min-h-full" : "hidden"} />
      </div>
    </aside>
  )
}
