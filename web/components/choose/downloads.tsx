"use client"

import { Download, FileText, MoreHorizontal } from "lucide-react"
import { useState } from "react"

import { File } from "@/components/file"
import { PdfCard } from "@/components/pdf-card"

const FILE_NAME = "solar-wind-brief.pdf"

const SAMPLE_PDF = btoa(
  "%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF",
)

function saveSample() {
  const link = document.createElement("a")
  link.href = `data:application/pdf;base64,${SAMPLE_PDF}`
  link.download = FILE_NAME
  link.click()
}

export function AssistantFileRow() {
  return (
    <File
      type="file"
      filename={FILE_NAME}
      mimeType="application/pdf"
      data={SAMPLE_PDF}
      status={{ type: "complete" }}
    />
  )
}

export function AssistantArtifactCard() {
  return (
    <div className="flex flex-col items-start gap-3">
      <PdfCard title="Solar and wind, 2025" meta="PDF · 2 pages" generating words={186} />
      <PdfCard
        title="Solar and wind, 2025"
        meta="PDF · 2 pages"
        href={`data:application/pdf;base64,${SAMPLE_PDF}`}
        filename={FILE_NAME}
      />
    </div>
  )
}

export function NotraFileChip() {
  return (
    <button
      type="button"
      onClick={saveSample}
      className="flex max-w-xs items-center gap-2 rounded-xl bg-white px-2 py-1.5 text-sm outline-none hover:bg-neutral-50 focus-visible:ring-2"
    >
      <FileText className="size-4 shrink-0 text-neutral-500" />
      <span className="min-w-0 flex-1 truncate">{FILE_NAME}</span>
    </button>
  )
}

export function NotraDownloadAction() {
  const [open, setOpen] = useState(false)
  return (
    <div className="max-w-sm text-sm">
      <p>The brief is ready. Solar added more capacity. Wind produced more electricity.</p>
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={saveSample}
          aria-label="Download"
          title="Download"
          className="inline-flex size-8 items-center justify-center rounded-full text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2"
        >
          <Download className="size-4" />
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="More"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="inline-flex size-8 items-center justify-center rounded-full text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {open ? (
            <div className="absolute top-9 left-0 z-10 w-36 rounded-xl border border-neutral-200 bg-white p-1 shadow-md">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  saveSample()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none hover:bg-neutral-100 focus-visible:ring-2"
              >
                <Download className="size-3.5" />
                Download
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
