"use client"

import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { PdfCard } from "@/components/pdf-card"

const PAGES = [
  {
    label: "Cover",
    kicker: "Mock report",
    title: "Juniper and Co.",
    body: "A short look at a fictional year. The figures below are invented so the pages can be turned.",
  },
  {
    label: "Results",
    kicker: "Year in review",
    title: "Revenue rose through the year",
    body: "Each quarter cleared the one before it. The gain was steady rather than a single spike, and the margin held.",
  },
  {
    label: "Mix",
    kicker: "Where it came from",
    title: "Stores still lead, wholesale grew",
    body: "Stores remain the larger share. Wholesale added the most new revenue, and online stayed a smaller third.",
  },
  {
    label: "Notes",
    kicker: "Read this first",
    title: "Nothing here is a real company",
    body: "Names, totals, and the mix are samples. They exist so this preview can scroll and jump between pages.",
  },
]

export function AssistantPdfCanvas() {
  const scroller = useRef<HTMLDivElement>(null)
  const pages = useRef<Array<HTMLElement | null>>([])
  const [open, setOpen] = useState(true)
  const [page, setPage] = useState(1)
  const [jumping, setJumping] = useState(false)

  useEffect(() => {
    const root = scroller.current
    if (!root || !open) return
    const seen = new Map<Element, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        if (jumping) return
        for (const entry of entries) {
          seen.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        let best = 0
        let index = 0
        pages.current.forEach((element, item) => {
          const ratio = element ? (seen.get(element) ?? 0) : 0
          if (ratio > best) {
            best = ratio
            index = item
          }
        })
        if (best > 0) setPage(index + 1)
      },
      { root, threshold: [0.35, 0.6, 0.85] },
    )
    for (const element of pages.current) {
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [open, jumping])

  function show(next: number) {
    setPage(next)
    setJumping(true)
    pages.current[next - 1]?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => setJumping(false), 450)
  }

  return (
    <div
      className="flex h-[32rem] overflow-hidden rounded-xl border bg-white"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false)
      }}
    >
      <div className="flex w-[38%] min-w-0 flex-col border-r bg-white p-3">
        <p className="text-xs text-neutral-400">PatchAI</p>
        <p className="mt-3 ml-auto max-w-[14rem] rounded-2xl bg-neutral-100 px-3 py-2 text-xs">
          Make a short report.
        </p>
        <div className="mt-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                setOpen(true)
              }
            }}
            className="w-fit cursor-pointer rounded-[20px] outline-none focus-visible:ring-2"
          >
            <PdfCard title="Juniper and Co." meta="PDF · 4 pages" />
          </div>
        </div>
        <div className="mt-auto rounded-2xl border px-3 py-2 text-xs text-neutral-400">
          Write a message
        </div>
      </div>
      {open ? (
        <section className="flex min-w-0 flex-1 flex-col bg-neutral-100">
          <header className="flex items-center gap-2 border-b bg-white px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Juniper and Co.</p>
              <p className="text-xs text-neutral-500">PDF · 4 pages</p>
            </div>
            <label className="sr-only" htmlFor="pdf-page">
              Page
            </label>
            <select
              id="pdf-page"
              value={String(page)}
              onChange={(event) => show(Number(event.target.value))}
              className="h-8 rounded-lg border bg-white px-2 text-xs outline-none focus-visible:ring-2"
            >
              {PAGES.map((item, index) => (
                <option key={item.label} value={String(index + 1)}>
                  {index + 1}. {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Close the document"
              onClick={() => setOpen(false)}
              className="inline-flex size-7 items-center justify-center rounded-md text-neutral-500 outline-none hover:bg-neutral-100 focus-visible:ring-2"
            >
              <X className="size-4" />
            </button>
          </header>
          <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {PAGES.map((item, index) => (
              <article
                key={item.label}
                ref={(element) => {
                  pages.current[index] = element
                }}
                className="mx-auto flex min-h-72 w-full max-w-sm flex-col rounded-sm bg-white px-6 py-5 shadow-sm"
              >
                <p className="text-[10px] tracking-wide text-neutral-400 uppercase">{item.kicker}</p>
                <h3 className="mt-2 text-base font-medium">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-700">{item.body}</p>
                <p className="mt-auto pt-8 text-center text-[10px] text-neutral-400">
                  {index + 1} / {PAGES.length}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
