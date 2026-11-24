"use client"

import { Download, X } from "lucide-react"
import { useEffect, useState } from "react"

import { AssistantReply } from "@/components/assistant-reply"
import type { OpenDocument } from "@/components/pdf-preview"
import { ghostButton } from "@/components/surfaces"
import { cn } from "@/lib/utils"

export function MarkdownCanvas({
  document,
  onClose,
}: {
  document: OpenDocument
  onClose: () => void
}) {
  const fileUrl = `/api/files/${encodeURIComponent(document.filename)}`
  const [text, setText] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const handle = { active: true }
    setText(null)
    setFailed(false)
    void (async () => {
      try {
        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error("missing")
        const body = await response.text()
        if (handle.active) setText(body)
      } catch {
        if (handle.active) setFailed(true)
      }
    })()
    return () => {
      handle.active = false
    }
  }, [fileUrl])

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
    <aside className="flex h-full min-h-0 w-[min(40rem,46%)] shrink-0 flex-col border-l bg-background max-lg:absolute max-lg:inset-0 max-lg:z-30 max-lg:w-full max-lg:border-l-0">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{document.title}</p>
          <p className="text-xs text-muted-foreground">Markdown</p>
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
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {failed ? (
          <p className="text-sm text-muted-foreground">This Markdown file could not be opened.</p>
        ) : text === null ? (
          <p className="text-sm text-muted-foreground">Opening…</p>
        ) : (
          <AssistantReply text={text} streaming={false} />
        )}
      </div>
    </aside>
  )
}
