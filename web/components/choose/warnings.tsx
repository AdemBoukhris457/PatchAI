"use client"

import { AlertCircle, FileText, OctagonX, TriangleAlert, X } from "lucide-react"

const MESSAGE = "This file type is not supported."

function NotraToast({
  tone,
}: {
  tone: "error" | "warning"
}) {
  const warning = tone === "warning"
  const Icon = warning ? TriangleAlert : OctagonX
  return (
    <div className="flex w-full max-w-sm items-center gap-2.5 rounded-[0.875rem] border border-neutral-200 bg-linear-to-b from-white to-neutral-100 p-3 text-sm text-neutral-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.14)] [corner-shape:squircle]">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-lg [corner-shape:squircle] ${warning ? "bg-[oklch(0.57_0.113_55)]/12 text-[oklch(0.57_0.113_55)]" : "bg-red-600/12 text-red-600"}`}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium leading-snug">{MESSAGE}</span>
        <span className="block text-[0.8rem] leading-snug text-neutral-500">
          voice.mp3. Images, PDFs, and PowerPoint files can be attached.
        </span>
      </span>
    </div>
  )
}

export function NotraErrorToast() {
  return <NotraToast tone="error" />
}

export function NotraWarningToast() {
  return <NotraToast tone="warning" />
}

export function AssistantErrorToast() {
  return (
    <div className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm shadow-md">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
        <X className="size-3" aria-hidden="true" />
      </span>
      <span className="font-medium">{MESSAGE}</span>
    </div>
  )
}

export function AssistantErrorTile() {
  return (
    <div className="flex items-start gap-3">
      <div className="relative size-14 overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-red-600/60 ring-inset">
        <div className="flex size-full items-center justify-center">
          <FileText className="size-6 text-neutral-400" aria-hidden="true" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
          <AlertCircle className="size-4 text-red-600" aria-hidden="true" />
        </div>
      </div>
      <div className="rounded-md bg-neutral-950 px-2 py-1 text-xs text-white">
        <p>voice.mp3</p>
        <p>{MESSAGE}</p>
      </div>
    </div>
  )
}
