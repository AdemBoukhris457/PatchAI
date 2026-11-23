"use client"

import { ArrowUp, Square } from "lucide-react"
import {
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react"

export function useDraft() {
  const pickerRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState<string[]>([])

  function send() {
    if (busy) return
    if (!value.trim() && files.length === 0) return
    setValue("")
    setFiles([])
    setBusy(true)
    window.setTimeout(() => setBusy(false), 1100)
  }

  function stop() {
    setBusy(false)
  }

  function openPicker() {
    pickerRef.current?.click()
  }

  function takeFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const names = Array.from(list).map((file) => file.name)
    setFiles((current) => {
      const next = [...current]
      for (const name of names) {
        if (!next.includes(name)) next.push(name)
      }
      return next
    })
  }

  return {
    value,
    setValue,
    busy,
    files,
    setFiles,
    send,
    stop,
    pickerRef,
    openPicker,
    takeFiles,
    ready: value.trim().length > 0 || files.length > 0,
  }
}

export function FilePicker({
  pickerRef,
  onPick,
}: {
  pickerRef: RefObject<HTMLInputElement | null>
  onPick: (files: FileList | null) => void
}) {
  return (
    <input
      ref={pickerRef}
      type="file"
      multiple
      className="sr-only"
      onChange={(event) => {
        onPick(event.target.files)
        event.currentTarget.value = ""
      }}
    />
  )
}

export function onEnter(
  event: KeyboardEvent,
  send: () => void,
  multiline = false,
) {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return
  if (multiline && event.shiftKey) return
  event.preventDefault()
  send()
}

export function IconButton({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex size-8 items-center justify-center rounded-full text-current transition-colors outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/40 ${className}`}
    >
      {children}
    </button>
  )
}

export function SendCircle({
  busy,
  ready,
  onSend,
  onStop,
  tone = "dark",
}: {
  busy: boolean
  ready: boolean
  onSend: () => void
  onStop: () => void
  tone?: "dark" | "light" | "blue"
}) {
  const enabled = busy || ready
  const tones = {
    dark: enabled
      ? "bg-neutral-950 text-white"
      : "bg-neutral-200 text-neutral-400",
    light: enabled
      ? "bg-white text-neutral-950"
      : "bg-white/20 text-white/40",
    blue: enabled
      ? "bg-[#1a73e8] text-white"
      : "bg-neutral-200 text-neutral-500",
  }
  return (
    <button
      type="button"
      aria-label={busy ? "Stop" : "Send"}
      disabled={!enabled}
      onClick={busy ? onStop : onSend}
      className={`inline-flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/40 ${tones[tone]}`}
    >
      {busy ? (
        <Square className="size-3 fill-current" />
      ) : (
        <ArrowUp className="size-4" />
      )}
    </button>
  )
}

export function FileChips({
  files,
  onRemove,
  dark = false,
}: {
  files: string[]
  onRemove: (name: string) => void
  dark?: boolean
}) {
  if (files.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {files.map((name) => (
        <span
          key={name}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${dark ? "bg-white/10 text-white" : "bg-neutral-100 text-neutral-700"}`}
        >
          {name}
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={() => onRemove(name)}
            className="rounded-full px-1 outline-none focus-visible:ring-2"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}

export function Menu({
  open,
  children,
  className = "",
}: {
  open: boolean
  children: ReactNode
  className?: string
}) {
  if (!open) return null
  return (
    <div
      className={`absolute z-30 min-w-44 rounded-[6px] border border-neutral-200 bg-white p-1 text-left text-sm text-neutral-900 shadow-lg ${className}`}
    >
      {children}
    </div>
  )
}

export function MenuItem({
  children,
  onClick,
  muted = false,
}: {
  children: ReactNode
  onClick: () => void
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center rounded-[4px] px-2 py-1.5 text-left outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100 ${muted ? "text-neutral-400" : ""}`}
    >
      {children}
    </button>
  )
}
