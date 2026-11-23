"use client"

import { Mic, Plus, TextQuote } from "lucide-react"
import { useState } from "react"

import { FilePicker, IconButton, Menu, MenuItem, useDraft } from "./ui"

export function AttachmentPiece() {
  const draft = useDraft()
  return (
    <div>
      <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
      <button
        type="button"
        onClick={draft.openPicker}
        className="rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-2"
      >
        Add a file
      </button>
      {draft.files.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {draft.files.map((name) => (
            <span key={name} className="inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-2 py-1 text-xs">
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() =>
                  draft.setFiles((current) => current.filter((file) => file !== name))
                }
                className="outline-none focus-visible:ring-2"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-neutral-500">Nothing attached yet.</p>
      )}
    </div>
  )
}

export function ChatgptModelPiece() {
  const [effort, setEffort] = useState(50)
  const [model, setModel] = useState("ChatGPT")
  const label = effort < 35 ? "Low" : effort < 70 ? "Medium" : "High"
  return (
    <div className="rounded-xl border bg-white p-3 text-sm">
      <p className="mb-2">{model}</p>
      <label className="block text-xs text-neutral-500">
        Effort · {label}
        <input
          type="range"
          min={0}
          max={100}
          value={effort}
          aria-label="Thinking effort"
          onChange={(event) => setEffort(Number(event.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <div className="mt-2 flex gap-1">
        {["Instant", "ChatGPT", "Thinking"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setModel(item)}
            className={`rounded-full px-2 py-1 text-xs outline-none focus-visible:ring-2 ${model === item ? "bg-neutral-950 text-white" : "bg-neutral-100"}`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ClaudePlusPiece() {
  const [picked, setPicked] = useState("Files")
  return (
    <div className="w-52 rounded-xl border bg-white p-1 text-sm shadow-sm">
      {["Files", "Skills", "Connectors", "Design systems", "Plugins", "Research"].map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setPicked(item)}
          className={`block w-full rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 ${picked === item ? "bg-neutral-100" : ""}`}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

export function ClaudeModelPiece() {
  const [model, setModel] = useState("Sonnet")
  const [effort, setEffort] = useState("Medium")
  return (
    <div className="w-44 rounded-xl border bg-[#faf9f5] p-2 text-sm">
      {["Haiku", "Sonnet", "Opus"].map((item) => (
        <button key={item} type="button" onClick={() => setModel(item)} className={`block w-full rounded-lg px-2 py-1 text-left outline-none focus-visible:ring-2 ${model === item ? "bg-white" : ""}`}>
          {item}
        </button>
      ))}
      <p className="mt-2 px-2 text-xs text-neutral-500">Effort · {effort}</p>
      {["Low", "Medium", "High"].map((item) => (
        <button key={item} type="button" onClick={() => setEffort(item)} className={`block w-full rounded-lg px-2 py-1 text-left text-xs outline-none focus-visible:ring-2 ${effort === item ? "bg-white" : ""}`}>
          {item}
        </button>
      ))}
    </div>
  )
}

export function GeminiModelPiece() {
  const [model, setModel] = useState("Pro")
  return (
    <div className="inline-flex flex-col rounded-2xl border bg-white p-1 text-sm shadow-sm">
      {["Fast", "Pro", "Thinking"].map((item) => (
        <button key={item} type="button" onClick={() => setModel(item)} className={`rounded-xl px-3 py-1.5 text-left outline-none focus-visible:ring-2 ${model === item ? "bg-neutral-100" : ""}`}>
          {item}
        </button>
      ))}
    </div>
  )
}

export function PerplexityModelPiece() {
  const [model, setModel] = useState("Sonar")
  return (
    <div className="w-48 rounded-xl border bg-white p-1 text-sm">
      {[
        ["Sonar", false],
        ["Claude", false],
        ["GPT", false],
        ["Gemini", true],
      ].map(([name, locked]) => (
        <button
          key={String(name)}
          type="button"
          disabled={Boolean(locked)}
          onClick={() => setModel(String(name))}
          className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 disabled:text-neutral-400 ${model === name ? "bg-neutral-100" : ""}`}
        >
          {name as string}
          {locked ? <span className="text-[10px]">Locked</span> : null}
        </button>
      ))}
    </div>
  )
}

export function ModelPillPiece() {
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState("GPT-6 Luna")
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-2">
        {model}
      </button>
      <Menu open={open} className="top-full left-0 mt-2">
        {["GPT-6 Luna", "Claude", "Gemini"].map((item) => (
          <MenuItem key={item} onClick={() => { setModel(item); setOpen(false) }}>
            {item}
          </MenuItem>
        ))}
      </Menu>
    </div>
  )
}

export function VoicePiece() {
  const [on, setOn] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <IconButton label={on ? "Stop dictation" : "Start dictation"} onClick={() => setOn((value) => !value)} className={on ? "bg-red-50 text-red-600" : ""}>
        <Mic className="size-4" />
      </IconButton>
      <span className="text-sm text-neutral-600">{on ? "Listening…" : "Mic idle"}</span>
      {on ? <span className="h-1.5 w-16 animate-pulse rounded-full bg-neutral-800" /> : null}
    </div>
  )
}

export function MentionPiece() {
  const [value, setValue] = useState("@")
  const open = value.includes("@")
  return (
    <div className="relative">
      <input aria-label="Mention" value={value} onChange={(event) => setValue(event.target.value)} className="w-full rounded-lg border px-2 py-1 text-sm outline-none" />
      <Menu open={open} className="top-full mt-1">
        {["@memory", "@file"].map((item) => (
          <MenuItem key={item} onClick={() => setValue(`${value.split("@")[0]}${item} `)}>{item}</MenuItem>
        ))}
      </Menu>
    </div>
  )
}

export function SlashPiece() {
  const [value, setValue] = useState("/")
  return (
    <div className="relative">
      <input aria-label="Command" value={value} onChange={(event) => setValue(event.target.value)} className="w-full rounded-lg border px-2 py-1 text-sm outline-none" />
      <Menu open={value.startsWith("/")} className="top-full mt-1">
        {["/search", "/remember"].map((item) => (
          <MenuItem key={item} onClick={() => setValue(`${item} `)}>{item}</MenuItem>
        ))}
      </Menu>
    </div>
  )
}

export function QuotePiece() {
  const [shown, setShown] = useState(true)
  if (!shown) {
    return (
      <button type="button" onClick={() => setShown(true)} className="text-sm underline outline-none focus-visible:ring-2">
        Show the quote
      </button>
    )
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border-l-2 border-neutral-400 bg-neutral-50 px-2 py-1.5 text-sm">
      <TextQuote className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 flex-1 text-neutral-600">The flood map covers this county.</p>
      <button type="button" aria-label="Dismiss quote" onClick={() => setShown(false)} className="outline-none focus-visible:ring-2">×</button>
    </div>
  )
}

export function QueuePiece() {
  const [queued, setQueued] = useState(true)
  if (!queued) return <p className="text-sm text-neutral-500">Queue is empty.</p>
  return (
    <div className="flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-sm">
      <span className="min-w-0 flex-1 truncate">Check the flood map</span>
      <button type="button" onClick={() => setQueued(false)} className="text-xs underline outline-none focus-visible:ring-2">Send now</button>
    </div>
  )
}

export function ContextPiece() {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Ring value={85} />
      <span>85% of the window</span>
    </div>
  )
}

function Ring({ value }: { value: number }) {
  const radius = 8
  const circ = 2 * Math.PI * radius
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <circle cx="11" cy="11" r={radius} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${(value / 100) * circ} ${circ}`} transform="rotate(-90 11 11)" />
    </svg>
  )
}

export function TriggerPiece() {
  const [open, setOpen] = useState(false)
  const draft = useDraft()
  return (
    <div className="relative">
      <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-2">
        <Plus className="size-3.5" />
        Actions
      </button>
      <Menu open={open} className="top-full mt-2">
        <MenuItem onClick={() => { draft.openPicker(); setOpen(false) }}>Attach a file</MenuItem>
        <MenuItem onClick={() => setOpen(false)}>Mention someone</MenuItem>
        <MenuItem onClick={() => setOpen(false)}>Run a command</MenuItem>
      </Menu>
      {draft.files.length > 0 ? <p className="mt-2 text-xs text-neutral-500">{draft.files[0]} staged</p> : null}
    </div>
  )
}
