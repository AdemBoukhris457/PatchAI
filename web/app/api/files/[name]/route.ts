import { readFile } from "node:fs/promises"
import path from "node:path"

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

const FILE_NAME = /^[a-z0-9][a-z0-9_-]{0,70}\.(pdf|pptx)$/

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params
  if (!FILE_NAME.test(name)) {
    return new Response("Not found.", { status: 404 })
  }
  const root = path.resolve(process.cwd(), "..", "exports")
  const file = path.resolve(root, name)
  if (!file.startsWith(root + path.sep)) {
    return new Response("Not found.", { status: 404 })
  }
  try {
    const bytes = await readFile(file)
    return new Response(bytes, {
      headers: {
        "Content-Type": TYPES[name.slice(name.lastIndexOf(".") + 1)] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return new Response("Not found.", { status: 404 })
  }
}
