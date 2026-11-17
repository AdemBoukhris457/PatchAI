"use client"

import { useChat } from "@ai-sdk/react"
import { TextStreamChatTransport, type UIMessage } from "ai"
import { ArrowUpIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message"
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
      <Button type="button" variant="outline" disabled>
        Theme
      </Button>
    )
  }

  const dark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="outline"
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

  return (
    <main className="flex h-svh border-l-[3px] border-seam">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-5">
        <header className="flex items-start justify-between gap-4 py-6">
          <div className="flex flex-col gap-1">
            <h1 className="font-reading text-2xl">PatchAI</h1>
            <p className="text-sm text-muted-foreground">
              A local conversation.
            </p>
          </div>
          <ThemeButton />
        </header>
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport aria-label="Conversation">
              <MessageScrollerContent
                aria-busy={busy}
                className="px-1 py-4"
              >
                {messages.length === 0 ? (
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyTitle className="font-reading text-base">
                        Start a conversation.
                      </EmptyTitle>
                      <EmptyDescription>
                        Ask for the time, or tell PatchAI something to
                        remember.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  messages.map((message) => {
                    const own = message.role === "user"
                    return (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        scrollAnchor={own}
                      >
                        <Message align={own ? "end" : "start"}>
                          <MessageContent>
                            <MessageHeader>
                              {own ? "You" : "PatchAI"}
                            </MessageHeader>
                            <Bubble
                              variant={own ? "default" : "ghost"}
                              align={own ? "end" : "start"}
                            >
                              <BubbleContent
                                className={
                                  own
                                    ? "whitespace-pre-wrap"
                                    : "font-reading whitespace-pre-wrap text-base"
                                }
                              >
                                {messageText(message)}
                              </BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    )
                  })
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
        <form className="flex flex-col gap-2 pb-5" onSubmit={onSubmit}>
          <p
            role="status"
            className="flex min-h-5 items-center gap-2 text-sm text-muted-foreground"
          >
            {busy ? (
              <Spinner role="presentation" aria-hidden="true" />
            ) : null}
            {busy ? "PatchAI is replying." : null}
            <span className="sr-only">{announcement}</span>
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          ) : null}
          <InputGroup>
            <label htmlFor="message" className="sr-only">
              Message
            </label>
            <InputGroupTextarea
              id="message"
              name="message"
              rows={3}
              value={draft}
              placeholder="Write a message"
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
              >
                <ArrowUpIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </div>
    </main>
  )
}
