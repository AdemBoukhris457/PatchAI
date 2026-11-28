"use client"

import { useSyncExternalStore } from "react"

const RESEARCH_KEY = "patchai.research"
const DEPTH_KEY = "patchai.research-depth"
const listeners = new Set<() => void>()

export const RESEARCH_DEPTHS = [
  { id: "standard", name: "Standard", detail: "Up to 36 searches" },
  { id: "deep", name: "Deep", detail: "Up to 120 searches" },
  { id: "max", name: "Max", detail: "Up to 300 searches" },
] as const

export type ResearchDepthId = (typeof RESEARCH_DEPTHS)[number]["id"]

export function researchDepth(id: ResearchDepthId) {
  return RESEARCH_DEPTHS.find((item) => item.id === id) ?? RESEARCH_DEPTHS[0]
}

function readOn() {
  return window.localStorage.getItem(RESEARCH_KEY) === "on"
}

function readDepth(): ResearchDepthId {
  const saved = window.localStorage.getItem(DEPTH_KEY)
  return RESEARCH_DEPTHS.find((item) => item.id === saved)?.id ?? "standard"
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

function notify() {
  for (const listener of listeners) listener()
}

export function setResearchMode(on: boolean) {
  if (on) window.localStorage.setItem(RESEARCH_KEY, "on")
  else window.localStorage.removeItem(RESEARCH_KEY)
  notify()
}

export function setResearchDepth(depth: ResearchDepthId) {
  window.localStorage.setItem(DEPTH_KEY, depth)
  notify()
}

export function useResearchMode() {
  return useSyncExternalStore(subscribe, readOn, () => false)
}

export function useResearchDepth() {
  return useSyncExternalStore(subscribe, readDepth, () => "standard" as const)
}
