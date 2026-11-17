import type { UIMessage } from "ai"

export type StoredChat = {
  id: string
  title: string
  updatedAt: number
  messages: UIMessage[]
}

const STORAGE_KEY = "patchai.chats"

export function messageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

export function titleFrom(messages: UIMessage[]) {
  const first = messages.find((message) => message.role === "user")
  if (!first) {
    return "New chat"
  }
  const text = messageText(first).replace(/\s+/g, " ").trim()
  if (!text) {
    return "New chat"
  }
  return text.length > 48 ? `${text.slice(0, 48).trimEnd()}…` : text
}

export function createChat(): StoredChat {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    updatedAt: Date.now(),
    messages: [],
  }
}

export function loadChats(): StoredChat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return [createChat()]
    }
    const parsed = JSON.parse(raw) as StoredChat[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createChat()]
    }
    const chats = parsed.filter(
      (chat) =>
        typeof chat?.id === "string" &&
        typeof chat.title === "string" &&
        Array.isArray(chat.messages),
    )
    return chats.length > 0 ? chats : [createChat()]
  } catch {
    return [createChat()]
  }
}

export function saveChats(chats: StoredChat[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
}
