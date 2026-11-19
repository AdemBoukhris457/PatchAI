const CODE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g
const DISPLAY = /\\\[([\s\S]+?)\\\]/g
const INLINE = /\\\(([\s\S]+?)\\\)/g

function rewrite(text: string) {
  return text
    .replace(DISPLAY, (_match, body: string) => `\n\n$$\n${body.trim()}\n$$\n\n`)
    .replace(INLINE, (_match, body: string) => `$$${body.trim()}$$`)
}

/**
 * Rewrite `\(…\)` and `\[…\]` to the `$$` form the math plugin reads.
 * Code spans and fenced blocks keep their backslashes.
 */
export function normalizeMath(markdown: string) {
  return markdown
    .split(CODE)
    .map((part, index) => (index % 2 === 1 ? part : rewrite(part)))
    .join("")
}
