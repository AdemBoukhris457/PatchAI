"use client"

import { ChevronDown, Mic, Plus } from "lucide-react"
import { useState } from "react"

import {
  FileChips,
  FilePicker,
  IconButton,
  Menu,
  MenuItem,
  SendCircle,
  onEnter,
  useDraft,
} from "./ui"

export function DashboardComposer() {
  const draft = useDraft()
  return (
    <div className="rounded-2xl bg-neutral-200/80 p-1.5 shadow-sm">
      <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
      <div className="rounded-xl bg-white px-3 py-2">
        <FileChips
          files={draft.files}
          onRemove={(name) =>
            draft.setFiles((current) => current.filter((file) => file !== name))
          }
        />
        <textarea
          aria-label="Message"
          rows={2}
          value={draft.value}
          placeholder="Send a message..."
          onChange={(event) => draft.setValue(event.target.value)}
          onKeyDown={(event) => onEnter(event, draft.send, true)}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
        <div className="mt-1 flex items-center">
          <button
            type="button"
            className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700 outline-none focus-visible:ring-2"
          >
            Auto
          </button>
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Attach files" onClick={draft.openPicker}>
              <Plus className="size-4" />
            </IconButton>
            <SendCircle
              busy={draft.busy}
              ready={draft.ready}
              onSend={draft.send}
              onStop={draft.stop}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ChatgptComposer() {
  const draft = useDraft()
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState("ChatGPT")
  const [effort, setEffort] = useState(40)
  const effortLabel = effort < 35 ? "Low" : effort < 70 ? "Medium" : "High"
  return (
    <div className="relative">
      <form
        className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          draft.send()
        }}
      >
        <input
          aria-label="Message"
          value={draft.value}
          placeholder="Ask anything"
          onChange={(event) => draft.setValue(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2"
        >
          {model}
          <ChevronDown className="size-3" />
        </button>
        <SendCircle
          busy={draft.busy}
          ready={draft.ready}
          onSend={draft.send}
          onStop={draft.stop}
        />
      </form>
      <Menu open={open} className="right-10 bottom-full mb-2 w-56">
        <p className="px-2 py-1 text-xs text-neutral-500">
          Effort · {effortLabel}
        </p>
        <input
          aria-label="Thinking effort"
          type="range"
          min={0}
          max={100}
          value={effort}
          onChange={(event) => setEffort(Number(event.target.value))}
          className="mx-2 mb-2 w-[calc(100%-1rem)]"
        />
        {["ChatGPT", "Instant", "Thinking"].map((item) => (
          <MenuItem
            key={item}
            onClick={() => {
              setModel(item)
              setOpen(false)
            }}
          >
            {item}
          </MenuItem>
        ))}
      </Menu>
    </div>
  )
}

export function ClaudeComposer() {
  const draft = useDraft()
  const [plus, setPlus] = useState(false)
  const [models, setModels] = useState(false)
  const [model, setModel] = useState("Sonnet")
  const [effort, setEffort] = useState("Medium")
  return (
    <div className="rounded-2xl bg-[#f5f4ed] p-3 text-[#141413]">
      <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
      <div className="relative rounded-2xl border border-black/10 bg-white px-3 py-2">
        <FileChips
          files={draft.files}
          onRemove={(name) =>
            draft.setFiles((current) => current.filter((file) => file !== name))
          }
        />
        <textarea
          aria-label="Reply"
          rows={3}
          value={draft.value}
          placeholder="Reply"
          onChange={(event) => draft.setValue(event.target.value)}
          onKeyDown={(event) => onEnter(event, draft.send, true)}
          className="w-full resize-none bg-transparent pr-10 text-sm outline-none placeholder:text-neutral-400"
        />
        <div className="absolute right-2 bottom-2">
          <SendCircle
            busy={draft.busy}
            ready={draft.ready}
            onSend={draft.send}
            onStop={draft.stop}
          />
        </div>
      </div>
      <div className="relative mt-2 flex items-center gap-1 text-xs">
        <IconButton label="Add" onClick={() => setPlus((value) => !value)}>
          <Plus className="size-4" />
        </IconButton>
        <IconButton label="Dictate" onClick={() => undefined}>
          <Mic className="size-4" />
        </IconButton>
        <Menu open={plus} className="bottom-full left-0 mb-2 w-52">
          {[
            ["Files", () => draft.openPicker()],
            ["Skills", () => undefined],
            ["Connectors", () => undefined],
            ["Plugins", () => undefined],
            ["Research", () => undefined],
          ].map(([label, action]) => (
            <MenuItem
              key={String(label)}
              onClick={() => {
                ;(action as () => void)()
                setPlus(false)
              }}
            >
              {label as string}
            </MenuItem>
          ))}
        </Menu>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModels((value) => !value)}
            className="rounded-lg px-2 py-1 outline-none hover:bg-black/5 focus-visible:ring-2"
          >
            {model} · {effort}
          </button>
          <button
            type="button"
            className="rounded-lg px-2 py-1 outline-none hover:bg-black/5 focus-visible:ring-2"
          >
            Manual
          </button>
          <span aria-label="85% context" title="85% context" className="text-neutral-700">
            <Ring value={85} />
          </span>
        </div>
        <Menu open={models} className="right-0 bottom-full mb-2 w-44">
          {["Haiku", "Sonnet", "Opus"].map((item) => (
            <MenuItem
              key={item}
              onClick={() => {
                setModel(item)
                setModels(false)
              }}
            >
              {item}
            </MenuItem>
          ))}
          <p className="mt-1 border-t px-2 pt-2 text-xs text-neutral-500">Effort</p>
          {["Low", "Medium", "High"].map((item) => (
            <MenuItem
              key={item}
              onClick={() => {
                setEffort(item)
                setModels(false)
              }}
            >
              {item}
            </MenuItem>
          ))}
        </Menu>
      </div>
    </div>
  )
}

function Ring({ value }: { value: number }) {
  const radius = 7
  const circ = 2 * Math.PI * radius
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={`${(value / 100) * circ} ${circ}`}
        transform="rotate(-90 9 9)"
      />
    </svg>
  )
}

