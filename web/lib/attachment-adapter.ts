import type { AttachmentAdapter } from "@assistant-ui/core"
import { getFileDataURL } from "@assistant-ui/core/internal"
import { generateId } from "ai"

import { classifyUpload } from "@/lib/content-blocks"

/**
 * Stage a file the chat can send, then read it as a data URL on send.
 * The picker can offer any file. One that is not an image or a document
 * is refused here, and the composer turns that into a warning.
 */
export const acceptedAttachmentAdapter: AttachmentAdapter = {
  accept: "*",
  async add({ file }) {
    const media = classifyUpload(file.name, file.type)
    if (!media) {
      throw new Error(file.name || "This file")
    }
    return {
      id: generateId(),
      type: media.kind === "image" ? "image" : "file",
      name: file.name,
      file,
      contentType: media.mime || file.type,
      content: [],
      status: { type: "requires-action", reason: "composer-send" },
    }
  },
  async send(attachment, options) {
    return {
      ...attachment,
      status: { type: "complete" },
      content: [
        {
          type: "file",
          mimeType: attachment.contentType || "application/octet-stream",
          filename: attachment.name,
          data: await getFileDataURL(attachment.file, options),
        },
      ],
    }
  },
  async remove() {
    // The file never leaves the browser.
  },
}
