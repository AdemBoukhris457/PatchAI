"use client"

import { useAuiEvent } from "@assistant-ui/react"
import { toast } from "sonner"

const TITLE = "This file type is not supported."
const DETAIL = "Images, PDFs, and PowerPoint files can be attached."

function onUnsupportedFile({
  reason,
  message,
}: {
  reason: string
  message: string
}) {
  if (reason !== "adapter-error" && reason !== "not-accepted") return
  const name =
    reason === "adapter-error" && message && !message.includes("not accepted")
      ? message
      : ""
  toast.warning(TITLE, {
    description: name ? `${name}. ${DETAIL}` : DETAIL,
  })
}

export function UnsupportedFileNotice() {
  useAuiEvent("composer.attachmentAddError", onUnsupportedFile)
  return null
}
