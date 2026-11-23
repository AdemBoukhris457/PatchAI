"use client"

import {
  ComposerPrimitive,
  unstable_useMentionAdapter,
  unstable_useSlashCommandAdapter,
  unstable_useTriggerPopoverScopeContext,
  useAui,
  useAuiState,
  type Unstable_Mention,
  type Unstable_TriggerItem,
} from "@assistant-ui/react"
import type { DirectiveFormatter, DirectiveSegment } from "@assistant-ui/core"
import { AtSignIcon, SlashIcon } from "lucide-react"
import { useLayoutEffect, useMemo, useRef, type FC } from "react"

import { fileRequest, threadFileKey, type ThreadFile } from "@/lib/thread-files"

const MEMORY: Unstable_Mention = {
  id: "memory",
  type: "mention",
  label: "@memory",
  description: "Saved memories",
}

const MENTION_LABELS = [MEMORY.label]

const USE_SAVED_PREFERENCES = "Use my saved preferences."

const mentionFormatter: DirectiveFormatter = {
  serialize: (item) => {
    if (item.id === "memory") return USE_SAVED_PREFERENCES
    if (item.type === "file") return fileRequest(item.label)
    return item.label
  },
  parse(text) {
    const segments: DirectiveSegment[] = []
    let rest = text
    while (rest.length > 0) {
      const hit = MENTION_LABELS.map((label) => ({
        label,
        index: rest.indexOf(label),
      }))
        .filter((item) => item.index >= 0)
        .sort((left, right) => left.index - right.index)[0]
      if (!hit) {
        segments.push({ kind: "text", text: rest })
        break
      }
      if (hit.index > 0) {
        segments.push({ kind: "text", text: rest.slice(0, hit.index) })
      }
      segments.push({
        kind: "mention",
        type: "mention",
        label: hit.label,
        id: hit.label.slice(1),
      })
      rest = rest.slice(hit.index + hit.label.length)
    }
    return segments
  },
}

const PROMPTS: Record<string, string> = {
  time: "What time is it right now?",
  search: "Search for ",
  remember: "Remember this: ",
}

function fillCommand(text: string, prompt: string) {
  const trimmed = text.trim()
  return trimmed ? `${trimmed} ${prompt}` : prompt
}

function focusComposer(expected: string) {
  const started = performance.now()
  const placeCaret = () => {
    const input = document.querySelector<HTMLTextAreaElement>(
      ".aui-composer-input",
    )
    if (!input) return
    if (input.value !== expected) {
      if (performance.now() - started < 400) requestAnimationFrame(placeCaret)
      return
    }
    input.focus()
    // A same-value input event is ignored, so the caret never reaches the trigger.
    const write = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set
    const end = expected.length
    write?.call(input, `${expected} `)
    input.dispatchEvent(new InputEvent("input", { bubbles: true }))
    write?.call(input, expected)
    input.setSelectionRange(end, end)
    input.dispatchEvent(new InputEvent("input", { bubbles: true }))
  }
  requestAnimationFrame(placeCaret)
}

const menuItem =
  "hover:bg-muted data-highlighted:bg-muted flex w-full flex-col items-start rounded-lg px-2.5 py-1.5 text-left outline-none"

const menu =
  "bg-popover text-popover-foreground absolute bottom-full left-2 z-20 mb-2 max-h-64 w-56 overflow-y-auto rounded-xl border p-1 shadow-md"

function ChooseMemoryImmediately() {
  const { activeCategoryId, selectItem } = unstable_useTriggerPopoverScopeContext()
  const chosen = useRef(false)
  useLayoutEffect(() => {
    if (activeCategoryId !== "memory") {
      chosen.current = false
      return
    }
    if (chosen.current) return
    chosen.current = true
    selectItem(MEMORY)
  }, [activeCategoryId, selectItem])
  return null
}

function MentionChoices({ items }: { items: readonly Unstable_TriggerItem[] }) {
  const { activeCategoryId } = unstable_useTriggerPopoverScopeContext()
  if (activeCategoryId === "memory") return null
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground px-2.5 py-1.5 text-xs">
        No files in this conversation
      </p>
    )
  }
  return items.map((item, index) => (
    <ComposerPrimitive.TriggerPopoverItem
      key={item.id}
      item={item}
      index={index}
      className={menuItem}
    >
      <span className="w-full truncate text-sm">{item.label}</span>
      {item.description ? (
        <span className="text-muted-foreground w-full truncate text-xs">
          {item.description}
        </span>
      ) : null}
    </ComposerPrimitive.TriggerPopoverItem>
  ))
}

function fileMention(file: ThreadFile): Unstable_Mention {
  const kind = file.kind === "pdf" ? "PDF" : "PowerPoint"
  return {
    id: file.filename,
    type: "file",
    label: file.filename,
    description: file.title ? `${kind} · ${file.title}` : kind,
  }
}

