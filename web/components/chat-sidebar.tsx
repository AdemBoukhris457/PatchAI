"use client"

import {
  Archive,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Pin,
  Plus,
  Search,
  Sun,
  Trash2,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { TooltipIconButton } from "@/components/tooltip-icon-button"
import { mono } from "@/components/surfaces"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
  SidebarRail,
} from "@/components/ui/sidebar"
import { previewFrom, type StoredChat } from "@/lib/chats"

const SOURCE = "https://github.com/AdemBoukhris457/PatchAI"

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const dark = resolvedTheme === "dark"
  const label = !mounted
    ? "Theme"
    : dark
      ? "Use light theme"
      : "Use dark theme"

  return (
    <TooltipIconButton
      tooltip={label}
      side="right"
      aria-label={label}
      disabled={!mounted}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="size-8 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {mounted ? (
        dark ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )
      ) : (
        <span className="size-4" />
      )}
    </TooltipIconButton>
  )
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function dayLabel(updatedAt: number, startOfToday: number) {
  if (updatedAt >= startOfToday) return "Today"
  const yesterday = new Date(startOfToday)
  yesterday.setDate(yesterday.getDate() - 1)
  if (updatedAt >= yesterday.getTime()) return "Yesterday"
  return "Earlier"
}

function groupChats(chats: StoredChat[], startOfToday: number | null) {
  if (startOfToday === null) {
    return [{ label: null as string | null, chats }]
  }
  const order = ["Today", "Yesterday", "Earlier"] as const
  const buckets = new Map<string, StoredChat[]>()
  for (const chat of chats) {
    const label = dayLabel(chat.updatedAt || 0, startOfToday)
    const rows = buckets.get(label) ?? []
    rows.push(chat)
    buckets.set(label, rows)
  }
  return order
    .filter((label) => buckets.has(label))
    .map((label) => ({ label, chats: buckets.get(label) ?? [] }))
}

function ThreadRow({
  chat,
  preview,
  active,
  menuOpen,
  renaming,
  onSelect,
  onOpenMenu,
  onRename,
  onRenameCancel,
}: {
  chat: StoredChat
  preview: string
  active: boolean
  menuOpen: boolean
  renaming: boolean
  onSelect: () => void
  onOpenMenu: (anchor: HTMLButtonElement) => void
  onRename: (title: string) => void
  onRenameCancel: () => void
}) {
  const skipBlur = useRef(false)
  return (
    <div
      className={`group relative rounded-xl ${active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent"}`}
    >
      {renaming ? (
        <input
          autoFocus
          aria-label={`Rename ${chat.title}`}
          defaultValue={chat.title}
          className="h-8 w-full rounded-xl bg-transparent px-2.5 text-sm outline-none"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              onRename(event.currentTarget.value)
            } else if (event.key === "Escape") {
              event.preventDefault()
              skipBlur.current = true
              onRenameCancel()
            }
          }}
          onBlur={(event) => {
            if (skipBlur.current) return
            onRename(event.currentTarget.value)
          }}
        />
      ) : (
        <button
          type="button"
          aria-current={active ? "page" : undefined}
          title={chat.title}
          onClick={onSelect}
          className="flex w-full flex-col gap-0.5 rounded-xl px-2 py-1 text-left"
        >
          <span className="flex items-center gap-1.5 group-hover:pe-7 group-has-aria-expanded:pe-7">
            {chat.pinned ? (
              <Pin className="size-2.5 shrink-0 text-muted-foreground" />
            ) : null}
            <span className="min-w-0 flex-1 truncate text-[13px]">{chat.title}</span>
          </span>
          {preview ? (
            <span className="truncate text-xs text-muted-foreground">{preview}</span>
          ) : null}
        </button>
      )}
      <button
        type="button"
        aria-label={`More options for ${chat.title}`}
        aria-expanded={menuOpen}
        onClick={(event) => onOpenMenu(event.currentTarget)}
        className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 aria-expanded:opacity-100"
      >
        <MoreHorizontal className="size-4" />
      </button>
    </div>
  )
}

