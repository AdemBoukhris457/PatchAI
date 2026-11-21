"use client"

import { Archive, MoreHorizontal, Pencil, Pin, Star, Trash2 } from "lucide-react"
import { useState, type ReactNode } from "react"

import { field, mono } from "@/components/surfaces"

const THREADS = [
  {
    id: "hello",
    title: "Say hello in one short sentence.",
    preview: "Hello!",
    group: "Today",
  },
  {
    id: "time",
    title: "What time is it right now?",
    preview: "It is 3:41 PM.",
    group: "Today",
  },
  {
    id: "prices",
    title: "Compare the latest prices of Apple and Nvidia",
    preview: "Both moved today.",
    group: "Yesterday",
  },
]

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[26rem] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
      <aside className="flex w-64 shrink-0 flex-col bg-white text-sm">{children}</aside>
      <div className="hidden min-w-0 flex-1 sm:block" />
    </div>
  )
}

export function AssistantPinnedList() {
  const [pinned, setPinned] = useState<string[]>(["hello"])
  const [active, setActive] = useState("hello")
  const [menu, setMenu] = useState<string | null>(null)

  const pinnedRows = THREADS.filter((thread) => pinned.includes(thread.id))
  const groups = ["Today", "Yesterday"].filter((group) =>
    THREADS.some((thread) => thread.group === group && !pinned.includes(thread.id)),
  )

  function row(thread: (typeof THREADS)[number]) {
    const selected = active === thread.id
    return (
      <div key={thread.id} className="group relative">
        <button
          type="button"
          aria-current={selected ? "true" : undefined}
          onClick={() => {
            setActive(thread.id)
            setMenu(null)
          }}
          className={`flex w-full flex-col gap-0.5 rounded-xl px-2 py-1 text-left ${selected ? "bg-foreground/[0.05]" : "hover:bg-foreground/[0.03]"}`}
        >
          <span className="flex items-center gap-1.5">
            {pinned.includes(thread.id) ? (
              <Pin className="size-2.5 shrink-0 text-muted-foreground" />
            ) : null}
            <span className="min-w-0 flex-1 truncate text-[13px]">{thread.title}</span>
          </span>
          <span className="truncate text-xs text-muted-foreground">{thread.preview}</span>
        </button>
        <button
          type="button"
          aria-label={`More options for ${thread.title}`}
          aria-expanded={menu === thread.id}
          onClick={() => setMenu((current) => (current === thread.id ? null : thread.id))}
          className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-neutral-100 aria-expanded:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {menu === thread.id ? (
          <div className="absolute top-8 right-0 z-10 w-36 rounded-xl border bg-white p-1.5 text-sm shadow-md">
            <button
              type="button"
              onClick={() => {
                setPinned((current) =>
                  current.includes(thread.id)
                    ? current.filter((id) => id !== thread.id)
                    : [thread.id, ...current],
                )
                setMenu(null)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-neutral-100"
            >
              <Pin className="size-3.5" />
              {pinned.includes(thread.id) ? "Unpin" : "Pin"}
            </button>
            <p className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-neutral-600">
              <Pencil className="size-3.5" /> Rename
            </p>
            <p className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-neutral-600">
              <Archive className="size-3.5" /> Archive
            </p>
            <p className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-red-600">
              <Trash2 className="size-3.5" /> Delete
            </p>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <Frame>
      <div className="p-3">
        <div className={`${field} flex items-center gap-2 rounded-xl px-2.5 py-1.5`}>
          <span className="text-[13px] text-muted-foreground">Search threads</span>
        </div>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {pinnedRows.length > 0 ? (
            <div>
              <p className={`${mono} px-2 pb-1 text-muted-foreground`}>pinned</p>
              {pinnedRows.map(row)}
            </div>
          ) : null}
          {groups.map((group) => (
            <div key={group}>
              <p className={`${mono} px-2 pb-1 text-muted-foreground`}>{group}</p>
              {THREADS.filter((thread) => thread.group === group && !pinned.includes(thread.id)).map(row)}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

export function NotraFavoriteGroup() {
  const [favorites, setFavorites] = useState<string[]>(["hello"])
  const [active, setActive] = useState("hello")

  function toggle(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [id, ...current],
    )
  }

  function rows(ids: string[]) {
    return THREADS.filter((thread) => ids.includes(thread.id)).map((thread) => {
      const favorite = favorites.includes(thread.id)
      return (
        <div key={thread.id} className="flex items-center gap-1 pr-1">
          <button
            type="button"
            aria-current={active === thread.id ? "page" : undefined}
            onClick={() => setActive(thread.id)}
            className={`h-8 min-w-0 flex-1 truncate rounded-md px-2 text-left text-[13px] ${active === thread.id ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"}`}
          >
            {thread.title}
          </button>
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? `Unfavorite ${thread.title}` : `Favorite ${thread.title}`}
            onClick={() => toggle(thread.id)}
            className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-neutral-100"
          >
            <Star className={`size-3.5 ${favorite ? "fill-current" : "text-neutral-400"}`} />
          </button>
        </div>
      )
    })
  }

  const favoriteIds = THREADS.filter((thread) => favorites.includes(thread.id)).map((thread) => thread.id)
  const rest = ["Today", "Yesterday"].map((group) => ({
    group,
    ids: THREADS.filter((thread) => thread.group === group && !favorites.includes(thread.id)).map(
      (thread) => thread.id,
    ),
  }))

  return (
    <Frame>
      <div className="px-2 py-2">
        {favoriteIds.length > 0 ? (
          <div>
            <div className="flex h-8 items-center gap-2 px-2 font-medium">
              <Star className="size-4 fill-current" />
              Favorites
            </div>
            <div className="ml-4 border-l pl-2">{rows(favoriteIds)}</div>
          </div>
        ) : null}
        {rest.map(({ group, ids }) =>
          ids.length === 0 ? null : (
            <div key={group}>
              <div className="flex h-8 items-center px-2 text-neutral-600">{group}</div>
              <div className="ml-4 border-l pl-2">{rows(ids)}</div>
            </div>
          ),
        )}
      </div>
    </Frame>
  )
}
