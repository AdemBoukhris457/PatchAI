import JSZip from "jszip"

/** The speaker notes for each slide, in slide order. A slide with none is an empty string. */
export async function speakerNotes(bytes: Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(bytes)
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => slideNumber(left) - slideNumber(right))
  const notes: string[] = []
  for (const slide of slides) {
    const rels = zip.file(slide.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels")
    if (!rels) {
      notes.push("")
      continue
    }
    const target = (await rels.async("string")).match(/relationships\/notesSlide" Target="([^"]+)"/)
    if (!target) {
      notes.push("")
      continue
    }
    const path = new URL(target[1], "http://local/ppt/slides/").pathname.replace(/^\//, "")
    const file = zip.file(path)
    notes.push(file ? notesBody(await file.async("string")) : "")
  }
  return notes
}

function slideNumber(name: string) {
  return Number(name.match(/slide(\d+)\.xml$/)?.[1] ?? 0)
}

function notesBody(xml: string) {
  const body = xml.match(/<p:ph type="body"[^>]*\/>[\s\S]*?<p:txBody>([\s\S]*?)<\/p:txBody>/)
  if (!body?.[1]) return ""
  return [...body[1].matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
    .map((match) => decode(match[1] ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

function decode(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
}
