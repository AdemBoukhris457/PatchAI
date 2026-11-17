"use client"

import { useChat } from "@ai-sdk/react"
import { TextStreamChatTransport, type UIMessage } from "ai"
import { ArrowUpIcon } from "lucide-react"
import { useTheme } from "next-themes"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"

import { ChatSidebar } from "@/components/chat-sidebar"
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
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import {
  createChat,
  loadChats,
  messageText,
  saveChats,
  titleFrom,
  type StoredChat,
} from "@/lib/chats"

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

function ChatThread({
  chatId,
  initialMessages,
  onMessages,
}: {
  chatId: string
  initialMessages: UIMessage[]
  onMessages: (id: string, messages: UIMessage[]) => void
}) {
  const transport = useMemo(
    () => new TextStreamChatTransport({ api: "/api/chat" }),
    [],
  )
  const { messages, sendMessage, status, error, stop } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
  })
  const [draft, setDraft] = useState("")
  const [announcement, setAnnouncement] = useState("")
  const wasBusy = useRef(false)
  const busy = status === "submitted" || status === "streaming"
  const canSend = draft.trim().length > 0 && !busy
  const started = messages.length > 0

  useEffect(() => {
    onMessages(chatId, messages)
  }, [chatId, messages, onMessages])

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
    <div
      className={
        started
          ? "mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pb-4"
          : "mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 pb-16"
      }
    >
      {started ? (
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport aria-label="Conversation">
              <MessageScrollerContent aria-busy={busy} className="gap-8 py-6">
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
  )
}

export function ChatScreen() {
  const [chats, setChats] = useState<StoredChat[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const loaded = loadChats()
    setChats(loaded)
    setActiveId(loaded[0]?.id ?? null)
    setReady(true)
  }, [])

  const remember = useCallback((id: string, messages: UIMessage[]) => {
    setChats((current) => {
      const existing = current.find((chat) => chat.id === id)
      if (!existing) {
        return current
      }
      const title = titleFrom(messages)
      const same =
        existing.title === title &&
        existing.messages.length === messages.length &&
        existing.messages.every(
          (message, index) =>
            message.id === messages[index]?.id &&
            messageText(message) === messageText(messages[index]),
        )
      if (same) {
        return current
      }
      const next = current
        .map((chat) =>
          chat.id === id
            ? { ...chat, title, messages, updatedAt: Date.now() }
            : chat,
        )
        .sort((left, right) => right.updatedAt - left.updatedAt)
      saveChats(next)
      return next
    })
  }, [])

  function openChat(id: string) {
    setActiveId(id)
  }

  function newChat() {
    const current = chats.find((chat) => chat.id === activeId)
    if (current && current.messages.length === 0) {
      setQuery("")
      setActiveId(current.id)
      return
    }
    const chat = createChat()
    const next = [chat, ...chats]
    setChats(next)
    saveChats(next)
    setActiveId(chat.id)
    setQuery("")
  }

  function deleteChat(id: string) {
    const remaining = chats.filter((chat) => chat.id !== id)
    const next = remaining.length > 0 ? remaining : [createChat()]
    setChats(next)
    saveChats(next)
    if (id === activeId) {
      setActiveId(next[0]?.id ?? null)
    }
  }

  const active = chats.find((chat) => chat.id === activeId) ?? null

  return (
    <SidebarProvider className="h-svh">
      <ChatSidebar
        chats={chats}
        activeId={activeId}
        query={query}
        ready={ready}
        onQueryChange={setQuery}
        onNewChat={newChat}
        onSelect={openChat}
        onDelete={deleteChat}
      />
      <SidebarInset className="min-h-0">
        <header className="flex h-14 shrink-0 items-center gap-2 px-3">
          <SidebarTrigger />
          <h1 className="text-sm font-medium">PatchAI</h1>
          <div className="ml-auto">
            <ThemeButton />
          </div>
        </header>
        {active ? (
          <ChatThread
            key={active.id}
            chatId={active.id}
            initialMessages={active.messages}
            onMessages={remember}
          />
        ) : (
          <div className="flex flex-1" />
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
