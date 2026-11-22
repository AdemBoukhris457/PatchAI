"use client"

import { useEffect, useState, type ComponentType } from "react"

import {
  ChatgptExample,
  ClaudeExample,
  FloatingComposer,
  GeminiExample,
  GrokComposer,
  HeadlessComposer,
  MobileComposer,
  PerplexityExample,
  ThreadComposer,
  UnifiedComposer,
} from "./assistant"
import {
  ChatgptComposer,
  ClaudeCodePrompt,
  ClaudeComposer,
  CodexComposer,
  DashboardComposer,
  GeminiComposer,
  OpencodeComposer,
  PerplexityComposer,
} from "./notra"
import {
  AttachmentPiece,
  ChatgptModelPiece,
  ClaudeModelPiece,
  ClaudePlusPiece,
  ContextPiece,
  GeminiModelPiece,
  MentionPiece,
  ModelPillPiece,
  PerplexityModelPiece,
  QueuePiece,
  QuotePiece,
  SlashPiece,
  TriggerPiece,
  VoicePiece,
} from "./pieces"
import { AssistantFileUpload, NotraFileUpload } from "./uploads"
import { FileTypeGallery } from "./file-looks"
import {
  AssistantArtifactCard,
  AssistantFileRow,
  NotraDownloadAction,
  NotraFileChip,
} from "./downloads"
import { AssistantPinnedList, NotraFavoriteGroup } from "./favorites"
import { AssistantPdfCanvas } from "./viewers"
import { AssistantModelMenu, NotraModelMenu } from "./model-pickers"
import {
  AssistantRailSidebar,
  AssistantThreadSidebar,
  NotraInsetSidebar,
  NotraRailSidebar,
} from "./sidebars"
import {
  AssistantThemeFooter,
  AssistantThemeRail,
  NotraThemeMenu,
  NotraThemeTabs,
} from "./theme"
import {
  AssistantErrorTile,
  AssistantErrorToast,
  NotraErrorToast,
  NotraWarningToast,
} from "./warnings"

const STORAGE_KEY = "patchai.input-pick"

type Shell = {
  id: string
  name: string
  note: string
  pad: string
  Mock: ComponentType
}

type Piece = {
  id: string
  name: string
  library: string
  note: string
  Mock: ComponentType
}

const notraShells: Shell[] = [
  {
    id: "notra-dashboard",
    name: "Dashboard composer",
    note: "Dualtone card. Auto, attach, send that turns into stop.",
    pad: "bg-neutral-100",
    Mock: DashboardComposer,
  },
  {
    id: "notra-chatgpt",
    name: "ChatGPT",
    note: "Pill. Ask anything, model and effort, send.",
    pad: "bg-white",
    Mock: ChatgptComposer,
  },
  {
    id: "notra-claude",
    name: "Claude",
    note: "Reply box. Plus menu, model, mode, context ring.",
    pad: "bg-[#f5f4ed]",
    Mock: ClaudeComposer,
  },
  {
    id: "notra-gemini",
    name: "Gemini",
    note: "One-row pill. Model chip. Mic becomes send.",
    pad: "bg-[#f8f9fa]",
    Mock: GeminiComposer,
  },
  {
    id: "notra-perplexity",
    name: "Perplexity",
    note: "Follow-up field. Focus chip, model list, send.",
    pad: "bg-white",
    Mock: PerplexityComposer,
  },
  {
    id: "notra-claude-code",
    name: "Claude Code",
    note: "Prompt between two rules. Shift+Tab cycles the mode.",
    pad: "bg-[#1e1e1e]",
    Mock: ClaudeCodePrompt,
  },
  {
    id: "notra-codex",
    name: "Codex",
    note: "Prompt band, pink cursor, model and folder under it.",
    pad: "bg-[#0e0e0e]",
    Mock: CodexComposer,
  },
  {
    id: "notra-opencode",
    name: "OpenCode",
    note: "Prompt, agent line, status row.",
    pad: "bg-[#141414]",
    Mock: OpencodeComposer,
  },
]

