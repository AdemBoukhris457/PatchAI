type IncomingPart = {
  type?: string
  text?: string
}

type IncomingMessage = {
  role?: string
  parts?: IncomingPart[]
}

type Incoming = {
  id?: string
  messages?: IncomingMessage[]
}

function lastUserText(body: Incoming) {
  const messages = body.messages ?? []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== "user") {
      continue
    }
    return (message.parts ?? [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("")
  }
  return ""
}

export async function POST(request: Request) {
  let body: Incoming
  try {
    body = (await request.json()) as Incoming
  } catch {
    return new Response("The message could not be read.", { status: 400 })
  }

  const text = lastUserText(body).trim()
  if (!text) {
    return new Response("A message is required.", { status: 400 })
  }

  const threadId = body.id?.trim() || "web"
  const agentUrl = process.env.PATCHAI_URL ?? "http://127.0.0.1:8765/chat"

  try {
    const upstream = await fetch(agentUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, text }),
    })
    if (!upstream.ok || upstream.body === null) {
      const reply = await upstream.text()
      return new Response(reply || "PatchAI could not answer.", {
        status: 502,
      })
    }
    return new Response(upstream.body, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        "x-vercel-ai-ui-message-stream": "v1",
      },
    })
  } catch {
    return new Response(
      "PatchAI is not running. Start it with the web channel.",
      { status: 502 },
    )
  }
}
