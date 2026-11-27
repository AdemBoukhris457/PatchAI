"use client"

import { useSyncExternalStore } from "react"

const RESEARCH_KEY = "patchai.research"
const listeners = new Set<() => void>()

function read() {
  return window.localStorage.getItem(RESEARCH_KEY) === "on"
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

export function setResearchMode(on: boolean) {
  if (on) window.localStorage.setItem(RESEARCH_KEY, "on")
  else window.localStorage.removeItem(RESEARCH_KEY)
  for (const listener of listeners) listener()
}

export function useResearchMode() {
  return useSyncExternalStore(subscribe, read, () => false)
}
