import { pagesUsed } from "./web-sources.ts"

const opened = "https://www.nobelprize.org/prizes/peace/2026/press-release/"
const search = {
  type: "tool-call",
  toolName: "search_web",
  result: JSON.stringify({
    query: "nobel",
    results: [
      { title: "Nobel Peace Prize 2026", url: opened, snippet: "Navi Pillay" },
      { title: "Unread hit", url: "https://example.com/other", snippet: "no" },
    ],
  }),
}
const read = {
  type: "tool-call",
  toolName: "read_web_page",
  result: JSON.stringify({ url: opened, text: "Navi Pillay", truncated: false }),
}
const failed = {
  type: "tool-call",
  toolName: "read_web_page",
  isError: true,
  result: { error: "The page could not be read: HTTP 404" },
}

function check(name, condition) {
  if (!condition) throw new Error(name)
}

const fromTools = pagesUsed([search, read, failed, read])
check("one opened page", fromTools.length === 1)
check("title from the search hit", fromTools[0]?.title === "Nobel Peace Prize 2026")
check("host drops www", fromTools[0]?.host === "nobelprize.org")

const quoted = pagesUsed([
  { type: "tool-call", toolName: "stock_quotes", result: "AAPL 355.58" },
])
check("a quote has no web source", quoted.length === 0)

const cited = pagesUsed([
  read,
  {
    type: "source",
    sourceType: "url",
    url: "https://www.un.org/sg/en",
    title: "Secretary-General",
  },
])
check("a source part does not hide another opened page", cited.length === 2)
check("source title is kept", cited[1]?.title === "Secretary-General")

const duplicate = pagesUsed([
  {
    type: "source",
    sourceType: "url",
    url: opened,
    title: "Nobel Peace Prize 2026",
  },
  { type: "source", sourceType: "url", url: opened.replace(/\/$/, "") },
])
check("the same page is one source", duplicate.length === 1)

const full = JSON.stringify({
  url: "https://www.gov.uk/government/ministers/prime-minister",
  text: "y".repeat(5000),
  truncated: false,
})
const cut = `${full.slice(0, 4000)}…`
const searchJson = JSON.stringify({
  query: "pm",
  results: [
    {
      title: "Prime Minister",
      url: "https://www.gov.uk/government/ministers/prime-minister",
      snippet: "office",
    },
    { title: "Other", url: "https://example.com/other", snippet: "x".repeat(5000) },
  ],
})
const recovered = pagesUsed([
  { type: "tool-call", toolName: "search_web", result: `${searchJson.slice(0, 4000)}…` },
  { type: "tool-call", toolName: "read_web_page", result: cut },
])
check("a shortened page result still counts", recovered.length === 1)
check("title survives a shortened search result", recovered[0]?.title === "Prime Minister")

const broken = [
  '{"query":"pm","results":[',
  '{"title":"Prime Minister - GOV.UKPremiership of Andy Burnham…","url":"https://www.gov.uk/government/ministers/prime-minister","snippet":"x"}',
  "]}",
].join("")
const fallback = pagesUsed([
  { type: "tool-call", toolName: "search_web", result: broken },
  { type: "tool-call", toolName: "read_web_page", result: cut },
])
check("a glued title is not shown", fallback.length === 1)
check("the host stands in for a glued title", fallback[0]?.title === "gov.uk")

console.log("web sources ok")
