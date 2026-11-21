"use client"

import { FileText } from "lucide-react"
import { useState } from "react"

import { File } from "@/components/file"
import { Image } from "@/components/image"
import { AudioPlayer, VideoPlayer } from "@/components/media-player"

type Kind = "image" | "document"

type Specimen = {
  ext: string
  name: string
  mime: string
  kind: Kind
  hue: number
}

const SPECIMENS: Specimen[] = [
  { ext: "png", name: "map.png", mime: "image/png", kind: "image", hue: 210 },
  { ext: "jpg", name: "photo.jpg", mime: "image/jpeg", kind: "image", hue: 28 },
  { ext: "jpeg", name: "scan.jpeg", mime: "image/jpeg", kind: "image", hue: 36 },
  { ext: "gif", name: "loop.gif", mime: "image/gif", kind: "image", hue: 320 },
  { ext: "webp", name: "still.webp", mime: "image/webp", kind: "image", hue: 160 },
  { ext: "heic", name: "camera.heic", mime: "image/heic", kind: "image", hue: 250 },
  { ext: "heif", name: "camera.heif", mime: "image/heif", kind: "image", hue: 262 },
  { ext: "pdf", name: "brief.pdf", mime: "application/pdf", kind: "document", hue: 4 },
  { ext: "ppt", name: "slides.ppt", mime: "application/vnd.ms-powerpoint", kind: "document", hue: 18 },
  {
    ext: "pptx",
    name: "slides.pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    kind: "document",
    hue: 24,
  },
]

const FILTERS: { id: "all" | Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "document", label: "Documents" },
]

function swatch(label: string, hue: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="100%" height="100%" fill="hsl(${hue} 38% 42%)"/><text x="50%" y="54%" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="84" fill="white" font-weight="600">${label}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function AssistantSpecimen({ item }: { item: Specimen }) {
  const picture = swatch(`.${item.ext}`, item.hue)
  if (item.kind === "image") {
    return (
      <Image.Root size="full">
        <Image.Zoom src={picture}>
          <Image.Preview src={picture} alt={item.name} ratio="4:3" fit="cover" />
        </Image.Zoom>
        <Image.Filename>{item.name}</Image.Filename>
      </Image.Root>
    )
  }
  return (
    <File
      type="file"
      filename={item.name}
      mimeType={item.mime}
      data="AAAA"
      status={{ type: "complete" }}
    />
  )
}

function NotraSpecimen({ item }: { item: Specimen }) {
  const picture = swatch(`.${item.ext}`, item.hue)
  if (item.kind === "image") {
    return (
      <div className="overflow-hidden rounded-xl bg-white">
        <img src={picture} alt="" className="aspect-[4/3] w-full object-cover" />
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          <span className="text-xs text-neutral-400">.{item.ext}</span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white px-2 py-1.5 text-sm">
      <FileText className="size-4 shrink-0 text-neutral-500" />
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      <span className="text-xs text-neutral-400">.{item.ext}</span>
    </div>
  )
}

const NOTES: Record<Kind, { notra: string; assistant: string }> = {
  image: {
    notra: "A picture on the chip, with the file name under it.",
    assistant: "A photo card. Click it to open the picture.",
  },
  document: {
    notra: "A file chip. The extension is the only difference.",
    assistant: "A document row, with an icon, the name, the size, and download.",
  },
}

export function FileTypeGallery() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const visible = SPECIMENS.filter((item) => filter === "all" || item.kind === filter)
  const kinds = (["image", "document"] as const).filter(
    (kind) => visible.some((item) => item.kind === kind),
  )

  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium">How each file looks once it is uploaded</h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        Images and documents are the files the chat accepts. assistant-ui changes the frame for a photo or a document. Notra keeps a chip and changes what sits inside it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-3 py-1 text-sm outline-none focus-visible:ring-2 ${filter === item.id ? "bg-neutral-950 text-white" : "border"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4 hidden grid-cols-2 gap-6 md:grid">
        <h3 className="text-sm font-medium">Notra UI</h3>
        <h3 className="text-sm font-medium">assistant-ui</h3>
      </div>
      <div className="mt-3 grid gap-8">
        {kinds.map((kind) => (
          <div key={kind} className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm text-neutral-600 md:hidden">Notra UI</p>
              <p className="mb-3 text-sm text-neutral-600">{NOTES[kind].notra}</p>
              <div className={`grid gap-3 ${kind === "image" ? "sm:grid-cols-2" : ""}`}>
                {visible
                  .filter((item) => item.kind === kind)
                  .map((item) => (
                    <div key={`notra-${item.ext}`}>
                      <p className="mb-1 text-xs text-neutral-500">.{item.ext}</p>
                      <NotraSpecimen item={item} />
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-neutral-600 md:hidden">assistant-ui</p>
              <p className="mb-3 text-sm text-neutral-600">{NOTES[kind].assistant}</p>
              <div className={`grid gap-3 ${kind === "image" ? "sm:grid-cols-2" : ""}`}>
                {visible
                  .filter((item) => item.kind === kind)
                  .map((item) => (
                    <div key={`aui-${item.ext}`}>
                      <p className="mb-1 text-xs text-neutral-500">.{item.ext}</p>
                      <AssistantSpecimen item={item} />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function AssistantUploaded({
  name,
  type,
  url,
}: {
  name: string
  type: string
  url: string
}) {
  if (type.startsWith("image/")) {
    return (
      <Image
        type="image"
        image={url}
        filename={name}
        status={{ type: "complete" }}
      />
    )
  }
  if (type.startsWith("audio/")) {
    return <AudioPlayer src={url} title={name} />
  }
  if (type.startsWith("video/")) {
    return <VideoPlayer src={url} title={name} ratio="16:9" />
  }
  return (
    <File
      type="file"
      filename={name}
      mimeType={type || "application/octet-stream"}
      data={url}
      sourceType="url"
      status={{ type: "complete" }}
    />
  )
}
