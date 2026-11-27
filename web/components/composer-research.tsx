"use client"

import { useAui, type LanguageModelConfig } from "@assistant-ui/react"
import { Telescope } from "lucide-react"
import { useEffect } from "react"

import { setResearchMode, useResearchMode } from "@/lib/research-mode"

export function ComposerResearchToggle() {
  const aui = useAui()
  const on = useResearchMode()

  useEffect(() => {
    if (!on) return
    const config: LanguageModelConfig & { research: boolean } = { research: true }
    return aui.modelContext.register({ getModelContext: () => ({ config }) })
  }, [aui, on])

  return (
    <button
      type="button"
      aria-pressed={on}
      title={on ? "Research is on: workers search the web in parallel" : "Research the web in depth"}
      onClick={() => setResearchMode(!on)}
      className={`inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs whitespace-nowrap outline-none focus-visible:ring-2 ${
        on
          ? "bg-sky-500/10 text-sky-600 hover:bg-sky-500/15 dark:text-sky-400"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      <Telescope className="size-3.5" />
      Research
    </button>
  )
}
