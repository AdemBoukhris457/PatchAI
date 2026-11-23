"use client"

import { useAui } from "@assistant-ui/react"
import { Check, ChevronDown } from "lucide-react"
import { useEffect, useId, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react"

import { CHAT_MODELS, DEFAULT_CHAT_MODEL, chatModel, type ChatModelId } from "@/lib/chat-models"
import {
  DEFAULT_REASONING_EFFORT,
  REASONING_EFFORTS,
  reasoningEffort,
  type ReasoningEffortId,
} from "@/lib/reasoning-effort"

const MODEL_KEY = "patchai.model"
const EFFORT_KEY = "patchai.effort"

export function ComposerModelMenu() {
  const aui = useAui()
  const modelRoot = useRef<HTMLDivElement>(null)
  const effortRoot = useRef<HTMLDivElement>(null)
  const modelListId = useId()
  const effortListId = useId()
  const [modelOpen, setModelOpen] = useState(false)
  const [effortOpen, setEffortOpen] = useState(false)
  const [modelId, setModelId] = useState<ChatModelId>(DEFAULT_CHAT_MODEL)
  const [effortId, setEffortId] = useState<ReasoningEffortId>(DEFAULT_REASONING_EFFORT)
  const model = chatModel(modelId)
  const effort = reasoningEffort(effortId)

  useEffect(() => {
    const savedModel = window.localStorage.getItem(MODEL_KEY)
    if (savedModel && CHAT_MODELS.some((item) => item.id === savedModel)) {
      setModelId(savedModel as ChatModelId)
    }
    const savedEffort = window.localStorage.getItem(EFFORT_KEY)
    if (savedEffort && REASONING_EFFORTS.some((item) => item.id === savedEffort)) {
      setEffortId(savedEffort as ReasoningEffortId)
    }
  }, [])

  useEffect(() => {
    return aui.modelContext.register({
      getModelContext: () => ({
        config: { modelName: modelId, reasoningEffort: effortId },
      }),
    })
  }, [aui, modelId, effortId])

  useDismiss(modelOpen, modelRoot, setModelOpen)
  useDismiss(effortOpen, effortRoot, setEffortOpen)

  function chooseModel(id: ChatModelId) {
    setModelId(id)
    window.localStorage.setItem(MODEL_KEY, id)
    setModelOpen(false)
  }

  function chooseEffort(id: ReasoningEffortId) {
    setEffortId(id)
    window.localStorage.setItem(EFFORT_KEY, id)
    setEffortOpen(false)
  }

  return (
    <>
      <div ref={modelRoot} className="relative">
        <button
          type="button"
          aria-label={`Model, ${model.name}`}
          aria-expanded={modelOpen}
          aria-controls={modelListId}
          onClick={() => {
            setModelOpen((value) => !value)
            setEffortOpen(false)
          }}
          className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs whitespace-nowrap outline-none focus-visible:ring-2"
        >
          {model.name}
          <ChevronDown className={`size-3.5 transition-transform ${modelOpen ? "rotate-180" : ""}`} />
        </button>
        {modelOpen ? (
          <div
            id={modelListId}
            role="listbox"
            aria-label="Models"
            className="bg-popover text-popover-foreground absolute bottom-full left-0 z-30 mb-2 w-72 rounded-[6px] border p-1 shadow-md"
          >
            {CHAT_MODELS.map((item) => {
              const selected = item.id === model.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => chooseModel(item.id)}
                  className="hover:bg-muted data-highlighted:bg-muted flex w-full items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-left outline-none focus-visible:bg-muted"
                >
                  <span className="min-w-0 flex-1 text-sm">{item.name}</span>
                  <span className="text-muted-foreground text-xs">{item.detail}</span>
                  <Check className={`size-3.5 shrink-0 ${selected ? "opacity-100" : "opacity-0"}`} />
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
      <div ref={effortRoot} className="relative">
        <button
          type="button"
          aria-label={`Effort, ${effort.name}`}
          aria-expanded={effortOpen}
          aria-controls={effortListId}
          onClick={() => {
            setEffortOpen((value) => !value)
            setModelOpen(false)
          }}
          className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs whitespace-nowrap outline-none focus-visible:ring-2"
        >
          {effort.name}
          <ChevronDown className={`size-3.5 transition-transform ${effortOpen ? "rotate-180" : ""}`} />
        </button>
        {effortOpen ? (
          <div
            id={effortListId}
            role="listbox"
            aria-label="Thinking effort"
            className="bg-popover text-popover-foreground absolute bottom-full left-0 z-30 mb-2 w-56 rounded-[6px] border p-1 shadow-md"
          >
            {REASONING_EFFORTS.map((item) => {
              const selected = item.id === effort.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => chooseEffort(item.id)}
                  className="hover:bg-muted data-highlighted:bg-muted flex w-full items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-left outline-none focus-visible:bg-muted"
                >
                  <span className="min-w-0 flex-1 text-sm">{item.name}</span>
                  <span className="text-muted-foreground text-xs">{item.detail}</span>
                  <Check className={`size-3.5 shrink-0 ${selected ? "opacity-100" : "opacity-0"}`} />
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </>
  )
}

function useDismiss(
  open: boolean,
  root: RefObject<HTMLDivElement | null>,
  setOpen: Dispatch<SetStateAction<boolean>>,
) {
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
  }, [open, root, setOpen])
}
