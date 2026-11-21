"use client"

import { Download, X } from "lucide-react"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist"

import { ghostButton } from "@/components/surfaces"
import { cn } from "@/lib/utils"

export type OpenDocument = {
  filename: string
  title: string
  revision: number
}

type PdfPreviewApi = {
  document: OpenDocument | null
  open: (document: { filename: string; title: string }) => void
  close: () => void
}

const PdfPreviewContext = createContext<PdfPreviewApi | null>(null)

export function PdfPreviewProvider({ children }: { children: ReactNode }) {
  const [document, setDocument] = useState<OpenDocument | null>(null)
  const api = useMemo<PdfPreviewApi>(
    () => ({
      document,
      open(next) {
        setDocument((current) => ({
          filename: next.filename,
          title: next.title,
          revision: current?.filename === next.filename ? current.revision + 1 : 1,
        }))
      },
      close() {
        setDocument(null)
      },
    }),
    [document],
  )
  return <PdfPreviewContext.Provider value={api}>{children}</PdfPreviewContext.Provider>
}

export function usePdfPreview() {
  return useContext(PdfPreviewContext)
}

export function PdfPreviewPanel() {
  const preview = usePdfPreview()
  if (!preview?.document) return null
  return <PdfCanvas document={preview.document} onClose={preview.close} />
}

function PdfCanvas({ document, onClose }: { document: OpenDocument; onClose: () => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const pages = useRef<Array<HTMLElement | null>>([])
  const jumping = useRef(false)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  const [page, setPage] = useState(1)
  const [width, setWidth] = useState(0)
  const pageCount = pdf?.numPages ?? 0
  const fileUrl = `/api/files/${encodeURIComponent(document.filename)}`

  useEffect(() => {
    const handle: { proxy: PDFDocumentProxy | null; active: boolean } = {
      proxy: null,
      active: true,
    }
    let loading: { destroy: () => Promise<void> } | null = null
    setPdf(null)
    setFailed(false)
    setPage(1)

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = "/api/pdf-worker"
        const task = pdfjs.getDocument({
          url: fileUrl,
          disableRange: true,
          disableStream: true,
        })
        loading = task
        const loaded = await task.promise
        if (!handle.active) {
          await loaded.destroy()
          return
        }
        handle.proxy = loaded
        setPdf(loaded)
      } catch {
        if (handle.active) setFailed(true)
      }
    })()

    return () => {
      handle.active = false
      setPdf(null)
      if (handle.proxy) void handle.proxy.destroy()
      else void loading?.destroy()
    }
  }, [document.filename, document.revision, fileUrl])

  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const measure = () => {
      const next = Math.max(0, Math.floor(Math.min(root.clientWidth - 32, 760)))
      setWidth((current) => (current === next ? current : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [pdf])

  useEffect(() => {
    const root = scroller.current
    if (!root || pageCount === 0) return
    const sync = () => {
      if (jumping.current) return
      const next = pageNearTop(root, pages.current)
      if (next) setPage((current) => (current === next ? current : next))
    }
    root.addEventListener("scroll", sync, { passive: true })
    return () => root.removeEventListener("scroll", sync)
  }, [pageCount, pdf])

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
    const target = pages.current[next - 1]
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
            {pageCount === 1 ? "PDF · 1 page" : pageCount ? `PDF · ${pageCount} pages` : "PDF"}
          </p>
        </div>
        {pageCount > 0 ? (
          <>
            <label className="sr-only" htmlFor="pdf-page">
              Page
            </label>
            <select
              id="pdf-page"
              value={String(page)}
              onChange={(event) => show(Number(event.target.value))}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-foreground/20"
            >
              {Array.from({ length: pageCount }, (_, index) => (
                <option key={index + 1} value={String(index + 1)}>
                  Page {index + 1}
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
          aria-label="Close the document"
          onClick={onClose}
          className={cn(ghostButton, "size-7")}
        >
          <X className="size-4" />
        </button>
      </header>
      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {failed ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">
            This document could not be opened.
          </p>
        ) : pageCount === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">Opening the document</p>
        ) : (
          Array.from({ length: pageCount }, (_, index) => (
            <article
              key={index + 1}
              ref={(element) => {
                pages.current[index] = element
              }}
              className="mx-auto w-fit max-w-full"
            >
              <div className="overflow-hidden bg-white shadow-sm">
                {pdf && width > 0 ? (
                  <PdfPageView document={pdf} pageNumber={index + 1} width={width} />
                ) : (
                  <div className="h-96 w-[min(100%,40rem)]" />
                )}
              </div>
              <p className="pt-2 text-center text-[10px] text-muted-foreground">
                {index + 1} / {pageCount}
              </p>
            </article>
          ))
        )}
      </div>
    </aside>
  )
}

function pageNearTop(root: HTMLElement, pages: Array<HTMLElement | null>) {
  const origin = root.getBoundingClientRect().top
  let best = Number.POSITIVE_INFINITY
  let index = -1
  pages.forEach((element, item) => {
    if (!element) return
    const distance = Math.abs(element.getBoundingClientRect().top - origin)
    if (distance < best) {
      best = distance
      index = item
    }
  })
  return index >= 0 ? index + 1 : null
}

function PdfPageView({
  document,
  pageNumber,
  width,
}: {
  document: PDFDocumentProxy
  pageNumber: number
  width: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let task: RenderTask | null = null
    void (async () => {
      const page = await document.getPage(pageNumber)
      if (cancelled) return
      const unscaled = page.getViewport({ scale: 1 })
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: (width / unscaled.width) * pixelRatio })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${width}px`
      canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`
      task = page.render({ canvas, viewport })
      try {
        await task.promise
      } catch {
        // A newer size cancels the paint that was already on the canvas.
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [document, pageNumber, width])

  return <canvas ref={canvasRef} className="block max-w-full bg-white" />
}
