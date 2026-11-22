"use client"

import { Check, ChevronDown } from "lucide-react"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"

import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from "@/lib/chat-models"

const MODELS = CHAT_MODELS
const DEFAULT_ID = DEFAULT_CHAT_MODEL

function useModelMenu() {
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [modelId, setModelId] = useState<string>(DEFAULT_ID)
  const model = MODELS.find((item) => item.id === modelId) ?? MODELS[MODELS.length - 1]

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

  function choose(id: string) {
    setModelId(id)
    setOpen(false)
  }

  return { root, open, setOpen, model, choose }
}

function ComposerFrame({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
      <p className="px-2.5 py-2 text-sm text-neutral-400">Write, or type / and @</p>
      <div className="flex items-center px-1">{children}</div>
    </div>
  )
}

export function AssistantModelMenu() {
  const menu = useModelMenu()
  const listId = useId()
  return (
    <ComposerFrame>
      <div ref={menu.root} className="relative">
        <button
          type="button"
          aria-label="Model"
          aria-expanded={menu.open}
          aria-controls={listId}
          onClick={() => menu.setOpen((value) => !value)}
          className="text-muted-foreground inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs outline-none hover:bg-neutral-100 focus-visible:ring-2"
        >
          {menu.model.name}
          <ChevronDown className={`size-3.5 transition-transform ${menu.open ? "rotate-180" : ""}`} />
        </button>
        {menu.open ? (
          <div
            id={listId}
            role="listbox"
            aria-label="Models"
            className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-xl border border-neutral-200 bg-white p-1 shadow-md"
          >
            {MODELS.map((item) => {
              const selected = item.id === menu.model.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => menu.choose(item.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100"
                >
                  <span className="min-w-0 flex-1 text-sm">{item.name}</span>
                  <span className="text-xs text-neutral-500 tabular-nums">{item.detail}</span>
                  <Check className={`size-3.5 shrink-0 ${selected ? "opacity-100" : "opacity-0"}`} />
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </ComposerFrame>
  )
}

export function NotraModelMenu() {
  const menu = useModelMenu()
  const listId = useId()
  return (
    <ComposerFrame>
      <div ref={menu.root} className="relative">
        <button
          type="button"
          aria-label="Model"
          aria-expanded={menu.open}
          aria-controls={listId}
          onClick={() => menu.setOpen((value) => !value)}
          className={`inline-flex h-8 items-center gap-1 rounded-full px-2 text-sm outline-none hover:bg-neutral-100 focus-visible:ring-2 ${menu.open ? "bg-neutral-100" : ""}`}
        >
          {menu.model.name}
          <ChevronDown className={`size-3.5 text-neutral-500 transition-transform ${menu.open ? "rotate-180" : ""}`} />
        </button>
        {menu.open ? (
          <div
            id={listId}
            role="radiogroup"
            aria-label="Models"
            className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-neutral-200 bg-white p-1 shadow-md"
          >
            {MODELS.map((item) => {
              const selected = item.id === menu.model.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => menu.choose(item.id)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100"
                >
                  <Check className={`mt-0.5 size-3.5 shrink-0 ${selected ? "opacity-100" : "opacity-0"}`} />
                  <span className="min-w-0">
                    <span className="block text-sm">{item.name}</span>
                    <span className="block text-xs text-neutral-500">{item.detail}</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </ComposerFrame>
  )
}