const assistantShells: Shell[] = [
  {
    id: "aui-thread",
    name: "Thread composer",
    note: "The input PatchAI uses now. Paperclip, mic, send.",
    pad: "bg-white",
    Mock: ThreadComposer,
  },
  {
    id: "aui-chatgpt",
    name: "ChatGPT example",
    note: "Tall rounded composer. Plus, mic, send.",
    pad: "bg-white",
    Mock: ChatgptExample,
  },
  {
    id: "aui-claude",
    name: "Claude example",
    note: "Flat bordered box on a warm page.",
    pad: "bg-[#faf9f5]",
    Mock: ClaudeExample,
  },
  {
    id: "aui-gemini",
    name: "Gemini example",
    note: "Single-row pill. Plus opens tools. Mic becomes send.",
    pad: "bg-white",
    Mock: GeminiExample,
  },
  {
    id: "aui-perplexity",
    name: "Perplexity example",
    note: "Tall field. Search menu, model menu, mic or send.",
    pad: "bg-white",
    Mock: PerplexityExample,
  },
  {
    id: "aui-grok",
    name: "Grok example",
    note: "Black pill. Paperclip, model, mic swaps with send.",
    pad: "bg-neutral-200",
    Mock: GrokComposer,
  },
  {
    id: "aui-unified",
    name: "Unified composer",
    note: "One bar. Files, slash, mentions, model, ring, voice.",
    pad: "bg-white",
    Mock: UnifiedComposer,
  },
  {
    id: "aui-mobile",
    name: "Mobile composer",
    note: "Quick actions, one line, thumb-sized send.",
    pad: "bg-neutral-200",
    Mock: MobileComposer,
  },
  {
    id: "aui-floating",
    name: "Floating composer",
    note: "The same kind of input inside a launcher.",
    pad: "bg-neutral-200",
    Mock: FloatingComposer,
  },
  {
    id: "aui-headless",
    name: "Headless input",
    note: "Your own field. Send still belongs to the runtime.",
    pad: "bg-white",
    Mock: HeadlessComposer,
  },
]

const pieceOptions: Piece[] = [
  { id: "piece-files", name: "Attachment chips", library: "Both", note: "A file sits in the composer until send.", Mock: AttachmentPiece },
  { id: "piece-chatgpt-model", name: "ChatGPT model", library: "Notra UI", note: "Chip, effort slider, model list.", Mock: ChatgptModelPiece },
  { id: "piece-claude-plus", name: "Claude plus menu", library: "Notra UI", note: "Files, skills, connectors, plugins, Research.", Mock: ClaudePlusPiece },
  { id: "piece-claude-model", name: "Claude model", library: "Notra UI", note: "Model list and thinking effort.", Mock: ClaudeModelPiece },
  { id: "piece-gemini-model", name: "Gemini model", library: "Notra UI", note: "Fast, Pro, Thinking.", Mock: GeminiModelPiece },
  { id: "piece-perplexity-model", name: "Perplexity model", library: "Notra UI", note: "Provider list, with a locked row.", Mock: PerplexityModelPiece },
  { id: "piece-model-pill", name: "Model pill", library: "assistant-ui", note: "The active model in the action row.", Mock: ModelPillPiece },
  { id: "piece-voice", name: "Voice", library: "assistant-ui", note: "Mic, then a listening state.", Mock: VoicePiece },
  { id: "piece-mentions", name: "Mentions", library: "assistant-ui", note: "Type @ to open people and files.", Mock: MentionPiece },
  { id: "piece-slash", name: "Slash commands", library: "assistant-ui", note: "Type / to open commands.", Mock: SlashPiece },
  { id: "piece-quote", name: "Quote", library: "assistant-ui", note: "A selected passage sits above the draft.", Mock: QuotePiece },
  { id: "piece-queue", name: "Queue", library: "assistant-ui", note: "A message waits while a reply is running.", Mock: QueuePiece },
  { id: "piece-context", name: "Context ring", library: "assistant-ui", note: "How full the window is.", Mock: ContextPiece },
  { id: "piece-trigger", name: "Trigger popover", library: "assistant-ui", note: "A menu of attach, mention, and command.", Mock: TriggerPiece },
]

const warningOptions: Piece[] = [
  {
    id: "warn-notra-error",
    name: "Notra error toast",
    library: "Notra UI",
    note: "Sonner error. A red chip on the depth surface, with a second line.",
    Mock: NotraErrorToast,
  },
  {
    id: "warn-notra-warning",
    name: "Notra warning toast",
    library: "Notra UI",
    note: "The same toast in the warning colour.",
    Mock: NotraWarningToast,
  },
  {
    id: "warn-aui-toast",
    name: "assistant-ui toast",
    library: "assistant-ui",
    note: "The documented line: This file type is not supported.",
    Mock: AssistantErrorToast,
  },
  {
    id: "warn-aui-tile",
    name: "assistant-ui tile",
    library: "assistant-ui",
    note: "The staged tile turns red and the tooltip carries the same line.",
    Mock: AssistantErrorTile,
  },
]

