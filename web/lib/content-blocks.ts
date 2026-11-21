/**
 * Turn the last user message into the content Deep Agents reads.
 *
 * Text stays text. A file part becomes an image, audio, video, or file
 * block, using the same kinds the multimodal guide gives `read_file`.
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

const AUDIO: Record<string, string> = {
  "audio/wav": "audio/wav",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/mpeg": "audio/mpeg",
  "audio/mp3": "audio/mpeg",
  "audio/aiff": "audio/aiff",
  "audio/x-aiff": "audio/aiff",
  "audio/aac": "audio/aac",
  "audio/ogg": "audio/ogg",
  "audio/flac": "audio/flac",
}

const VIDEO: Record<string, string> = {
  "video/mp4": "video/mp4",
  "video/mpeg": "video/mpeg",
  "video/quicktime": "video/quicktime",
  "video/x-msvideo": "video/x-msvideo",
  "video/x-flv": "video/x-flv",
  "video/webm": "video/webm",
  "video/x-ms-wmv": "video/x-ms-wmv",
  "video/3gpp": "video/3gpp",
}

const DOCUMENT: Record<string, string> = {
  "application/pdf": "application/pdf",
  "application/vnd.ms-powerpoint": "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

const BY_MIME: Record<string, { kind: MediaKind; mime: string }> = {
  ...named("image", IMAGE),
  ...named("audio", AUDIO),
  ...named("video", VIDEO),
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
  mp4: { kind: "video", mime: "video/mp4" },
  mpeg: { kind: "video", mime: "video/mpeg" },
  mpg: { kind: "video", mime: "video/mpeg" },
  mov: { kind: "video", mime: "video/quicktime" },
  avi: { kind: "video", mime: "video/x-msvideo" },
  flv: { kind: "video", mime: "video/x-flv" },
  webm: { kind: "video", mime: "video/webm" },
  wmv: { kind: "video", mime: "video/x-ms-wmv" },
  "3gpp": { kind: "video", mime: "video/3gpp" },
  wav: { kind: "audio", mime: "audio/wav" },
  mp3: { kind: "audio", mime: "audio/mpeg" },
  aiff: { kind: "audio", mime: "audio/aiff" },
  aac: { kind: "audio", mime: "audio/aac" },
  ogg: { kind: "audio", mime: "audio/ogg" },
  flac: { kind: "audio", mime: "audio/flac" },
  pdf: { kind: "file", mime: "application/pdf" },
  ppt: { kind: "file", mime: "application/vnd.ms-powerpoint" },
  pptx: {
    kind: "file",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
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

function mediaOf(part: IncomingPart) {
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