export function GeminiComposer() {
  const draft = useDraft()
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState("Pro")
  return (
    <div>
      <form
        className="relative flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1.5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          draft.send()
        }}
      >
        <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
        <IconButton label="Add" onClick={draft.openPicker}>
          <Plus className="size-4" />
        </IconButton>
        <input
          aria-label="Message"
          value={draft.value}
          placeholder="Ask Gemini"
          onChange={(event) => draft.setValue(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full px-2 py-1 text-xs text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2"
        >
          {model}
        </button>
        {!draft.ready && !draft.busy ? (
          <IconButton label="Voice" onClick={() => undefined}>
            <Mic className="size-4" />
          </IconButton>
        ) : (
          <SendCircle
            busy={draft.busy}
            ready={draft.ready}
            onSend={draft.send}
            onStop={draft.stop}
            tone="blue"
          />
        )}
        <Menu open={open} className="right-12 bottom-full mb-2">
          {["Fast", "Pro", "Thinking"].map((item) => (
            <MenuItem
              key={item}
              onClick={() => {
                setModel(item)
                setOpen(false)
              }}
            >
              {item}
            </MenuItem>
          ))}
        </Menu>
      </form>
      {draft.files.length > 0 ? (
        <div className="mt-2">
          <FileChips
            files={draft.files}
            onRemove={(name) =>
              draft.setFiles((current) => current.filter((file) => file !== name))
            }
          />
        </div>
      ) : null}
      <p className="mt-2 text-center text-[11px] text-neutral-500">
        Gemini can make mistakes.{" "}
        <span className="underline">Your privacy & Gemini</span>
      </p>
    </div>
  )
}

export function PerplexityComposer() {
  const draft = useDraft()
  const [focus, setFocus] = useState("Search")
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState("Sonar")
  return (
    <div className="relative rounded-2xl border border-neutral-200 bg-white p-3">
      <textarea
        aria-label="Follow-up"
        rows={3}
        value={draft.value}
        placeholder="Ask a follow-up"
        onChange={(event) => draft.setValue(event.target.value)}
        onKeyDown={(event) => onEnter(event, draft.send, true)}
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-neutral-400"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFocus((value) => (value === "Search" ? "Research" : "Search"))}
          className="rounded-full bg-teal-50 px-2.5 py-1 text-xs text-teal-800 outline-none focus-visible:ring-2"
        >
          {focus}
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2"
        >
          {model}
          <ChevronDown className="size-3" />
        </button>
        <div className="ml-auto">
          <SendCircle
            busy={draft.busy}
            ready={draft.ready}
            onSend={draft.send}
            onStop={draft.stop}
            tone="blue"
          />
        </div>
      </div>
      <Menu open={open} className="bottom-12 left-24">
        <MenuItem onClick={() => { setModel("Sonar"); setOpen(false) }}>Sonar</MenuItem>
        <MenuItem onClick={() => { setModel("Claude"); setOpen(false) }}>Claude</MenuItem>
        <MenuItem onClick={() => { setModel("GPT"); setOpen(false) }}>GPT</MenuItem>
        <MenuItem muted onClick={() => setOpen(false)}>Gemini · locked</MenuItem>
      </Menu>
    </div>
  )
}