export const ComposerMenus: FC = () => {
  const aui = useAui()
  const savedKey = useAuiState((state) => threadFileKey(state.thread.messages))
  const files = useMemo(
    () => (JSON.parse(savedKey) as ThreadFile[]).map(fileMention),
    [savedKey],
  )
  const slash = unstable_useSlashCommandAdapter({
    removeOnExecute: true,
    commands: [
      {
        id: "time",
        description: "Ask for the current time",
        execute: () => {
          const text = aui.composer().getState().text
          aui.composer().setText(fillCommand(text, PROMPTS.time ?? ""))
        },
      },
      {
        id: "search",
        description: "Start a search",
        execute: () => {
          const text = aui.composer().getState().text
          aui.composer().setText(fillCommand(text, PROMPTS.search ?? ""))
        },
      },
      {
        id: "remember",
        description: "Ask to keep something",
        execute: () => {
          const text = aui.composer().getState().text
          aui.composer().setText(fillCommand(text, PROMPTS.remember ?? ""))
        },
      },
    ],
  })
  const mention = unstable_useMentionAdapter({
    categories: [
      { id: "memory", label: "@memory", items: [MEMORY] },
      { id: "file", label: "@file", items: files },
    ],
    includeModelContextTools: false,
    formatter: mentionFormatter,
  })

  return (
    <>
      <ComposerPrimitive.TriggerPopover
        char="/"
        adapter={slash.adapter}
        aria-label="Commands"
        className={menu}
      >
        <ComposerPrimitive.TriggerPopover.Action {...slash.action} />
        <ComposerPrimitive.TriggerPopoverItems>
          {(items) =>
            items.map((item, index) => (
              <ComposerPrimitive.TriggerPopoverItem
                key={item.id}
                item={item}
                index={index}
                className={menuItem}
              >
                <span className="text-sm">{item.label}</span>
                {item.description ? (
                  <span className="text-muted-foreground text-xs">
                    {item.description}
                  </span>
                ) : null}
              </ComposerPrimitive.TriggerPopoverItem>
            ))
          }
        </ComposerPrimitive.TriggerPopoverItems>
      </ComposerPrimitive.TriggerPopover>
      <ComposerPrimitive.TriggerPopover
        char="@"
        adapter={mention.adapter}
        aria-label="Mentions"
        className={menu}
      >
        <ComposerPrimitive.TriggerPopover.Directive {...mention.directive} />
        <ChooseMemoryImmediately />
        <ComposerPrimitive.TriggerPopoverCategories>
          {(categories) =>
            categories.map((category) => (
              <ComposerPrimitive.TriggerPopoverCategoryItem
                key={category.id}
                categoryId={category.id}
                className={menuItem}
              >
                <span className="text-sm">{category.label}</span>
                <span className="text-muted-foreground text-xs">
                  {category.id === "memory"
                    ? "Saved memories"
                    : "A file in this thread"}
                </span>
              </ComposerPrimitive.TriggerPopoverCategoryItem>
            ))
          }
        </ComposerPrimitive.TriggerPopoverCategories>
        <ComposerPrimitive.TriggerPopoverBack className="text-muted-foreground hover:bg-muted w-full rounded-lg px-2.5 py-1.5 text-left text-xs">
          Back
        </ComposerPrimitive.TriggerPopoverBack>
        <ComposerPrimitive.TriggerPopoverItems>
          {(items) => <MentionChoices items={items} />}
        </ComposerPrimitive.TriggerPopoverItems>
      </ComposerPrimitive.TriggerPopover>
    </>
  )
}

export const ComposerTriggerButtons: FC = () => {
  const aui = useAui()

  function insert(char: "/" | "@") {
    const text = aui.composer().getState().text
    let next = text
    if (char === "/") {
      next = text.startsWith("/") ? text : `/${text}`
    } else if (!text.endsWith("@")) {
      const gap = text.length > 0 && !text.endsWith(" ") ? " " : ""
      next = `${text}${gap}@`
    }
    aui.composer().setText(next)
    focusComposer(next)
  }

  return (
    <>
      <button
        type="button"
        aria-label="Commands"
        onClick={() => insert("/")}
        className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-2"
      >
        <SlashIcon className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Mention"
        onClick={() => insert("@")}
        className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-2"
      >
        <AtSignIcon className="size-4" />
      </button>
    </>
  )
}

export const ContextRing: FC = () => {
  const percent = useAuiState((s) => {
    let chars = s.composer.text.length
    for (const message of s.thread.messages) {
      for (const part of message.content) {
        if (part.type === "text") chars += part.text.length
      }
    }
    return Math.min(100, Math.round((chars / 800_000) * 100))
  })
  const radius = 7
  const circ = 2 * Math.PI * radius
  return (
    <span className="text-muted-foreground inline-flex size-8 items-center justify-center" title="Context">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-label={`${percent}% context`}>
        <circle
          cx="9"
          cy="9"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="2"
        />
        <circle
          cx="9"
          cy="9"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={`${(percent / 100) * circ} ${circ}`}
          transform="rotate(-90 9 9)"
        />
      </svg>
    </span>
  )
}
