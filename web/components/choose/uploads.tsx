"use client"

import { FileText, Loader2, Plus, X } from "lucide-react"
import { useEffect, useRef, useState, type DragEvent, type RefObject } from "react"

import { AssistantUploaded } from "./file-looks"

type StagedFile = {
  id: string
  name: string
  type: string
  size: number
  url: string
  status: "uploading" | "ready"
}

function useUploads() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<StagedFile[]>([])
  const filesRef = useRef(files)
  filesRef.current = files

  useEffect(() => {
    return () => {
      for (const file of filesRef.current) URL.revokeObjectURL(file.url)
    }
  }, [])

  function add(list: FileList | null) {
    if (!list || list.length === 0) return
    const incoming = Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      url: URL.createObjectURL(file),
      status: "uploading" as const,
    }))
    setFiles((current) => [...current, ...incoming])
    window.setTimeout(() => {
      const ids = new Set(incoming.map((file) => file.id))
      setFiles((current) =>
        current.map((file) =>
          ids.has(file.id) ? { ...file, status: "ready" } : file,
        ),
      )
    }, 700)
  }

  function remove(id: string) {
    setFiles((current) => {
      const target = current.find((file) => file.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return current.filter((file) => file.id !== id)
    })
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    add(event.dataTransfer.files)
  }

  return {
    inputRef,
    dragging,
    setDragging,
    files,
    add,
    remove,
    onDrop,
    open: () => inputRef.current?.click(),
  }
}

function Picker({
  inputRef,
  onPick,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  onPick: (files: FileList | null) => void
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      multiple
      className="sr-only"
      onChange={(event) => {
        onPick(event.target.files)
        event.currentTarget.value = ""
      }}
    />
  )
}

export function NotraFileUpload() {
  const uploads = useUploads()
  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault()
        uploads.setDragging(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        uploads.setDragging(true)
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        uploads.setDragging(false)
      }}
      onDrop={uploads.onDrop}
      className={`rounded-2xl bg-neutral-200/80 p-1.5 ${uploads.dragging ? "ring-2 ring-neutral-950" : ""}`}
    >
      <Picker inputRef={uploads.inputRef} onPick={uploads.add} />
      {uploads.files.length > 0 ? (
        <div className="mb-1 flex flex-col gap-1">
          {uploads.files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 rounded-xl bg-white px-2 py-1.5 text-sm"
            >
              {file.type.startsWith("image/") ? (
                <img
                  src={file.url}
                  alt=""
                  className="size-8 rounded-md object-cover"
                />
              ) : (
                <FileText className="size-4 shrink-0 text-neutral-500" />
              )}
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              {file.status === "uploading" ? (
                <Loader2 className="size-4 animate-spin text-neutral-400" />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => uploads.remove(file.id)}
                    className="rounded-full px-2 py-1 text-xs outline-none hover:bg-neutral-100 focus-visible:ring-2"
                  >
                    Send now
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => uploads.remove(file.id)}
                    className="inline-flex size-6 items-center justify-center rounded-full outline-none hover:bg-neutral-100 focus-visible:ring-2"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
      <div className="rounded-xl bg-white px-3 py-2">
        <p className="text-sm text-neutral-400">Send a message...</p>
        <div className="mt-2 flex items-center">
          <button
            type="button"
            onClick={uploads.open}
            className="inline-flex size-8 items-center justify-center rounded-full outline-none hover:bg-neutral-100 focus-visible:ring-2"
            aria-label="Attach files"
          >
            <Plus className="size-4" />
          </button>
          <span className="ml-auto text-xs text-neutral-400">
            {uploads.dragging ? "Drop to attach" : "Or drop a file"}
          </span>
        </div>
      </div>
    </div>
  )
}

export function AssistantFileUpload() {
  const uploads = useUploads()
  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault()
        uploads.setDragging(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        uploads.setDragging(true)
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        uploads.setDragging(false)
      }}
      onDrop={uploads.onDrop}
      className={`rounded-2xl border bg-white p-2 ${uploads.dragging ? "border-dashed border-neutral-950 bg-neutral-50" : "border-neutral-200"}`}
    >
      <Picker inputRef={uploads.inputRef} onPick={uploads.add} />
      {uploads.files.length > 0 ? (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {uploads.files.map((file) => (
            <div key={file.id} className="relative size-14 shrink-0">
              <div className="bg-muted relative size-14 overflow-hidden rounded-lg ring-1 ring-black/10 ring-inset">
                {file.type.startsWith("image/") ? (
                  <img src={file.url} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <FileText className="text-muted-foreground size-6 stroke-[1.5]" />
                  </div>
                )}
                {file.status === "uploading" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <Loader2 className="text-muted-foreground size-4 animate-spin" />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => uploads.remove(file.id)}
                className="absolute end-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-black/50 text-white outline-none focus-visible:ring-2"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2 px-1 py-1">
        <button
          type="button"
          onClick={uploads.open}
          aria-label="Add attachment"
          className="text-muted-foreground hover:bg-muted inline-flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-2"
        >
          <Plus className="size-4" />
        </button>
        <p className="text-sm text-neutral-400">
          {uploads.dragging ? "Drop to attach" : "Send a message..."}
        </p>
      </div>
      {uploads.files.some((file) => file.status === "ready") ? (
        <div className="mt-2 flex flex-col gap-3 border-t border-neutral-100 pt-2">
          {uploads.files
            .filter((file) => file.status === "ready")
            .map((file) => (
              <AssistantUploaded
                key={`${file.id}-look`}
                name={file.name}
                type={file.type}
                url={file.url}
              />
            ))}
        </div>
      ) : null}
    </div>
  )
}
