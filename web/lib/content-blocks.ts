/**
 * Turn the last user message into the content Deep Agents reads.
 *
 * Text stays text. A file part becomes an image or a document block.
 * Audio and video are refused.
 */

type MediaKind = "image" | "audio" | "video" | "file"

export type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: MediaKind
      url: string
      mime_type?: string
      filename?: string
    }
  | {
      type: MediaKind
      base64: string
      mime_type: string
      filename?: string
    }

export type IncomingPart = {
  type?: string
  text?: string
  mediaType?: string
  url?: string
  filename?: string
}

type Turn =
  | { ok: true; body: { text: string } | { content: ContentBlock[] } }
  | { ok: false; error: string }

const IMAGE: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
  "image/heic": "image/heic",
  "image/heif": "image/heif",
}

const DOCUMENT: Record<string, string> = {
  "application/pdf": "application/pdf",
  "application/vnd.ms-powerpoint": "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

const BY_MIME: Record<string, { kind: MediaKind; mime: string }> = {
  ...named("image", IMAGE),
  ...named("file", DOCUMENT),
}

const BY_EXTENSION: Record<string, { kind: MediaKind; mime: string }> = {
  png: { kind: "image", mime: "image/png" },
  jpg: { kind: "image", mime: "image/jpeg" },
  jpeg: { kind: "image", mime: "image/jpeg" },
  gif: { kind: "image", mime: "image/gif" },
  webp: { kind: "image", mime: "image/webp" },
  heic: { kind: "image", mime: "image/heic" },
  heif: { kind: "image", mime: "image/heif" },
  pdf: { kind: "file", mime: "application/pdf" },
  ppt: { kind: "file", mime: "application/vnd.ms-powerpoint" },
  pptx: {
    kind: "file",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
}

/** Extensions and MIME types the composer may attach. */
export const ACCEPTED_FILE_ACCEPT = [
  ...Object.keys(BY_EXTENSION).map((extension) => `.${extension}`),
  ...new Set([
    ...Object.keys(BY_MIME),
    ...Object.values(BY_EXTENSION).map((entry) => entry.mime),
  ]),
].join(",")

export type UploadKind = { kind: MediaKind; mime: string }

export function classifyUpload(
  name: string | undefined,
  mime: string | undefined,
): UploadKind | undefined {
  return mediaOf({ filename: name, mediaType: mime })
}

function named(kind: MediaKind, table: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(table).map(([mime, canonical]) => [
      mime,
      { kind, mime: canonical },
    ]),
  )
}

export function turnFromParts(parts: IncomingPart[]): Turn {
  const blocks: ContentBlock[] = []
  let sawMedia = false

  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") {
      const text = part.text.trim()
      if (text) blocks.push({ type: "text", text })
      continue
    }
    if (part.type !== "file" || typeof part.url !== "string" || !part.url) {
      continue
    }
    const media = mediaOf(part)
    if (!media) {
      return { ok: false, error: "This file type is not supported." }
    }
    const block = blockFrom(part.url, media, filenameOf(part.filename))
    if (!block) {
      return { ok: false, error: "The attachment could not be read." }
    }
    blocks.push(block)
    sawMedia = true
  }

  if (!sawMedia) {
    const text = blocks
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim()
    if (!text) return { ok: false, error: "A message is required." }
    return { ok: true, body: { text } }
  }
  if (blocks.length === 0) {
    return { ok: false, error: "A message is required." }
  }
  return { ok: true, body: { content: blocks } }
}

function mediaOf(part: Pick<IncomingPart, "filename" | "mediaType">) {
  const mime = (part.mediaType ?? "").split(";", 1)[0]?.trim().toLowerCase()
  const fromMime = mime ? BY_MIME[mime] : undefined
  if (fromMime && mime !== "application/octet-stream") return fromMime
  const extension = filenameOf(part.filename)?.split(".").pop()?.toLowerCase()
  return (extension && BY_EXTENSION[extension]) || fromMime
}

function blockFrom(
  url: string,
  media: { kind: MediaKind; mime: string },
  filename: string | undefined,
): ContentBlock | null {
  const name = filename ? { filename } : {}
  const data = dataUrl(url)
  if (data) {
    return {
      type: media.kind,
      base64: data,
      mime_type: media.mime,
      ...name,
    }
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return { type: media.kind, url, mime_type: media.mime, ...name }
  }
  return null
}

function dataUrl(url: string) {
  const match = /^data:[^,]*;base64,([a-z0-9+/=\s]+)$/i.exec(url)
  const payload = match?.[1]?.replace(/\s/g, "")
  return payload ? payload : null
}

function filenameOf(value: string | undefined) {
  if (!value) return undefined
  const name = value.replaceAll("\\", "/").split("/").pop()?.trim()
  if (!name || [...name].some((char) => char.charCodeAt(0) < 32)) {
    return undefined
  }
  return name.slice(0, 200)
}
