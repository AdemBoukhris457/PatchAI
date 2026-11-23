"use client"

import { AtSign, ChevronDown, Mic, Paperclip, Plus, Slash } from "lucide-react"
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

export function ThreadComposer() {
  const draft = useDraft()
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-2">
      <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
      <FileChips
        files={draft.files}
        onRemove={(name) =>
          draft.setFiles((current) => current.filter((file) => file !== name))
        }
      />
      <textarea
        aria-label="Message input"
        rows={2}
        value={draft.value}
        placeholder="Send a message..."
        onChange={(event) => draft.setValue(event.target.value)}
        onKeyDown={(event) => onEnter(event, draft.send, true)}
        className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-neutral-400"
      />
      <div className="flex items-center justify-between">
        <IconButton label="Attach files" onClick={draft.openPicker}>
          <Paperclip className="size-4" />
        </IconButton>
        <div className="flex items-center gap-1">
          <IconButton label="Voice input" onClick={() => undefined}>
            <Mic className="size-4" />
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
  )
}

export function UnifiedComposer() {
  const draft = useDraft()
  const [model, setModel] = useState("GPT-6 Luna")
  const [open, setOpen] = useState<"model" | "slash" | "mention" | null>(null)
  const showSlash = draft.value.startsWith("/")
  const showMention = draft.value.includes("@")
  return (
    <div className="relative rounded-2xl border border-neutral-200 bg-white p-2">
      <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
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
        placeholder="Write, or type / and @"
        onChange={(event) => draft.setValue(event.target.value)}
        onKeyDown={(event) => onEnter(event, draft.send, true)}
        className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-neutral-400"
      />
      <div className="flex items-center gap-0.5">
        <IconButton label="Attach" onClick={draft.openPicker}>
          <Paperclip className="size-4" />
        </IconButton>
        <IconButton label="Commands" onClick={() => setOpen("slash")}>
          <Slash className="size-4" />
        </IconButton>
        <IconButton label="Mention" onClick={() => setOpen("mention")}>
          <AtSign className="size-4" />
        </IconButton>
        <button
          type="button"
          onClick={() => setOpen(open === "model" ? null : "model")}
          className="rounded-full px-2 py-1 text-xs text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2"
        >
          {model}
        </button>
        <span className="ml-auto text-neutral-500" title="Context">
          <Ring value={42} />
        </span>
        <IconButton label="Voice" onClick={() => undefined}>
          <Mic className="size-4" />
        </IconButton>
        <SendCircle
          busy={draft.busy}
          ready={draft.ready}
          onSend={draft.send}
          onStop={draft.stop}
        />
      </div>
      <Menu open={open === "model" || showSlash || showMention} className="bottom-full left-2 mb-2">
        {open === "model"
          ? ["GPT-6 Luna", "Claude", "Gemini"].map((item) => (
              <MenuItem
                key={item}
                onClick={() => {
                  setModel(item)
                  setOpen(null)
                }}
              >
                {item}
              </MenuItem>
            ))
          : null}
        {showSlash || open === "slash"
          ? ["/search", "/remember"].map((item) => (
              <MenuItem key={item} onClick={() => { draft.setValue(`${item} `); setOpen(null) }}>
                {item}
              </MenuItem>
            ))
          : null}
        {showMention || open === "mention"
          ? ["@memory", "@file"].map((item) => (
              <MenuItem key={item} onClick={() => { draft.setValue(`${draft.value}${item} `); setOpen(null) }}>
                {item}
              </MenuItem>
            ))
          : null}
      </Menu>
    </div>
  )
}

function Ring({ value }: { value: number }) {
  const radius = 7
  const circ = 2 * Math.PI * radius
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-label={`${value}% context`}>
      <circle cx="9" cy="9" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
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

export function ChatgptExample() {
  const draft = useDraft()
  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white px-3 py-3 shadow-sm">
      <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
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
        placeholder="Message ChatGPT"
        onChange={(event) => draft.setValue(event.target.value)}
        onKeyDown={(event) => onEnter(event, draft.send, true)}
        className="w-full resize-none bg-transparent px-2 text-sm outline-none placeholder:text-neutral-400"
      />
      <div className="flex items-center">
        <IconButton label="Add" onClick={draft.openPicker}>
          <Plus className="size-4" />
        </IconButton>
        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Voice" onClick={() => undefined}>
            <Mic className="size-4" />
          </IconButton>
          <SendCircle busy={draft.busy} ready={draft.ready} onSend={draft.send} onStop={draft.stop} />
        </div>
      </div>
    </div>
  )
}