export function ChatSidebar({
  chats,
  activeId,
  query,
  ready,
  onQueryChange,
  onNewChat,
  onSelect,
  onDelete,
  onRename,
  onArchive,
  onPin,
}: {
  chats: StoredChat[]
  activeId: string | null
  query: string
  ready: boolean
  onQueryChange: (value: string) => void
  onNewChat: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onArchive: (id: string) => void
  onPin: (id: string) => void
}) {
  const [startOfToday, setStartOfToday] = useState<number | null>(null)
  const [menu, setMenu] = useState<{
    id: string
    top: number
    left: number
  } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)

  useEffect(() => {
    setStartOfToday(startOfLocalDay(new Date()))
  }, [])

  useEffect(() => {
    if (!menu) return
    function close() {
      setMenu(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("resize", close)
    window.addEventListener("scroll", close, true)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [menu])

  const needle = query.trim().toLowerCase()
  const matches = (chat: StoredChat) => {
    if (!needle) return true
    const haystack = `${chat.title} ${previewFrom(chat.messages)}`.toLowerCase()
    return haystack.includes(needle)
  }
  const visible = chats.filter(
    (chat) => !chat.archived && chat.messages.length > 0 && matches(chat),
  )
  const pinned = visible
    .filter((chat) => chat.pinned)
    .sort((left, right) => (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0))
  const archived = chats.filter(
    (chat) => chat.archived && chat.messages.length > 0 && matches(chat),
  )
  const groups = groupChats(
    visible.filter((chat) => !chat.pinned),
    startOfToday,
  )
  const menuChat = chats.find((chat) => chat.id === menu?.id) ?? null

  function openMenu(id: string, anchor: HTMLButtonElement) {
    const rect = anchor.getBoundingClientRect()
    const height = 168
    const top =
      rect.bottom + 4 + height > window.innerHeight
        ? Math.max(8, rect.top - height - 4)
        : rect.bottom + 4
    setMenu({ id, top, left: Math.max(8, rect.right - 144) })
  }

  function rows(items: StoredChat[]) {
    return items.map((chat) => (
      <ThreadRow
        key={chat.id}
        chat={chat}
        preview={previewFrom(chat.messages)}
        active={chat.id === activeId}
        menuOpen={menu?.id === chat.id}
        renaming={renaming === chat.id}
        onSelect={() => {
          setMenu(null)
          onSelect(chat.id)
        }}
        onOpenMenu={(anchor) => openMenu(chat.id, anchor)}
        onRename={(title) => {
          onRename(chat.id, title)
          setRenaming(null)
        }}
        onRenameCancel={() => setRenaming(null)}
      />
    ))
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-1">
        <div className="flex h-8 items-center gap-2 px-2 text-sm font-medium">
          <MessageSquare className="size-4" />
          PatchAI
        </div>
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-sidebar-accent"
        >
          <Plus className="size-4" />
          New Thread
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute top-2 left-2 size-4 text-muted-foreground" />
          <SidebarInput
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search threads"
            aria-label="Search threads"
            className="pl-8"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2">
          {visible.length === 0 && ready ? (
            <p className="px-2.5 py-1 text-sm text-muted-foreground">
              No threads found.
            </p>
          ) : (
            <>
              {pinned.length > 0 ? (
                <div>
                  <p className={`${mono} px-2 pb-1 text-muted-foreground`}>pinned</p>
                  {rows(pinned)}
                </div>
              ) : null}
              {groups.map((group) => (
                <div key={group.label ?? "threads"}>
                  {group.label ? (
                    <p className="px-2.5 py-1 text-xs text-muted-foreground">
                      {group.label}
                    </p>
                  ) : null}
                  {rows(group.chats)}
                </div>
              ))}
            </>
          )}
          {archived.length > 0 ? (
            <div className="mt-2">
              <p className="px-2.5 py-1 text-xs text-muted-foreground">Archived</p>
              {rows(archived)}
            </div>
          ) : null}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <a
          href={SOURCE}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 items-center gap-2 rounded-md px-2 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <PanelLeft className="size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm leading-tight">GitHub</span>
            <span className="block text-xs leading-tight text-muted-foreground">
              View source
            </span>
          </span>
        </a>
        <ThemeButton />
      </SidebarFooter>
      <SidebarRail />
      {menu && menuChat
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenu(null)}
              />
              <div
                role="menu"
                className="fixed z-50 w-36 rounded-xl border bg-popover p-1.5 text-sm text-popover-foreground shadow-md"
                style={{ top: menu.top, left: menu.left }}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-accent"
                  onClick={() => {
                    onPin(menuChat.id)
                    setMenu(null)
                  }}
                >
                  <Pin className="size-3.5" />
                  {menuChat.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-accent"
                  onClick={() => {
                    setRenaming(menuChat.id)
                    setMenu(null)
                  }}
                >
                  <Pencil className="size-3.5" /> Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-accent"
                  onClick={() => {
                    onArchive(menuChat.id)
                    setMenu(null)
                  }}
                >
                  <Archive className="size-3.5" />
                  {menuChat.archived ? "Unarchive" : "Archive"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    onDelete(menuChat.id)
                    setMenu(null)
                  }}
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            </>,
            document.body,
          )
        : null}
    </Sidebar>
  )
}
