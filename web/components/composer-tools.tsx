"use client"

import {
  ComposerPrimitive,
  unstable_useMentionAdapter,
  unstable_useSlashCommandAdapter,
  useAui,
  useAuiState,
  type Unstable_Mention,
} from "@assistant-ui/react"
import type { DirectiveFormatter, DirectiveSegment } from "@assistant-ui/core"
import { AtSignIcon, SlashIcon } from "lucide-react"
import { type FC } from "react"

const MENTIONS: readonly Unstable_Mention[] = [
  {
    id: "memory",
    type: "mention",
    label: "@memory",
    description: "Saved memories",
  },
  {
    id: "thread",
    type: "mention",
    label: "@thread",
    description: "This conversation",
  },
  {
    id: "file",
    type: "mention",
    label: "@file",
    description: "A file in this thread",
  },
]

const MENTION_LABELS = MENTIONS.map((item) => item.label)

const mentionFormatter: DirectiveFormatter = {
  serialize: (item) => item.label,
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
  "bg-popover text-popover-foreground absolute bottom-full left-2 z-20 mb-2 w-56 overflow-hidden rounded-xl border p-1 shadow-md"

export const ComposerMenus: FC = () => {
  const aui = useAui()
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
    items: MENTIONS,
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
