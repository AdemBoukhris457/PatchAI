export const CHAT_MODELS = [
  { id: "gpt-6.2-astra", name: "GPT-6.2 Astra", detail: "Hardest projects" },
  { id: "gpt-6.2-sol", name: "GPT-6.2 Sol", detail: "Everyday work" },
  { id: "gpt-6.1-terra", name: "GPT-6.1 Terra", detail: "Fast writing and vision" },
  { id: "gpt-6.1-sol", name: "GPT-6.1 Sol", detail: "Complex work, lower cost" },
  { id: "gpt-6-astra", name: "GPT-6 Astra", detail: "Previous Astra" },
  { id: "gpt-6-sol", name: "GPT-6 Sol", detail: "Previous Sol" },
  { id: "gpt-6-luna", name: "GPT-6 Luna", detail: "High-volume tasks" },
] as const

export const DEFAULT_CHAT_MODEL = "gpt-6-luna"

export type ChatModelId = (typeof CHAT_MODELS)[number]["id"]

export function chatModel(id: string) {
  return CHAT_MODELS.find((item) => item.id === id) ?? CHAT_MODELS[CHAT_MODELS.length - 1]
}
