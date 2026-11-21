"use client"

import { Download, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { ghostButton } from "@/components/surfaces"
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
  const [pages, setPages] = useState<string[]>([])
  const [failed, setFailed] = useState(false)
  const [page, setPage] = useState(1)
  const fileUrl = `/api/files/${encodeURIComponent(document.filename)}`
  const slideCount = pages.length

  useEffect(() => {
    let active = true
    setPages([])
    setFailed(false)
    setPage(1)

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
        if (active) setPages(painted)
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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return
      }
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function show(next: number) {
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
  }

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