export function ClaudeExample() {
  const draft = useDraft()
  return (
    <div className="rounded-xl border border-[#e8e6dc] bg-[#faf9f5] p-2">
      <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
      <FileChips
        files={draft.files}
        onRemove={(name) =>
          draft.setFiles((current) => current.filter((file) => file !== name))
        }
      />
      <div className="rounded-lg border border-black/10 bg-white">
        <textarea
          aria-label="Reply"
          rows={3}
          value={draft.value}
          placeholder="How can I help you today?"
          onChange={(event) => draft.setValue(event.target.value)}
          onKeyDown={(event) => onEnter(event, draft.send, true)}
          className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-neutral-400"
        />
        <div className="flex items-center px-1 pb-1">
          <IconButton label="Add" onClick={draft.openPicker}>
            <Plus className="size-4" />
          </IconButton>
          <div className="ml-auto">
            <SendCircle busy={draft.busy} ready={draft.ready} onSend={draft.send} onStop={draft.stop} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function GeminiExample() {
  const draft = useDraft()
  const [menu, setMenu] = useState(false)
  const showMic = !draft.ready && !draft.busy
  return (
    <form
      className="relative flex items-center gap-1 rounded-full border border-neutral-200 bg-white py-1 pr-1 pl-1 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault()
        draft.send()
      }}
    >
      <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
      <IconButton label="Tools" onClick={() => setMenu((value) => !value)}>
        <Plus className="size-4" />
      </IconButton>
      <input
        aria-label="Message"
        value={draft.value}
        placeholder="Ask Gemini"
        onChange={(event) => draft.setValue(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
      />
      {showMic ? (
        <IconButton label="Voice" onClick={() => undefined}>
          <Mic className="size-4" />
        </IconButton>
      ) : (
        <SendCircle busy={draft.busy} ready={draft.ready} onSend={draft.send} onStop={draft.stop} tone="blue" />
      )}
      <Menu open={menu} className="bottom-full left-0 mb-2">
        {["Upload", "Deep research", "Canvas"].map((item) => (
          <MenuItem
            key={item}
            onClick={() => {
              if (item === "Upload") draft.openPicker()
              setMenu(false)
            }}
          >
            {item}
          </MenuItem>
        ))}
      </Menu>
    </form>
  )
}

export function GrokComposer() {
  const draft = useDraft()
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState("Grok")
  const showMic = !draft.ready && !draft.busy
  return (
    <form
      className="relative flex items-center gap-1 rounded-full bg-neutral-950 px-2 py-1.5 text-white"
      onSubmit={(event) => {
        event.preventDefault()
        draft.send()
      }}
    >
      <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
      <IconButton label="Attach" onClick={draft.openPicker} className="text-white hover:bg-white/10">
        <Paperclip className="size-4" />
      </IconButton>
      <input
        aria-label="Message"
        value={draft.value}
        placeholder="Ask anything"
        onChange={(event) => draft.setValue(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
      />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-white/80 outline-none hover:bg-white/10 focus-visible:ring-2"
      >
        {model}
        <ChevronDown className="size-3" />
      </button>
      {showMic ? (
        <IconButton label="Voice" onClick={() => undefined} className="text-white">
          <Mic className="size-4" />
        </IconButton>
      ) : (
        <SendCircle busy={draft.busy} ready={draft.ready} onSend={draft.send} onStop={draft.stop} tone="light" />
      )}
      <Menu open={open} className="right-0 bottom-full mb-2">
        {["Grok", "Grok Fast", "Grok Thinking"].map((item) => (
          <MenuItem key={item} onClick={() => { setModel(item); setOpen(false) }}>
            {item}
          </MenuItem>
        ))}
      </Menu>
    </form>
  )
}

export function PerplexityExample() {
  const draft = useDraft()
  const [search, setSearch] = useState("Search")
  const [model, setModel] = useState("Best")
  const [which, setWhich] = useState<"search" | "model" | null>(null)
  const showMic = !draft.ready && !draft.busy
  return (
    <div className="relative rounded-3xl border border-neutral-200 bg-white p-3">
      <textarea
        aria-label="Ask"
        rows={4}
        value={draft.value}
        placeholder="Ask anything..."
        onChange={(event) => draft.setValue(event.target.value)}
        onKeyDown={(event) => onEnter(event, draft.send, true)}
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-neutral-400"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWhich(which === "search" ? null : "search")}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs outline-none focus-visible:ring-2"
        >
          {search}
          <ChevronDown className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => setWhich(which === "model" ? null : "model")}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs outline-none focus-visible:ring-2"
        >
          {model}
          <ChevronDown className="size-3" />
        </button>
        <div className="ml-auto">
          {showMic ? (
            <IconButton label="Voice" onClick={() => undefined}>
              <Mic className="size-4" />
            </IconButton>
          ) : (
            <SendCircle busy={draft.busy} ready={draft.ready} onSend={draft.send} onStop={draft.stop} tone="blue" />
          )}
        </div>
      </div>
      <Menu open={which !== null} className="bottom-12 left-3">
        {(which === "search" ? ["Search", "Research", "Labs"] : ["Best", "Sonar", "Claude", "GPT", "Gemini"]).map((item) => (
          <MenuItem
            key={item}
            onClick={() => {
              if (which === "search") setSearch(item)
              else setModel(item)
              setWhich(null)
            }}
          >
            {item}
          </MenuItem>
        ))}
      </Menu>
    </div>
  )
}

export function MobileComposer() {
  const draft = useDraft()
  const prompts = ["Summarize", "Explain", "Translate"]
  return (
    <div className="mx-auto w-[260px] rounded-[28px] border-4 border-neutral-800 bg-neutral-100 px-3 pt-6 pb-3">
      <FilePicker pickerRef={draft.pickerRef} onPick={draft.takeFiles} />
      <div className="mb-3 flex gap-1.5">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => draft.setValue(prompt)}
            className="rounded-full bg-white px-2 py-1 text-[11px] outline-none focus-visible:ring-2"
          >
            {prompt}
          </button>
        ))}
      </div>
      <form
        className="flex items-center gap-1 rounded-full bg-white px-1 py-1"
        onSubmit={(event) => {
          event.preventDefault()
          draft.send()
        }}
      >
        <IconButton label="Attach" onClick={draft.openPicker}>
          <Plus className="size-4" />
        </IconButton>
        <input
          aria-label="Message"
          value={draft.value}
          placeholder="Message"
          onChange={(event) => draft.setValue(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <SendCircle busy={draft.busy} ready={draft.ready} onSend={draft.send} onStop={draft.stop} />
      </form>
    </div>
  )
}

export function FloatingComposer() {
  const draft = useDraft()
  const [open, setOpen] = useState(true)
  return (
    <div className="relative h-56 rounded-xl bg-neutral-100">
      {open ? (
        <div className="absolute right-3 bottom-16 w-64 rounded-2xl border bg-white p-3 shadow-lg">
          <p className="mb-2 text-sm font-medium">PatchAI</p>
          <textarea
            aria-label="Message"
            rows={2}
            value={draft.value}
            placeholder="Send a message..."
            onChange={(event) => draft.setValue(event.target.value)}
            onKeyDown={(event) => onEnter(event, draft.send, true)}
            className="w-full resize-none rounded-xl border px-2 py-1 text-sm outline-none"
          />
          <div className="mt-2 flex justify-end">
            <SendCircle busy={draft.busy} ready={draft.ready} onSend={draft.send} onStop={draft.stop} />
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="absolute right-3 bottom-3 inline-flex size-12 items-center justify-center rounded-full bg-neutral-950 text-sm text-white outline-none focus-visible:ring-2"
      >
        {open ? "Hide" : "Chat"}
      </button>
    </div>
  )
}

export function HeadlessComposer() {
  const draft = useDraft()
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        draft.send()
      }}
    >
      <label className="block text-sm">
        Message
        <textarea
          rows={3}
          value={draft.value}
          onChange={(event) => draft.setValue(event.target.value)}
          onKeyDown={(event) => onEnter(event, draft.send, true)}
          className="mt-1 w-full border border-neutral-500 bg-white p-2 text-sm outline-none"
        />
      </label>
      <button
        type="button"
        disabled={!draft.ready && !draft.busy}
        onClick={draft.busy ? draft.stop : draft.send}
        className="mt-2 text-sm underline outline-none focus-visible:ring-2 disabled:no-underline disabled:opacity-40"
      >
        {draft.busy ? "Stop" : "Send"}
      </button>
    </form>
  )
}
