"use client"

import { useChat } from "@ai-sdk/react"
import { TextStreamChatTransport, type UIMessage } from "ai"
import { ArrowUpIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Spinner } from "@/components/ui/spinner"

function messageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button type="button" variant="ghost" size="sm" disabled>
        Theme
      </Button>
    )
  }

  const dark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? "Light" : "Dark"}
    </Button>
  )
}

export function ChatScreen() {
  const transport = useMemo(
    () => new TextStreamChatTransport({ api: "/api/chat" }),
    [],
  )
  const { messages, sendMessage, status, error, stop } = useChat({
    id: "web",
    transport,
  })
  const [draft, setDraft] = useState("")
  const [announcement, setAnnouncement] = useState("")
  const wasBusy = useRef(false)
  const busy = status === "submitted" || status === "streaming"
  const canSend = draft.trim().length > 0 && !busy
  const started = messages.length > 0

  useEffect(() => {
    if (busy) {
      wasBusy.current = true
      return
    }
    if (wasBusy.current && status === "ready") {
      setAnnouncement("Reply ready.")
      wasBusy.current = false
    }
  }, [busy, status])

  async function submitText(raw: string) {
    const text = raw.trim()
    if (!text || busy) {
      return
    }
    setDraft("")
    setAnnouncement("")
    await sendMessage({ text })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const field = event.currentTarget.elements.namedItem("message")
    const raw = field instanceof HTMLTextAreaElement ? field.value : draft
    await submitText(raw)
  }

  const composer = (
    <form className="flex w-full flex-col gap-2" onSubmit={onSubmit}>
      <p role="status" className="sr-only">
        {busy ? "PatchAI is replying." : announcement}
      </p>
      {busy ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner role="presentation" aria-hidden="true" />
          PatchAI is replying.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
      <InputGroup className="rounded-[28px] bg-background px-1.5 py-1">
        <label htmlFor="message" className="sr-only">
          Message
        </label>
        <InputGroupTextarea
          id="message"
          name="message"
          rows={2}
          value={draft}
          placeholder="Ask anything"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void submitText(event.currentTarget.value)
            }
          }}
        />
        <InputGroupAddon align="block-end" className="justify-end">
          {busy ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => stop()}
            >
              Stop
            </Button>
          ) : null}
          <InputGroupButton
            type="submit"
            size="icon-sm"
            variant="default"
            disabled={!canSend}
            aria-label="Send"
            className="rounded-full"
          >
            <ArrowUpIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )

  return (
    <main className="flex h-svh bg-background">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4">
        <header className="flex h-14 shrink-0 items-center justify-between">
          <h1 className="text-sm font-medium">PatchAI</h1>
          <ThemeButton />
        </header>
        <div
          className={
            started
              ? "flex min-h-0 flex-1 flex-col pb-4"
              : "flex flex-1 flex-col items-center justify-center gap-6 pb-16"
          }
        >
          {started ? (
            <MessageScrollerProvider autoScroll>
              <MessageScroller className="min-h-0 flex-1">
                <MessageScrollerViewport aria-label="Conversation">
                  <MessageScrollerContent
                    aria-busy={busy}
                    className="gap-8 py-6"
                  >
                    {messages.map((message) => {
                      const own = message.role === "user"
                      return (
                        <MessageScrollerItem
                          key={message.id}
                          messageId={message.id}
                          scrollAnchor={own}
                        >
                          <Message align={own ? "end" : "start"}>
                            <MessageContent>
                              <Bubble
                                variant={own ? "muted" : "ghost"}
                                align={own ? "end" : "start"}
                              >
                                <BubbleContent className="whitespace-pre-wrap text-base leading-7">
                                  {messageText(message)}
                                </BubbleContent>
                              </Bubble>
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      )
                    })}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
          ) : (
            <p className="text-center text-2xl tracking-tight">
              How can I help you today?
            </p>
          )}
          {composer}
        </div>
      </div>
    </main>
  )
}
