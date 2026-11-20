"use client"

import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { memo } from "react"
import { Streamdown } from "streamdown"

import { normalizeMath } from "@/lib/math"

const plugins = { code, math }

const streamMotion = {
  animation: "blurIn" as const,
  duration: 250,
  easing: "ease-out",
}

export const AssistantReply = memo(function AssistantReply({
  text,
  streaming,
}: {
  text: string
  streaming: boolean
}) {
  return (
    <Streamdown
      className="text-base leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      plugins={plugins}
      animated={streaming ? streamMotion : false}
      isAnimating={streaming}
    >
      {normalizeMath(text)}
    </Streamdown>
  )
})
