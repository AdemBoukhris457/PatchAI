import { readFile } from "node:fs/promises"
import path from "node:path"

export async function GET() {
  const file = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.min.mjs",
  )
  try {
    const bytes = await readFile(file)
    return new Response(bytes, {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return new Response("Not found.", { status: 404 })
  }
}
