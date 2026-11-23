"use client"

import { useChat } from "@ai-sdk/react"
import {
  AssistantChatTransport,
  useAISDKRuntime,
} from "@assistant-ui/ai-sdk"
import {
  AssistantRuntimeProvider,
  WebSpeechDictationAdapter,
} from "@assistant-ui/react"
import type { UIMessage } from "ai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { ChatSidebar } from "@/components/chat-sidebar"
import { PdfPreviewPanel, PdfPreviewProvider } from "@/components/pdf-preview"
import { Thread } from "@/components/thread.aui"
import { ThreadFileMenu } from "@/components/thread-file-menu"
import { UnsupportedFileNotice } from "@/components/unsupported-file"
import { acceptedAttachmentAdapter } from "@/lib/attachment-adapter"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  attachFiles,
  createChat,
  loadChats,
  sameMessages,
  saveChats,
  titleFrom,
  type StoredChat,
} from "@/lib/chats"

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
  // Each chat remounts this thread, so the seed is the list from that mount.
  const seeded = useRef(initialMessages)
  const chat = useChat({
    id: chatId,
    messages: seeded.current,
    transport,
    throttle: 50,
  })
  const dictation = useMemo(() => new WebSpeechDictationAdapter(), [])
  const adapters = useMemo(
    () => ({ attachments: acceptedAttachmentAdapter, dictation }),
    [dictation],
  )
  const runtime = useAISDKRuntime(chat, { adapters })
  const latest = useRef({ chatId, messages: chat.messages, onMessages })
  latest.current = { chatId, messages: chat.messages, onMessages }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const current = latest.current
      current.onMessages(current.chatId, current.messages)
    }, 80)
    return () => window.clearTimeout(handle)
  }, [chat.messages, chatId, onMessages])

  useEffect(() => {
    return () => {
      const current = latest.current
      current.onMessages(current.chatId, current.messages)
    }
  }, [])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <PdfPreviewProvider>
        <UnsupportedFileNotice />
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 px-3">
            <SidebarTrigger />
            <h1 className="text-sm font-medium">PatchAI</h1>
            <ThreadFileMenu />
          </header>
          <div className="relative flex min-h-0 w-full flex-1">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <Thread />
            </div>
            <PdfPreviewPanel />
          </div>
        </div>
      </PdfPreviewProvider>
    </AssistantRuntimeProvider>
  )
}

function withVisibleChat(chats: StoredChat[]) {
  if (chats.some((chat) => !chat.archived)) return chats
  return [createChat(), ...chats]
}

export function ChatScreen() {
  const [chats, setChats] = useState<StoredChat[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancel = false
    void attachFiles(loadChats()).then((loaded) => {
      if (cancel) return
      const kept = loaded.filter((chat) => chat.messages.length > 0)
      if (kept.length !== loaded.length) saveChats(kept)
      const next = kept.length > 0 ? kept : loaded
      setChats(next)
      setActiveId(
        next.find((chat) => !chat.archived && chat.messages.length > 0)?.id ??
          next.find((chat) => !chat.archived)?.id ??
          next[0]?.id ??
          null,
      )
      setReady(true)
    })
    return () => {
      cancel = true
    }
  }, [])

  const remember = useCallback((id: string, messages: UIMessage[]) => {
    setChats((current) => {
      const existing = current.find((chat) => chat.id === id)
      if (!existing) {
        return current
      }
      const auto = titleFrom(messages)
      const previousAuto = titleFrom(existing.messages)
      const title =
        existing.title === previousAuto || existing.title === "New chat"
          ? auto
          : existing.title
      const same =
        existing.title === title && sameMessages(existing.messages, messages)
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
    setChats((current) => [chat, ...current])
    setActiveId(chat.id)
    setQuery("")
  }

  function deleteChat(id: string) {
    const remaining = chats.filter((chat) => chat.id !== id)
    const next = withVisibleChat(remaining)
    setChats(next)
    saveChats(next)
    if (id === activeId) {
      setActiveId(next.find((chat) => !chat.archived)?.id ?? null)
    }
  }

  function renameChat(id: string, title: string) {
    const nextTitle = title.trim()
    if (!nextTitle) return
    const next = chats.map((chat) =>
      chat.id === id ? { ...chat, title: nextTitle } : chat,
    )
    setChats(next)
    saveChats(next)
  }

  function pinChat(id: string) {
    const next = chats.map((chat) => {
      if (chat.id !== id) return chat
      return chat.pinned
        ? { ...chat, pinned: false, pinnedAt: undefined }
        : { ...chat, pinned: true, pinnedAt: Date.now() }
    })
    setChats(next)
    saveChats(next)
  }

  function archiveChat(id: string) {
    const next = withVisibleChat(
      chats.map((chat) =>
        chat.id === id ? { ...chat, archived: !chat.archived } : chat,
      ),
    )
    setChats(next)
    saveChats(next)
    const current = next.find((chat) => chat.id === id)
    if (current?.archived && id === activeId) {
      setActiveId(next.find((chat) => !chat.archived)?.id ?? null)
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
        onRename={renameChat}
        onArchive={archiveChat}
        onPin={pinChat}
      />
      <SidebarInset className="min-h-0">
        {active ? (
          <ChatThread
            key={active.id}
            chatId={active.id}
            initialMessages={active.messages}
            onMessages={remember}
          />
        ) : (
          <>
            <header className="flex h-14 shrink-0 items-center gap-2 px-3">
              <SidebarTrigger />
              <h1 className="text-sm font-medium">PatchAI</h1>
            </header>
            <div className="flex flex-1" />
          </>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
