import { citationsIn, inlineReferences, numberedSources, openedPage } from "./citations.ts"

function check(name, condition) {
  if (!condition) throw new Error(name)
}

function read(url) {
  return {
    type: "tool-call",
    toolName: "read_web_page",
    result: JSON.stringify({ url, text: "page", truncated: false }),
  }
}

const rust = "https://blog.rust-lang.org/2026/10/30/Rust-1.95.0/"
const postgres = "https://www.postgresql.org/about/news/postgresql-19-released/"
const node = "https://nodejs.org/en/blog/release/v26.0.0"
const search = {
  type: "tool-call",
  toolName: "search_web",
  result: JSON.stringify({
    query: "releases",
    results: [{ title: "Announcing Rust 1.95.0", url: rust, snippet: "" }],
  }),
}

const answer = [
  `Rust 1.95 shipped [1](${rust}).`,
  `PostgreSQL 19 followed [2](${postgres}), and Rust again [1](${rust}/).`,
  `A made-up page [3](https://example.com/never-opened).`,
].join(" ")

const cites = citationsIn(answer)
check("each cited URL once, in order", cites.length === 3)
check("the first citation keeps its number", cites[0].number === 1 && cites[0].url === rust)
check("the second citation keeps its number", cites[1].number === 2)

const parts = [search, read(rust), read(node), read(postgres), { type: "text", text: answer }]
const sources = numberedSources(parts)
check("cited pages come first", sources[0].url === rust && sources[1].url === postgres)
check("cited pages carry the answer's number", sources[0].number === 1 && sources[1].number === 2)
check("a search title is kept", sources[0].title === "Announcing Rust 1.95.0")
check("an uncited page is also read", sources[2].url === node && sources[2].number === null)
check("a page never opened is not listed", sources.length === 3)

check("a citation finds its opened page", openedPage(sources, `${rust}#notes`)?.number === 1)
check("a never-opened link finds nothing", openedPage(sources, "https://example.com/never-opened") === null)

const quiet = numberedSources([read(node), { type: "text", text: "No citations here." }])
check("without citations every page is unnumbered", quiet.length === 1 && quiet[0].number === null)

const referenced = `Rust shipped [1]. Node too [2], and [9] stays.\n\n[1]: ${rust}\n[2]: <${node}> "Node"\n`
const inlined = inlineReferences(referenced)
check("a reference becomes an inline link", inlined.includes(`[1](${rust})`))
check("a titled reference becomes an inline link", inlined.includes(`[2](${node})`))
check("an undefined reference stays", inlined.includes("[9] stays"))
check("definition lines are dropped", !inlined.includes("]: "))
check("reference citations are numbered", citationsIn(referenced).map((c) => c.number).join() === "1,2")
check("text without definitions is unchanged", inlineReferences("a [1] b") === "a [1] b")

console.log("citations: ok")
