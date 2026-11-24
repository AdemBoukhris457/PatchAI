/**
 * Record a real finance conversation and open the PDF it writes.
 *
 * Needs the web app at http://localhost:3000 and the agent at
 * http://127.0.0.1:8765. The pictures land in docs/.
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import gifenc from "gifenc"
import { PNG } from "pngjs"
import { chromium } from "playwright"

const { GIFEncoder, quantize, applyPalette } = gifenc

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const docsDir = resolve(repoRoot, "docs")
const pageUrl = process.env.PATCHAI_WEB_URL ?? "http://localhost:3000"
const viewport = { width: 1440, height: 900 }
const clip = { x: 0, y: 0, width: viewport.width, height: viewport.height }
let cursorAt = { x: 720, y: 640 }

const turns = [
  "What are the latest prices of Apple, Nvidia, and Tesla?",
  "How many NFIP flood claims did Texas have in 2017?",
  "Save a one-page PDF brief of those prices and that claim count.",
]

mkdirSync(docsDir, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 1,
  colorScheme: "light",
})
await context.addInitScript(() => {
  localStorage.setItem("theme", "light")
  localStorage.removeItem("patchai.chats")
  const finish = (request) => {
    setTimeout(() => {
      if (typeof request.onsuccess === "function") request.onsuccess()
    }, 0)
    return request
  }
  indexedDB.open = () =>
    finish({
      result: {
        objectStoreNames: { contains: () => true },
        close() {},
        transaction() {
          return {
            objectStore() {
              return {
                getAll: () => finish({ result: [] }),
                put() {},
                delete() {},
              }
            },
          }
        },
      },
    })
})

const page = await context.newPage()
await page.goto(pageUrl, { waitUntil: "domcontentloaded" })
await page.addStyleTag({
  content:
    "nextjs-portal{display:none!important}.aui-thread-scroll-to-bottom{display:none!important}",
})
await page.evaluate(() => document.fonts.ready)
await page.getByRole("textbox", { name: "Message input" }).waitFor({ timeout: 20000 })
const sidebar = page.getByRole("main").getByRole("button", { name: "Toggle Sidebar" })
if (await sidebar.isVisible()) {
  await sidebar.click()
  await page.waitForTimeout(300)
}

const frames = []
await showCursor(page)
await hold(page, frames, 8)

for (let index = 0; index < turns.length; index += 1) {
  await typeAndSend(page, frames, turns[index])
  await watchTurn(page, frames)
  await page.waitForTimeout(500)
  await hold(page, frames, 16)
}

const scroller = page.locator("[data-slot=aui_thread-viewport]")
await scroller.evaluate((node) => {
  node.scrollTop = 0
})
await page.waitForTimeout(200)
await page.screenshot({ path: resolve(docsDir, "chat.png") })

const card = page.locator("[data-slot=artifact-card]").filter({ hasText: "PDF" }).last()
await card.waitFor({ timeout: 5000 })
await scrollTo(page, scroller, frames, card)
await point(page, frames, card)
await card.click()
await page.locator("aside canvas").first().waitFor({ timeout: 20000 })
await page.waitForTimeout(700)
await page.screenshot({ path: resolve(docsDir, "pdf.png") })
await park(page, frames)
await hold(page, frames, 28)

const pdfScroller = page.locator("aside .overflow-y-auto").last()
const distance = await pdfScroller.evaluate((node) => node.scrollHeight - node.clientHeight)
if (distance > 40) {
  const steps = 10
  for (let step = 1; step <= steps; step += 1) {
    await pdfScroller.evaluate((node, top) => {
      node.scrollTop = top
    }, Math.round((distance * step) / steps))
    frames.push({ png: await page.screenshot(), delay: 90 })
  }
  await hold(page, frames, 18)
}

writeGif(resolve(docsDir, "demo.gif"), frames)
await browser.close()
console.log(`Wrote the live conversation to ${docsDir}`)

async function typeAndSend(page, frames, text) {
  const input = page.getByRole("textbox", { name: "Message input" })
  await input.click()
  const words = text.split(" ")
  let shown = ""
  for (const word of words) {
    shown += shown ? ` ${word}` : word
    await input.fill(shown)
    frames.push({ png: await page.screenshot(), delay: 80 })
  }
  await page.getByRole("button", { name: "Send message" }).click()
  frames.push({ png: await page.screenshot(), delay: 200 })
}

async function watchTurn(page, frames) {
  const stop = page.getByRole("button", { name: /Stop generating|Cancel sending/ })
  await stop.waitFor({ timeout: 30000 })
  const started = Date.now()
  while (Date.now() - started < 180000) {
    const visible = await stop.isVisible().catch(() => false)
    if (!visible) break
    frames.push({ png: await page.screenshot(), delay: 160 })
    await page.waitForTimeout(1100)
  }
  await page.getByRole("button", { name: "Send message" }).waitFor({ timeout: 180000 })
  await page.waitForTimeout(600)
}

async function hold(page, frames, ticks) {
  frames.push({ png: await page.screenshot(), delay: ticks * 90 })
}

async function showCursor(page) {
  await page.evaluate(() => {
    const cursor = document.createElement("div")
    cursor.id = "readme-cursor"
    cursor.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "z-index:2147483647",
      "width:16px",
      "height:16px",
      "margin:-2px 0 0 -2px",
      "border:2px solid #fff",
      "border-radius:999px",
      "background:#111",
      "box-shadow:0 1px 4px rgba(0,0,0,.35)",
      "pointer-events:none",
    ].join(";")
    document.body.append(cursor)
    window.addEventListener(
      "mousemove",
      (event) => {
        cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`
      },
      true,
    )
  })
}

async function point(page, frames, locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error("The control is not on screen.")
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const start = cursorAt
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 8
    await page.mouse.move(start.x + (target.x - start.x) * t, start.y + (target.y - start.y) * t)
    frames.push({ png: await page.screenshot(), delay: 60 })
  }
  cursorAt = target
}

async function park(page, frames) {
  const target = { x: clip.width - 24, y: 28 }
  const start = cursorAt
  for (let step = 1; step <= 6; step += 1) {
    const t = step / 6
    await page.mouse.move(start.x + (target.x - start.x) * t, start.y + (target.y - start.y) * t)
    frames.push({ png: await page.screenshot(), delay: 50 })
  }
  cursorAt = target
}

async function scrollTo(page, scroller, frames, locator) {
  const box = await locator.boundingBox()
  const frame = await scroller.boundingBox()
  if (!box || !frame) return
  const current = await scroller.evaluate((node) => node.scrollTop)
  const target = Math.max(0, current + box.y - frame.y - 80)
  const steps = Math.max(6, Math.round(Math.abs(target - current) / 48))
  for (let step = 1; step <= steps; step += 1) {
    const top = Math.round(current + ((target - current) * step) / steps)
    await scroller.evaluate((node, value) => {
      node.scrollTop = value
    }, top)
    frames.push({ png: await page.screenshot(), delay: 70 })
  }
}

function deepen(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max > 120 && max < 210 && max - min < 24) {
      data[i] = Math.round(r * 0.62)
      data[i + 1] = Math.round(g * 0.62)
      data[i + 2] = Math.round(b * 0.62)
    }
  }
}

function writeGif(path, frames) {
  const gif = GIFEncoder()
  for (const frame of frames) {
    const png = PNG.sync.read(frame.png)
    deepen(png.data)
    const palette = quantize(png.data, 256)
    const index = applyPalette(png.data, palette, "rgb444")
    gif.writeFrame(index, png.width, png.height, { palette, delay: frame.delay })
  }
  gif.finish()
  writeFileSync(path, Buffer.from(gif.bytes()))
}
