import type { UIMessage } from "ai"

import { fileKey, readFiles, replaceFiles, type StoredFile } from "@/lib/chat-files"

export type StoredChat = {
  id: string
  title: string
  updatedAt: number
  messages: UIMessage[]
  archived?: boolean
  pinned?: boolean
  pinnedAt?: number
}

const STORAGE_KEY = "patchai.chats"
let savedFileSignature = ""

export function messageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

export function previewFrom(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message) continue
    const text = messageText(message).replace(/\s+/g, " ").trim()
    if (text) return text
  }
  return ""
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

export function sameMessages(left: UIMessage[], right: UIMessage[]) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]
    const b = right[index]
    if (!a || !b || a.id !== b.id || a.role !== b.role) return false
    if (a.parts.length !== b.parts.length) return false
    for (let partIndex = 0; partIndex < a.parts.length; partIndex += 1) {
      const part = a.parts[partIndex]
      const other = b.parts[partIndex]
      if (!part || !other || part.type !== other.type) return false
      if (part.type === "text" && other.type === "text") {
        if (part.text !== other.text) return false
        continue
      }
      if (part.type === "file" && other.type === "file") {
        if (
          part.filename !== other.filename ||
          part.mediaType !== other.mediaType ||
          part.url !== other.url
        ) {
          return false
        }
        continue
      }
      if (JSON.stringify(part) !== JSON.stringify(other)) return false
    }
  }
  return true
}

export async function attachFiles(chats: StoredChat[]) {
  let files: StoredFile[] = []
  try {
    files = await readFiles()
  } catch {
    return chats
  }
  if (files.length === 0) return chats
  const urls = new Map(files.map((file) => [file.id, file.url]))
  return chats.map((chat) => ({
    ...chat,
    messages: chat.messages.map((message) => ({
      ...message,
      parts: message.parts.map((part, index) => {
        if (part.type !== "file" || part.url) return part
        const url = urls.get(fileKey(chat.id, message.id, index))
        return url ? { ...part, url } : part
      }),
    })),
  }))
}

function splitFiles(chats: StoredChat[]) {
  const records: StoredFile[] = []
  const liveKeys = new Set<string>()
  const stored = chats.map((chat) => ({
    ...chat,
    messages: chat.messages.map((message) => ({
      ...message,
      parts: message.parts.map((part, index) => {
        if (part.type !== "file") return part
        const key = fileKey(chat.id, message.id, index)
        liveKeys.add(key)
        if (!part.url) return part
        records.push({ id: key, chatId: chat.id, url: part.url })
        return { ...part, url: "" }
      }),
    })),
  }))
  return { stored, records, liveKeys }
}

function fileSignature(records: StoredFile[]) {
  return records
    .map((record) => `${record.id}:${record.url.length}:${record.url.slice(-32)}`)
    .join("\n")
}

function isQuotaError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.code === 22)
  )
}

function writeLocal(chats: StoredChat[]) {
  let kept = chats
  for (;;) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kept))
      return
    } catch (error) {
      if (!isQuotaError(error) || kept.length <= 1) return
      kept = kept.slice(0, -1)
    }
  }
}

export function saveChats(chats: StoredChat[]) {
  const withMessages = chats.filter((chat) => chat.messages.length > 0)
  let stored: StoredChat[]
  let records: StoredFile[]
  let liveKeys: Set<string>
  try {
    const split = splitFiles(withMessages)
    stored = split.stored
    records = split.records
    liveKeys = split.liveKeys
    writeLocal(stored)
  } catch {
    return
  }
  const signature = fileSignature(records)
  if (signature === savedFileSignature) return
  savedFileSignature = signature
  const chatIds = new Set(withMessages.map((chat) => chat.id))
  void replaceFiles(records, liveKeys, chatIds).catch(() => {
    savedFileSignature = ""
  })
}