const CLAUDE_MODES = [
  { id: "manual", label: "manual", color: "#d4d4d4" },
  { id: "accept", label: "accept edits", color: "#e8b86d" },
  { id: "plan", label: "plan mode", color: "#7eb6ff" },
  { id: "auto", label: "auto", color: "#c084fc" },
] as const

export function ClaudeCodePrompt() {
  const draft = useDraft()
  const [mode, setMode] = useState(0)
  const current = CLAUDE_MODES[mode]!
  return (
    <form
      className="bg-[#1e1e1e] px-3 py-3 font-mono text-sm text-[#d4d4d4]"
      onSubmit={(event) => {
        event.preventDefault()
        draft.send()
      }}
    >
      <div className="border-y border-white/15 py-1.5">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">❯</span>
          <div className="relative min-w-0 flex-1">
            {draft.value === "" ? (
              <span className="pointer-events-none absolute top-1/2 left-0 h-4 w-1.5 -translate-y-1/2 bg-[#d4d4d4]" />
            ) : null}
            <input
              aria-label="Prompt"
              value={draft.value}
              onChange={(event) => draft.setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Tab" && event.shiftKey) {
                  event.preventDefault()
                  setMode((value) => (value + 1) % CLAUDE_MODES.length)
                  return
                }
                if (event.key === "Escape" && draft.busy) {
                  event.preventDefault()
                  draft.stop()
                  return
                }
                onEnter(event, draft.send)
              }}
              className="w-full bg-transparent pl-3 outline-none"
            />
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span style={{ color: current.color }}>
          {current.label}{" "}
          <span className="text-white/40">(shift+tab to cycle)</span>
        </span>
        <span className="text-white/50">medium</span>
      </div>
    </form>
  )
}

export function CodexComposer() {
  const draft = useDraft()
  return (
    <form
      className="bg-[#0e0e0e] px-3 py-3 font-mono text-sm text-white"
      onSubmit={(event) => {
        event.preventDefault()
        draft.send()
      }}
    >
      <div className="flex items-center gap-2">
        <span className="font-bold">›</span>
        <div className="relative min-w-0 flex-1">
          {draft.value === "" ? (
            <span className="pointer-events-none absolute top-0 left-0 text-[#ff7eb6]">▌</span>
          ) : null}
          <input
            aria-label="Prompt"
            value={draft.value}
            placeholder="Ask Codex to do anything"
            onChange={(event) => draft.setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && draft.busy) {
                draft.stop()
                return
              }
              onEnter(event, draft.send)
            }}
            className="w-full bg-transparent pl-3 outline-none placeholder:text-white/35"
          />
        </div>
      </div>
      <p className="mt-2 text-xs">
        <span className="text-[#e8c547]">gpt-6.1-codex low</span>{" "}
        <span className="text-[#7dcea0]">~/patchai</span>{" "}
        <span className="text-white/40">← agents · ? shortcuts</span>
      </p>
    </form>
  )
}

export function OpencodeComposer() {
  const draft = useDraft()
  return (
    <form
      className="border-t-2 border-[#3b82f6] bg-[#141414] px-3 py-3 font-mono text-sm text-white"
      onSubmit={(event) => {
        event.preventDefault()
        draft.send()
      }}
    >
      <input
        aria-label="Prompt"
        value={draft.value}
        placeholder='Ask anything... "Draft this week&apos;s changelog"'
        onChange={(event) => draft.setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && draft.busy) {
            draft.stop()
            return
          }
          onEnter(event, draft.send)
        }}
        className="w-full bg-transparent outline-none placeholder:text-white/35"
      />
      <p className="mt-2 text-xs">
        <span className="text-[#60a5fa]">Build</span>{" "}
        <span>Writer 0.1</span>{" "}
        <span className="text-white/40">Notra</span>{" "}
        <span className="font-bold text-[#fb923c]">high</span>
      </p>
      <p className="mt-1 flex justify-between text-xs text-white/45">
        <span>{draft.busy ? "esc interrupt" : "~/patchai"}</span>
        <span>tab agents · ctrl+p commands</span>
      </p>
    </form>
  )
}