const themeOptions: Piece[] = [
  {
    id: "theme-notra-tabs",
    name: "Notra icon tabs",
    library: "Notra UI",
    note: "Light and Dark share one control. The icon shows on the active side.",
    Mock: NotraThemeTabs,
  },
  {
    id: "theme-notra-menu",
    name: "Notra appearance menu",
    library: "Notra UI",
    note: "A sidebar row opens a radio menu. One of Light or Dark is selected.",
    Mock: NotraThemeMenu,
  },
  {
    id: "theme-aui-footer",
    name: "assistant-ui footer",
    library: "assistant-ui",
    note: "The sidebar footer row. One click switches, and the second line names it.",
    Mock: AssistantThemeFooter,
  },
  {
    id: "theme-aui-rail",
    name: "assistant-ui icon rail",
    library: "assistant-ui",
    note: "The same footer once the sidebar is only an icon. The tooltip names the switch.",
    Mock: AssistantThemeRail,
  },
]

const sidebarOptions: Piece[] = [
  {
    id: "side-notra-inset",
    name: "Notra inset",
    library: "Notra UI",
    note: "A card you can drag wider. Switcher, search, groups that open their chats, and an account row.",
    Mock: NotraInsetSidebar,
  },
  {
    id: "side-notra-rail",
    name: "Notra icon rail",
    library: "Notra UI",
    note: "The same sidebar at icon width. A group opens its chats beside the rail.",
    Mock: NotraRailSidebar,
  },
  {
    id: "side-aui-list",
    name: "assistant-ui thread list",
    library: "assistant-ui",
    note: "New thread, search, and chats grouped by day. More renames, archives, or deletes.",
    Mock: AssistantThreadSidebar,
  },
  {
    id: "side-aui-rail",
    name: "assistant-ui icon rail",
    library: "assistant-ui",
    note: "That sidebar collapsed to icons. A thread title moves into the tooltip.",
    Mock: AssistantRailSidebar,
  },
]

const downloadOptions: Piece[] = [
  {
    id: "dl-aui-file",
    name: "assistant-ui file row",
    library: "assistant-ui",
    note: "The same document row an uploaded PDF uses. The icon names the file, the size sits under it, and the download icon saves it.",
    Mock: AssistantFileRow,
  },
  {
    id: "dl-aui-artifact",
    name: "assistant-ui artifact card",
    library: "assistant-ui",
    note: "The card for a document the agent is writing. While it writes, the caption shimmers with a word count. When it is done, the caption names the file and the whole card downloads it. The arrow shows on hover.",
    Mock: AssistantArtifactCard,
  },
  {
    id: "dl-notra-chip",
    name: "Notra file chip",
    library: "Notra UI",
    note: "Notra has no generated-file card. This is the chip it uses for a file, with the document icon and the name. The chip itself is the download.",
    Mock: NotraFileChip,
  },
  {
    id: "dl-notra-action",
    name: "Notra download action",
    library: "Notra UI",
    note: "Perplexity's answer bar. A ghost download button sits under the reply, and Download is also an item in More. There is no file card.",
    Mock: NotraDownloadAction,
  },
]

const viewerOptions: Piece[] = [
  {
    id: "view-aui-canvas",
    name: "assistant-ui canvas",
    library: "assistant-ui",
    note: "The chat narrows and the document takes the rest, the way Claude and ChatGPT open a file beside the thread. The menu jumps to a page. Scrolling the pages moves the menu with you. Notra’s sheet has no page control.",
    Mock: AssistantPdfCanvas,
  },
]

const modelOptions: Piece[] = [
  {
    id: "model-notra-menu",
    name: "Notra model menu",
    library: "Notra UI",
    note: "Gemini’s model chip. A ghost trigger opens a radio list above it. The check sits on the left, with the name and a short line under it. GPT-6 Luna starts selected.",
    Mock: NotraModelMenu,
  },
  {
    id: "model-aui-menu",
    name: "assistant-ui model menu",
    library: "assistant-ui",
    note: "The composer model pill. The name and a chevron sit in the action row. The list opens above it, with a short line beside each name and a check on the current one. GPT-6 Luna starts selected.",
    Mock: AssistantModelMenu,
  },
]

