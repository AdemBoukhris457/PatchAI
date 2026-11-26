"use client"

import { Download, Play, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { ghostButton } from "@/components/surfaces"
import { speakerNotes } from "@/lib/deck-notes"
import { cn } from "@/lib/utils"

export function DeckCanvas({
  document,
  onClose,
}: {
  document: { filename: string; title: string; revision: number }
  onClose: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const slides = useRef<Array<HTMLElement | null>>([])
  const jumping = useRef(false)
  const stage = useRef<HTMLDivElement>(null)
  const enteredFullscreen = useRef(false)
  const wasPresenting = useRef(false)
  const [pages, setPages] = useState<string[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [failed, setFailed] = useState(false)
  const [page, setPage] = useState(1)
  const [presenting, setPresenting] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const fileUrl = `/api/files/${encodeURIComponent(document.filename)}`
  const slideCount = pages.length

  useEffect(() => {
    let active = true
    setPages([])
    setNotes([])
    setFailed(false)
    setPage(1)
    setPresenting(false)

    void (async () => {
      try {
        const response = await fetch(fileUrl, { cache: "no-store" })
        if (!response.ok) throw new Error("missing")
        const bytes = new Uint8Array(await response.arrayBuffer())
        const [{ getSlides, loadPresentation }, { renderSlideToSvg }] = await Promise.all([
          import("@office-kit/pptx"),
          import("@office-kit/pptx-preview"),
        ])
        const presentation = await loadPresentation(bytes)
        const painted = getSlides(presentation).map((slide) =>
          renderSlideToSvg(presentation, slide),
        )
        const spoken = await speakerNotes(bytes).catch(() => painted.map(() => ""))
        if (active) {
          setPages(painted)
          setNotes(spoken)
        }
      } catch {
        if (active) setFailed(true)
      }
    })()

    return () => {
      active = false
    }
  }, [document.filename, document.revision, fileUrl])

  useEffect(() => {
    const root = scroller.current
    if (!root || slideCount === 0) return
    const sync = () => {
      if (jumping.current) return
      const next = slideNearTop(root, slides.current)
      if (next) setPage((current) => (current === next ? current : next))
    }
    root.addEventListener("scroll", sync, { passive: true })
    return () => root.removeEventListener("scroll", sync)
  }, [slideCount])

  const show = useCallback((next: number) => {
    const root = scroller.current
    const target = slides.current[next - 1]
    setPage(next)
    if (!root || !target) return
    jumping.current = true
    const top =
      target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop
    const finish = () => {
      jumping.current = false
      root.removeEventListener("scrollend", finish)
    }
    root.addEventListener("scrollend", finish)
    window.setTimeout(finish, 800)
    root.scrollTo({ top, behavior: "smooth" })
  }, [])

  const pageRef = useRef(page)
  const presentingRef = useRef(presenting)
  pageRef.current = page
  presentingRef.current = presenting

  const stopPresenting = useCallback(() => {
    setPresenting(false)
    if (window.document.fullscreenElement) void window.document.exitFullscreen()
  }, [])

  const move = useCallback(
    (step: number) => {
      const count = slides.current.filter(Boolean).length
      if (count === 0) return
      const next = Math.min(count, Math.max(1, pageRef.current + step))
      if (presentingRef.current) setPage(next)
      else show(next)
    },
    [show],
  )

  useEffect(() => {
    function typing(event: KeyboardEvent) {
      const target = event.target
      return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      )
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (presentingRef.current) stopPresenting()
        else if (!typing(event)) onClose()
        return
      }
      if (typing(event)) return
      if (!presentingRef.current) {
        const panel = scroller.current?.closest("aside")
        const active = window.document.activeElement
        if (panel && active instanceof Node && active !== window.document.body && !panel.contains(active)) return
      }
      if (event.key === "ArrowRight" || event.key === "PageDown" || (presentingRef.current && event.key === " ")) {
        event.preventDefault()
        move(1)
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault()
        move(-1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [move, onClose, stopPresenting])

  useEffect(() => {
    if (wasPresenting.current && !presenting) show(page)
    wasPresenting.current = presenting
  }, [page, presenting, show])

  useEffect(() => {
    if (!presenting) {
      enteredFullscreen.current = false
      return
    }
    const node = stage.current
    if (!node || window.document.fullscreenElement === node) return
    void node.requestFullscreen?.().then(
      () => {
        enteredFullscreen.current = true
      },
      () => undefined,
    )
  }, [presenting])

  useEffect(() => {
    function onFullscreen() {
      if (enteredFullscreen.current && !window.document.fullscreenElement) {
        enteredFullscreen.current = false
        setPresenting(false)
      }
    }
    window.document.addEventListener("fullscreenchange", onFullscreen)
    return () => window.document.removeEventListener("fullscreenchange", onFullscreen)
  }, [])

  const spoken = notes[page - 1] ?? ""
  const hasNotes = notes.some((note) => note.length > 0)

  return (
    <aside className="flex h-full min-h-0 w-[min(40rem,46%)] shrink-0 flex-col border-l bg-muted max-lg:absolute max-lg:inset-0 max-lg:z-30 max-lg:w-full max-lg:border-l-0">
      <header className="flex items-center gap-2 border-b bg-background px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{document.title}</p>
          <p className="text-xs text-muted-foreground">
            {slideCount === 1
              ? "PowerPoint · 1 slide"
              : slideCount
                ? `PowerPoint · ${slideCount} slides`
                : "PowerPoint"}
          </p>
        </div>
        {slideCount > 0 ? (
          <>
            <label className="sr-only" htmlFor="deck-slide">
              Slide
            </label>
            <select
              id="deck-slide"
              value={String(page)}
              onChange={(event) => show(Number(event.target.value))}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
            >
              {pages.map((_, index) => (
                <option key={index + 1} value={String(index + 1)}>
                  Slide {index + 1}
                </option>
              ))}
            </select>
          </>
        ) : null}
        {slideCount > 0 ? (
          <button
            type="button"
            aria-label="Present"
            onClick={() => setPresenting(true)}
            className={cn(ghostButton, "size-7")}
          >
            <Play className="size-4" />
          </button>
        ) : null}
        <a
          href={fileUrl}
          download={document.filename}
          aria-label="Download"
          className={cn(ghostButton, "size-7")}
        >
          <Download className="size-4" />
        </a>
        <button
          type="button"
          aria-label="Close the deck"
          onClick={onClose}
          className={cn(ghostButton, "size-7")}
        >
          <X className="size-4" />
        </button>
      </header>
      {slideCount > 1 ? (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b bg-background px-3 py-2">
          {pages.map((_, index) => (
            <button
              key={index + 1}
              type="button"
              aria-label={`Slide ${index + 1}`}
              aria-current={page === index + 1 ? "true" : undefined}
              onClick={() => show(index + 1)}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs",
                page === index + 1
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {index + 1}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {failed ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">This deck could not be opened.</p>
        ) : slideCount === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">Opening the deck</p>
        ) : (
          pages.map((svg, index) => (
            <article
              key={index + 1}
              ref={(element) => {
                slides.current[index] = element
              }}
              className="mx-auto w-full max-w-[760px]"
            >
              <div
                className="overflow-hidden bg-white shadow-sm [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <p className="pt-2 text-center text-[10px] text-muted-foreground">
                {index + 1} / {slideCount}
              </p>
            </article>
          ))
        )}
      </div>
      {hasNotes ? (
        <footer className="max-h-28 shrink-0 overflow-y-auto border-t bg-background px-4 py-3">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Notes</p>
          <p className="mt-1 text-sm leading-5">{spoken || "No notes for this slide."}</p>
        </footer>
      ) : null}
      {presenting && pages[page - 1] ? (
        <div ref={stage} className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white">
          <div className="flex h-12 shrink-0 items-center justify-between px-4 text-xs text-white/70">
            <span>
              {page} / {slideCount}
            </span>
            <span className="flex items-center gap-2">
              {spoken ? (
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 hover:bg-white/10 hover:text-white"
                  onClick={() => setShowNotes((value) => !value)}
                >
                  {showNotes ? "Hide notes" : "Show notes"}
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-lg px-2 py-1 hover:bg-white/10 hover:text-white"
                onClick={stopPresenting}
              >
                Exit
              </button>
            </span>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-8 pb-4">
            <div
              className="max-h-full w-full max-w-6xl [&_svg]:h-auto [&_svg]:max-h-[calc(100vh-9rem)] [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: pages[page - 1] }}
            />
          </div>
          {showNotes && spoken ? (
            <p className="max-h-28 shrink-0 overflow-y-auto px-10 pb-6 text-sm leading-5 text-white/80">{spoken}</p>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}

function slideNearTop(root: HTMLElement, slides: Array<HTMLElement | null>) {
  const origin = root.getBoundingClientRect().top
  let best = Number.POSITIVE_INFINITY
  let index = -1
  slides.forEach((element, item) => {
    if (!element) return
    const distance = Math.abs(element.getBoundingClientRect().top - origin)
    if (distance < best) {
      best = distance
      index = item
    }
  })
  return index >= 0 ? index + 1 : null
}
