"use client"

import { useChat } from "@ai-sdk/react"
import {
  AssistantChatTransport,
  useAISDKRuntime,
} from "@assistant-ui/ai-sdk"
import { AssistantRuntimeProvider } from "@assistant-ui/react"
import type { UIMessage } from "ai"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useMemo, useState } from "react"

import { ChatSidebar } from "@/components/chat-sidebar"
import { Thread } from "@/components/thread.aui"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  createChat,
  loadChats,
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
    () => new AssistantChatTransport({ api: "/api/chat" }),
    [],
  )
  const chat = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
  })
  const runtime = useAISDKRuntime(chat)

  useEffect(() => {
    onMessages(chatId, chat.messages)
  }, [chat.messages, chatId, onMessages])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
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
            JSON.stringify(message.parts) ===
              JSON.stringify(messages[index]?.parts),
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