const favoriteOptions: Piece[] = [
  {
    id: "fav-aui-pinned",
    name: "assistant-ui pinned",
    library: "assistant-ui",
    note: "A pinned chat leaves its day and sits under pinned, with a small pin beside the title. Pin and Unpin are in the more menu.",
    Mock: AssistantPinnedList,
  },
  {
    id: "fav-notra-star",
    name: "Notra favorites group",
    library: "Notra UI",
    note: "Notra has no favorite list. This is their sidebar group, with a star, held above the days. The star on a row toggles it.",
    Mock: NotraFavoriteGroup,
  },
]

const shellNames = new Map(
  [...notraShells, ...assistantShells].map((shell) => [shell.id, shell.name]),
)
const pieceNames = new Map(
  [...pieceOptions, ...warningOptions, ...themeOptions, ...sidebarOptions, ...downloadOptions, ...viewerOptions, ...modelOptions, ...favoriteOptions].map((piece) => [
    piece.id,
    piece.name,
  ]),
)

export function Gallery() {
  const [shell, setShell] = useState<string | null>(null)
  const [pieces, setPieces] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { shell?: string | null; pieces?: string[] }
        setShell(saved.shell ?? null)
        setPieces(Array.isArray(saved.pieces) ? saved.pieces : [])
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ shell, pieces }))
  }, [ready, shell, pieces])

  function togglePiece(id: string) {
    setPieces((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const rows = Math.max(notraShells.length, assistantShells.length)

  return (
    <div className="min-h-svh bg-neutral-50 text-neutral-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-6">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Pick an input</h1>
            <p className="mt-1 max-w-xl text-sm text-neutral-600">
              Temporary page. The file uploads are the first row. Drop a file on either one, or use its button. The chat at the home page is unchanged.
            </p>
          </div>
          <a href="/" className="text-sm underline outline-none focus-visible:ring-2">
            Back to the chat
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section>
          <h2 className="text-lg font-medium">The model menu</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Both sit where GPT-6 Luna is now. The list is the chat models OpenAI documents for this kind of conversation. Luna stays selected until you pick another.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {modelOptions.map((piece) => {
              const marked = pieces.includes(piece.id)
              const Mock = piece.Mock
              return (
                <section
                  key={piece.id}
                  id={piece.id}
                  className={`rounded-2xl border bg-white p-3 ${marked ? "border-neutral-950" : "border-neutral-200"}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{piece.name}</h3>
                      <p className="text-xs text-neutral-500">{piece.library}</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={marked}
                      onClick={() => togglePiece(piece.id)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs outline-none focus-visible:ring-2 ${marked ? "bg-neutral-950 text-white" : "border"}`}
                    >
                      {marked ? "Marked" : "Mark"}
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-neutral-600">{piece.note}</p>
                  <div className="overflow-hidden rounded-xl bg-neutral-100 px-4 pt-96 pb-4">
                    <Mock />
                  </div>
                </section>
              )
            })}
          </div>
        </section>

        <div className="mt-10 mb-3 hidden grid-cols-2 gap-6 md:grid">
          <h2 className="text-lg font-medium">Notra UI</h2>
          <h2 className="text-lg font-medium">assistant-ui</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 bg-white">
            <div className="px-4 py-3">
              <p className="text-xs text-neutral-500 md:hidden">Notra UI</p>
              <h3 className="font-medium">File chip</h3>
              <p className="mt-0.5 text-sm text-neutral-600">
                A file sits on the card. While it uploads, send and remove stay hidden.
              </p>
            </div>
            <div className="bg-neutral-100 px-4 py-5">
              <NotraFileUpload />
            </div>
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white">
            <div className="px-4 py-3">
              <p className="text-xs text-neutral-500 md:hidden">assistant-ui</p>
              <h3 className="font-medium">File tile and row</h3>
              <p className="mt-0.5 text-sm text-neutral-600">
                A tile while it is staged, then the file row with its size and download.
              </p>
            </div>
            <div className="px-4 py-5">
              <AssistantFileUpload />
            </div>
          </section>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-medium">
            When the file is not an image or a document
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Audio, video, and anything else are refused. Mark the warning you want on the chat. These stay on this page until you pick.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {warningOptions.map((piece) => {
              const marked = pieces.includes(piece.id)
              const Mock = piece.Mock
              return (
                <section
                  key={piece.id}
                  id={piece.id}
                  className={`flex flex-col rounded-2xl border bg-white p-3 ${marked ? "border-neutral-950" : "border-neutral-200"}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{piece.name}</h3>
                      <p className="text-xs text-neutral-500">{piece.library}</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={marked}
                      onClick={() => togglePiece(piece.id)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs outline-none focus-visible:ring-2 ${marked ? "bg-neutral-950 text-white" : "border"}`}
                    >
                      {marked ? "Marked" : "Mark"}
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-neutral-600">{piece.note}</p>
                  <div className="mt-auto rounded-xl bg-neutral-100 p-4">
                    <Mock />
                  </div>
                </section>
              )
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">Theme, at the bottom of the sidebar</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Mark the one you want. These stay on this page until you pick. The header button on the chat is unchanged.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {themeOptions.map((piece) => {
              const marked = pieces.includes(piece.id)
              const Mock = piece.Mock
              return (
                <section
                  key={piece.id}
                  id={piece.id}
                  className={`flex flex-col rounded-2xl border bg-white p-3 ${marked ? "border-neutral-950" : "border-neutral-200"}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{piece.name}</h3>
                      <p className="text-xs text-neutral-500">{piece.library}</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={marked}
                      onClick={() => togglePiece(piece.id)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs outline-none focus-visible:ring-2 ${marked ? "bg-neutral-950 text-white" : "border"}`}
                    >
                      {marked ? "Marked" : "Mark"}
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-neutral-600">{piece.note}</p>
                  <Mock />
                </section>
              )
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">The sidebar</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            The chat uses the assistant-ui thread list. Mark another shell here if you want to compare.
          </p>
          <div className="mt-4 grid gap-4">
            {sidebarOptions.map((piece) => {
              const marked = pieces.includes(piece.id)
              const Mock = piece.Mock
              return (
                <section
                  key={piece.id}
                  id={piece.id}
                  className={`rounded-2xl border bg-white p-3 ${marked ? "border-neutral-950" : "border-neutral-200"}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{piece.name}</h3>
                      <p className="text-xs text-neutral-500">{piece.library}</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={marked}
                      onClick={() => togglePiece(piece.id)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs outline-none focus-visible:ring-2 ${marked ? "bg-neutral-950 text-white" : "border"}`}
                    >
                      {marked ? "Marked" : "Mark"}
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-neutral-600">{piece.note}</p>
                  <Mock />
                </section>
              )
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">Favorite sessions</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            The chat uses the assistant-ui pinned block. The star group is still here if you want to compare.
          </p>
          <div className="mt-4 grid gap-4">
            {favoriteOptions.map((piece) => {
              const marked = pieces.includes(piece.id)
              const Mock = piece.Mock
              return (
                <section
                  key={piece.id}
                  id={piece.id}
                  className={`rounded-2xl border bg-white p-3 ${marked ? "border-neutral-950" : "border-neutral-200"}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{piece.name}</h3>
                      <p className="text-xs text-neutral-500">{piece.library}</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={marked}
                      onClick={() => togglePiece(piece.id)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs outline-none focus-visible:ring-2 ${marked ? "bg-neutral-950 text-white" : "border"}`}
                    >
                      {marked ? "Marked" : "Mark"}
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-neutral-600">{piece.note}</p>
                  <Mock />
                </section>
              )
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">Where the PDF opens</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            assistant-ui’s canvas is the panel Claude and ChatGPT use: the document sits beside the chat, on its own pages. Open the menu to jump, or scroll the pages and the menu follows.
          </p>
          <div className="mt-4 grid gap-4">
            {viewerOptions.map((piece) => {
              const marked = pieces.includes(piece.id)
              const Mock = piece.Mock
              return (
                <section
                  key={piece.id}
                  id={piece.id}
                  className={`rounded-2xl border bg-white p-3 ${marked ? "border-neutral-950" : "border-neutral-200"}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{piece.name}</h3>
                      <p className="text-xs text-neutral-500">{piece.library}</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={marked}
                      onClick={() => togglePiece(piece.id)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs outline-none focus-visible:ring-2 ${marked ? "bg-neutral-950 text-white" : "border"}`}
                    >
                      {marked ? "Marked" : "Mark"}
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-neutral-600">{piece.note}</p>
                  <Mock />
                </section>
              )
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">When the agent makes a PDF</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            The chat uses the assistant-ui artifact card. The other looks stay here if you want to compare. Each sample still downloads a small file.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {downloadOptions.map((piece) => {
              const marked = pieces.includes(piece.id)
              const Mock = piece.Mock
              return (
                <section
                  key={piece.id}
                  id={piece.id}
                  className={`flex flex-col rounded-2xl border bg-white p-3 ${marked ? "border-neutral-950" : "border-neutral-200"}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{piece.name}</h3>
                      <p className="text-xs text-neutral-500">{piece.library}</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={marked}
                      onClick={() => togglePiece(piece.id)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs outline-none focus-visible:ring-2 ${marked ? "bg-neutral-950 text-white" : "border"}`}
                    >
                      {marked ? "Marked" : "Mark"}
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-neutral-600">{piece.note}</p>
                  <div className="mt-auto rounded-xl bg-neutral-100 p-4">
                    <Mock />
                  </div>
                </section>
              )
            })}
          </div>
        </section>

        <FileTypeGallery />

        <div className="mt-10 mb-4 hidden grid-cols-2 gap-6 md:grid">
          <h2 className="text-lg font-medium">Notra UI</h2>
          <h2 className="text-lg font-medium">assistant-ui</h2>
        </div>
        <div className="grid gap-6">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="grid gap-6 md:grid-cols-2">
              <ShellCard
                shell={notraShells[index]}
                library="Notra UI"
                chosen={shell === notraShells[index]?.id}
                onChoose={setShell}
              />
              <ShellCard
                shell={assistantShells[index]}
                library="assistant-ui"
                chosen={shell === assistantShells[index]?.id}
                onChoose={setShell}
              />
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-lg font-medium">Pieces that sit on an input</h2>
        <p className="mt-1 max-w-xl text-sm text-neutral-600">
          Mark any of these to keep with the shell. They are the menus, chips, and controls from both libraries.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pieceOptions.map((piece) => {
            const marked = pieces.includes(piece.id)
            const Mock = piece.Mock
            return (
              <section
                key={piece.id}
                id={piece.id}
                className={`flex flex-col rounded-2xl border bg-white p-3 ${marked ? "border-neutral-950" : "border-neutral-200"}`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium">{piece.name}</h3>
                    <p className="text-xs text-neutral-500">{piece.library}</p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={marked}
                    onClick={() => togglePiece(piece.id)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs outline-none focus-visible:ring-2 ${marked ? "bg-neutral-950 text-white" : "border"}`}
                  >
                    {marked ? "Marked" : "Mark"}
                  </button>
                </div>
                <p className="mb-3 text-xs text-neutral-600">{piece.note}</p>
                <div className="mt-auto">
                  <Mock />
                </div>
              </section>
            )
          })}
        </div>
      </main>

      <div className="sticky bottom-0 border-t bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm">
          <p>
            <span className="text-neutral-500">Shell. </span>
            {shell ? shellNames.get(shell) : "None yet"}
            <span className="text-neutral-500"> · Pieces. </span>
            {pieces.length
              ? pieces.map((id) => pieceNames.get(id)).filter(Boolean).join(", ")
              : "None"}
          </p>
          <button
            type="button"
            onClick={() => {
              setShell(null)
              setPieces([])
            }}
            className="rounded-full border px-3 py-1 outline-none focus-visible:ring-2"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}

function ShellCard({
  shell,
  library,
  chosen,
  onChoose,
}: {
  shell: Shell | undefined
  library: string
  chosen: boolean
  onChoose: (id: string) => void
}) {
  if (!shell) return <div className="hidden md:block" />
  const Mock = shell.Mock
  return (
    <section
      id={shell.id}
      className={`rounded-2xl border bg-white ${chosen ? "border-neutral-950" : "border-neutral-200"}`}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs text-neutral-500 md:hidden">{library}</p>
          <h3 className="font-medium">{shell.name}</h3>
          <p className="mt-0.5 text-sm text-neutral-600">{shell.note}</p>
        </div>
        <button
          type="button"
          aria-pressed={chosen}
          onClick={() => onChoose(shell.id)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm outline-none focus-visible:ring-2 ${chosen ? "bg-neutral-950 text-white" : "border"}`}
        >
          {chosen ? "Chosen" : "Choose"}
        </button>
      </div>
      <div className={`px-4 py-5 ${shell.pad}`}>
        <Mock />
      </div>
    </section>
  )
}
