"use client"

import {
  Archive,
  ChevronsUpDown,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"

const TODAY = [
  { id: "hello", title: "Say hello in one short sentence." },
  { id: "time", title: "What time is it right now?" },
]

const YESTERDAY = [
  { id: "prices", title: "Compare the latest prices of Apple and Nvidia" },
]

function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[26rem] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
      {children}
      <div className="hidden min-w-0 flex-1 sm:block" />
    </div>
  )
}

export function NotraInsetSidebar() {
  const [width, setWidth] = useState(232)
  const [active, setActive] = useState("hello")
  const [openGroup, setOpenGroup] = useState<"today" | "yesterday">("today")
  const [menu, setMenu] = useState(false)

  function drag(event: ReactPointerEvent<HTMLButtonElement>) {
    const startX = event.clientX
    const startW = width
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    const move = (next: PointerEvent) => {
      setWidth(Math.min(300, Math.max(200, startW + next.clientX - startX)))
    }
    const stop = () => {
      target.removeEventListener("pointermove", move)
      target.removeEventListener("pointerup", stop)
    }
    target.addEventListener("pointermove", move)
    target.addEventListener("pointerup", stop)
  }

  const rows = openGroup === "today" ? TODAY : YESTERDAY

  return (
    <Stage>
      <div className="relative m-2 flex shrink-0" style={{ width }}>
        <aside className="flex min-w-0 flex-1 flex-col rounded-xl bg-white text-sm shadow-sm ring-1 ring-neutral-200">
          <div className="relative p-2">
            <button
              type="button"
              aria-expanded={menu}
              onClick={() => setMenu((current) => !current)}
              className="flex h-12 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-neutral-100"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-semibold">
                P
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">PatchAI</span>
                <span className="block truncate text-xs text-neutral-500">Local</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-neutral-400" />
            </button>
            {menu ? (
              <div className="absolute top-14 right-2 left-2 z-10 rounded-xl border border-neutral-200 bg-white p-1 shadow-md">
                <p className="px-2 py-1 text-xs text-neutral-500">Projects</p>
                <p className="rounded-md bg-neutral-100 px-2 py-1.5">PatchAI</p>
              </div>
            ) : null}
          </div>
          <div className="px-2">
            <button
              type="button"
              className="flex h-9 w-full items-center gap-2 rounded-lg border px-2 text-neutral-500"
            >
              <Search className="size-4" />
              <span className="min-w-0 flex-1 truncate text-left">Search…</span>
              <kbd className="rounded border bg-neutral-50 px-1 text-[10px]">⌘K</kbd>
            </button>
          </div>
          <div className="mt-2 min-h-0 flex-1 overflow-auto px-2">
            {(
              [
                ["today", "Today"],
                ["yesterday", "Yesterday"],
              ] as const
            ).map(([id, label]) => (
              <div key={id}>
                <button
                  type="button"
                  onClick={() => setOpenGroup(id)}
                  className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left ${openGroup === id ? "font-medium" : "text-neutral-600"}`}
                >
                  <MessageSquare className="size-4 shrink-0" />
                  {label}
                </button>
                {openGroup === id ? (
                  <div className="ml-4 border-l pl-2">
                    {rows.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        aria-current={active === row.id ? "page" : undefined}
                        onClick={() => setActive(row.id)}
                        className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-[13px] ${active === row.id ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"}`}
                      >
                        {row.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="border-t p-2">
            <div className="flex h-12 items-center gap-2 rounded-lg px-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-medium">
                Y
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm">You</span>
                <span className="block truncate text-xs text-neutral-500">This browser</span>
              </span>
            </div>
          </div>
        </aside>
        <button
          type="button"
          aria-label="Resize sidebar"
          onPointerDown={drag}
          onDoubleClick={() => setWidth(232)}
          className="absolute inset-y-2 -right-1 w-2 cursor-col-resize"
        />
      </div>
    </Stage>
  )
}

export function NotraRailSidebar() {
  const [open, setOpen] = useState(true)

  return (
    <Stage>
      <aside className="relative flex w-12 shrink-0 flex-col items-center gap-1 bg-white py-2 text-neutral-700">
        <span className="flex size-8 items-center justify-center rounded-lg bg-neutral-100 text-xs font-semibold">
          P
        </span>
        <button type="button" aria-label="Search" className="flex size-8 items-center justify-center rounded-md hover:bg-neutral-100">
          <Search className="size-4" />
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-label="Today"
          onClick={() => setOpen((current) => !current)}
          className="flex size-8 items-center justify-center rounded-md bg-neutral-100"
        >
          <MessageSquare className="size-4" />
        </button>
        {open ? (
          <div className="absolute top-16 left-12 z-10 w-52 rounded-xl border border-neutral-200 bg-white p-1 text-sm shadow-md">
            {TODAY.map((row) => (
              <p key={row.id} className="truncate rounded-md px-2 py-1.5 first:bg-neutral-100">
                {row.title}
              </p>
            ))}
          </div>
        ) : null}
        <span className="mt-auto flex size-8 items-center justify-center rounded-full bg-neutral-200 text-xs">
          Y
        </span>
      </aside>
    </Stage>
  )
}

export function AssistantThreadSidebar() {
  const [active, setActive] = useState("hello")
  const [menu, setMenu] = useState<string | null>("hello")
  const [renaming, setRenaming] = useState<string | null>(null)
  const [titles, setTitles] = useState<Record<string, string>>({})

  function titleOf(id: string, fallback: string) {
    return titles[id] ?? fallback
  }

  function rows(items: typeof TODAY) {
    return items.map((row) => {
      const title = titleOf(row.id, row.title)
      const selected = active === row.id
      return (
        <div
          key={row.id}
          className={`group relative flex h-8 items-center rounded-md ${selected ? "bg-neutral-100" : "hover:bg-neutral-100"}`}
        >
          {renaming === row.id ? (
            <input
              autoFocus
              aria-label="Rename"
              defaultValue={title}
              className="h-full w-full rounded-md bg-transparent px-2.5 text-sm outline-none"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const next = event.currentTarget.value.trim()
                  if (next) setTitles((current) => ({ ...current, [row.id]: next }))
                  setRenaming(null)
                }
                if (event.key === "Escape") setRenaming(null)
              }}
              onBlur={(event) => {
                const next = event.currentTarget.value.trim()
                if (next) setTitles((current) => ({ ...current, [row.id]: next }))
                setRenaming(null)
              }}
            />
          ) : (
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={() => {
                setActive(row.id)
                setMenu(null)
              }}
              className="h-full min-w-0 flex-1 truncate px-2.5 text-left text-sm"
            >
              {title}
            </button>
          )}
          <button
            type="button"
            aria-label={`More options for ${title}`}
            aria-expanded={menu === row.id}
            onClick={() => setMenu((current) => (current === row.id ? null : row.id))}
            className="absolute right-1 flex size-6 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 aria-expanded:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menu === row.id ? (
            <div className="absolute top-8 right-0 z-10 w-36 rounded-xl border bg-white p-1.5 text-sm shadow-md">
              <button
                type="button"
                onClick={() => {
                  setRenaming(row.id)
                  setMenu(null)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-neutral-100"
              >
                <Pencil className="size-3.5" /> Rename
              </button>
              <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-neutral-100">
                <Archive className="size-3.5" /> Archive
              </button>
              <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-red-600 hover:bg-red-50">
                <Trash2 className="size-3.5" /> Delete
              </button>
            </div>
          ) : null}
        </div>
      )
    })
  }

  return (
    <Stage>
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white text-sm">
        <div className="flex h-12 items-center gap-2 px-3 font-medium">
          <MessageSquare className="size-4" />
          PatchAI
        </div>
        <div className="px-2">
          <button type="button" className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-neutral-100">
            <Plus className="size-4" /> New Thread
          </button>
          <div className="relative mt-1">
            <Search className="absolute top-2 left-2 size-4 text-neutral-400" />
            <input
              aria-label="Search threads"
              placeholder="Search threads"
              className="h-8 w-full rounded-md border bg-transparent pr-2 pl-8 text-sm outline-none"
            />
          </div>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-auto px-2">
          <p className="px-2.5 py-1 text-xs text-neutral-500">Today</p>
          {rows(TODAY)}
          <p className="mt-2 px-2.5 py-1 text-xs text-neutral-500">Yesterday</p>
          {rows(YESTERDAY)}
        </div>
        <div className="border-t p-2">
          <div className="flex h-12 items-center gap-2 rounded-md px-2">
            <PanelLeft className="size-4" />
            <span>
              <span className="block text-sm leading-tight">GitHub</span>
              <span className="block text-xs leading-tight text-neutral-500">View source</span>
            </span>
          </div>
        </div>
      </aside>
    </Stage>
  )
}

export function AssistantRailSidebar() {
  const items = [
    { id: "new", label: "New Thread", icon: Plus },
    { id: "search", label: "Search threads", icon: Search },
    { id: "hello", label: "Say hello in one short sentence.", icon: MessageSquare },
  ]
  const [tip, setTip] = useState(items[2].id)
  const shown = items.find((item) => item.id === tip) ?? items[0]
  const index = items.findIndex((item) => item.id === shown.id)

  return (
    <Stage>
      <aside className="relative flex w-12 shrink-0 flex-col items-center gap-1 border-r border-neutral-200 bg-white py-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              onMouseEnter={() => setTip(item.id)}
              onFocus={() => setTip(item.id)}
              className={`flex size-8 items-center justify-center rounded-md hover:bg-neutral-100 ${tip === item.id ? "bg-neutral-100" : ""}`}
            >
              <Icon className="size-4" />
            </button>
          )
        })}
        <p
          className="absolute left-14 z-10 max-w-52 rounded-md bg-neutral-950 px-2 py-1 text-xs text-white"
          style={{ top: 8 + index * 36 }}
        >
          {shown.label}
        </p>
      </aside>
    </Stage>
  )
}
