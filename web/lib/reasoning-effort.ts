export const REASONING_EFFORTS = [
  { id: "low", name: "Low", detail: "Faster" },
  { id: "medium", name: "Medium", detail: "Balanced" },
  { id: "high", name: "High", detail: "Deeper" },
  { id: "xhigh", name: "Extra high", detail: "Harder work" },
  { id: "max", name: "Max", detail: "Longest think" },
] as const

export const DEFAULT_REASONING_EFFORT = "medium"

export type ReasoningEffortId = (typeof REASONING_EFFORTS)[number]["id"]

export function reasoningEffort(id: string) {
  return REASONING_EFFORTS.find((item) => item.id === id) ?? REASONING_EFFORTS[1]
}
