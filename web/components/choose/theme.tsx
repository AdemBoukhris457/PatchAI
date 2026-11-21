"use client"

import { Moon, Sun } from "lucide-react"
import { useState, type ReactNode } from "react"

type Mode = "light" | "dark"

function SidebarFrame({
  children,
  rail = false,
}: {
  children: ReactNode
  rail?: boolean
}) {
  return (
    <div className="flex h-52 flex-col rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-950">
      <div className={rail ? "px-1.5 py-2" : "px-2 py-2"}>
        <div className="truncate rounded-md px-2 py-1.5 text-neutral-500">
          {rail ? <Sun className="mx-auto size-4" /> : "New chat"}
        </div>
        <div className="truncate rounded-md bg-white px-2 py-1.5">
          {rail ? <span className="mx-auto block size-4 rounded-sm bg-neutral-200" /> : "Hello"}
        </div>
      </div>
      <div className={`mt-auto border-t bg-white ${rail ? "p-1.5" : "p-2"}`}>
        {children}
      </div>
    </div>
  )
}

export function NotraThemeTabs() {
  const [mode, setMode] = useState<Mode>("dark")

  return (
    <SidebarFrame>
      <div
        role="tablist"
        aria-label="Theme"
        className="bg-muted text-muted-foreground relative inline-flex h-8 w-full items-center gap-0.5 rounded-lg p-0.5"
      >
        {(
          [
            ["light", "Light", Sun],
            ["dark", "Dark", Moon],
          ] as const
        ).map(([value, label, Icon]) => {
          const active = mode === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(value)}
              className={`relative z-1 inline-flex h-full flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium ${active ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-muted-foreground/75 hover:text-muted-foreground"}`}
            >
              <span
                className={`flex items-center overflow-hidden transition-all duration-200 ${active ? "w-4 opacity-100" : "w-0 opacity-0"}`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              {label}
            </button>
          )
        })}
      </div>
    </SidebarFrame>
  )
}

export function NotraThemeMenu() {
  const [mode, setMode] = useState<Mode>("dark")
  const [open, setOpen] = useState(true)

  return (
    <SidebarFrame>
      <div className="relative">
        {open ? (
          <div
            role="menu"
            aria-label="Appearance"
            className="absolute bottom-full left-0 z-10 mb-2 w-full rounded-[0.875rem] border border-neutral-200 bg-linear-to-b from-white to-neutral-100 p-1 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.14)] [corner-shape:squircle]"
          >
            <p className="px-2 py-1 text-xs text-neutral-500">Appearance</p>
            {(
              [
                ["light", "Light"],
                ["dark", "Dark"],
              ] as const
            ).map(([value, label]) => {
              const selected = mode === value
              return (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => setMode(value)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-950/5"
                >
                  <span
                    className={`flex size-3.5 items-center justify-center rounded-full border ${selected ? "border-neutral-950" : "border-neutral-300"}`}
                  >
                    {selected ? (
                      <span className="size-1.5 rounded-full bg-neutral-950" />
                    ) : null}
                  </span>
                  {label}
                </button>
              )
            })}
          </div>
        ) : null}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-neutral-100"
        >
          {mode === "dark" ? (
            <Moon className="size-4" aria-hidden="true" />
          ) : (
            <Sun className="size-4" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate">Appearance</span>
          <span className="text-xs text-neutral-500">
            {mode === "dark" ? "Dark" : "Light"}
          </span>
        </button>
      </div>
    </SidebarFrame>
  )
}

export function AssistantThemeFooter() {
  const [mode, setMode] = useState<Mode>("dark")

  return (
    <SidebarFrame>
      <button
        type="button"
        onClick={() => setMode((current) => (current === "dark" ? "light" : "dark"))}
        className="flex h-12 w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-neutral-100"
      >
        {mode === "dark" ? (
          <Moon className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <Sun className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span className="flex min-w-0 flex-col">
          <span className="truncate leading-tight">Appearance</span>
          <span className="truncate text-xs leading-tight text-neutral-500">
            {mode === "dark" ? "Dark" : "Light"}
          </span>
        </span>
      </button>
    </SidebarFrame>
  )
}

export function AssistantThemeRail() {
  const [mode, setMode] = useState<Mode>("dark")
  const label = mode === "dark" ? "Use light theme" : "Use dark theme"

  return (
    <SidebarFrame rail>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={label}
          onClick={() => setMode((current) => (current === "dark" ? "light" : "dark"))}
          className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-neutral-100"
        >
          {mode === "dark" ? (
            <Moon className="size-4" aria-hidden="true" />
          ) : (
            <Sun className="size-4" aria-hidden="true" />
          )}
        </button>
        <span className="rounded-md bg-neutral-950 px-2 py-1 text-xs text-white">
          {label}
        </span>
      </div>
    </SidebarFrame>
  )
}
