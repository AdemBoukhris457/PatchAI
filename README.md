# PatchAI

PatchAI is a local chatbot. A [Deep Agents](https://github.com/langchain-ai/deepagents) harness answers each turn. The harness never talks to a browser or a terminal itself. A channel adapter does that, and plugins add tools.

The default setup is a web chat at <http://localhost:3000> and an agent at <http://127.0.0.1:8765>. A CLI channel is included for the same agent.

## What a conversation can do

- Chat with streaming replies, and pick a model and a reasoning effort in the composer.
- Open an interactive report beside the thread: text, figures, tables, charts, and diagrams. Controls in the report update the figures without another model call.
- Create and revise a PDF or a PowerPoint. Files land in `exports/`, and the thread shows a card for each one.
- List what this thread holds. Output is what the assistant made. Input is what you attached.
- Answer the time, look up US flood-insurance claims, and call the tools in `mcp.json`.

## Requirements

- Python 3.11 or newer
- Node.js 22
- An API key for the model in `.env`

The default model is `openai:gpt-6-luna`. PDF and PowerPoint plugins are on in `config.toml`, so the matching Python extras are part of a normal install. Interactive reports also need the Node packages in `web/`.

## Run the web chat

From the repository root:

```bash
python -m venv .venv
```

Windows:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -e ".[pdf,pptx]"
copy .env.example .env
```

macOS and Linux:

```bash
source .venv/bin/activate
pip install -e ".[pdf,pptx]"
cp .env.example .env
```

Put your key in `.env`. The file is gitignored.

```text
OPENAI_API_KEY=sk-...
PATCHAI_MODEL=openai:gpt-6-luna
```

`PATCHAI_MODEL` overrides `[model].name` in `config.toml`. Leave it unset to use the file.

Start the agent, then the page. Use two terminals, both from the repository root for the first and from `web/` for the second.

```bash
python -m patchai
```

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:3000>. The page posts each turn to `http://127.0.0.1:8765/chat`. Set `PATCHAI_URL` in the web process if the agent listens somewhere else.

Try one of these in a new thread:

```text
Make an interactive dashboard comparing three weekend trip options: train to Lyon, a rental car to the coast, and a flight to Lisbon. Use a short takeaway, three key figures, a comparison table, and a bar chart of total cost. Add a control that switches the party size from 1 to 4 and updates the cost figures.
```

```text
Make a one-page PDF titled Hello with one short paragraph that says hello.
```

```text
What time is it right now?
```

## Run it in the terminal

Set the channel, then start the same process:

```toml
[channel]
active = "cli"
```

```bash
python -m patchai
```

Each line is one turn. A blank line ends the session. The CLI prints the finished reply. The browser is what draws reports, PDFs, and decks.

## Configuration

`config.toml` chooses the channel, the model, the plugins, and the MCP file.

```toml
[channel]
active = "web"

[model]
name = "openai:gpt-6-luna"

[plugins]
enabled = ["example_clock", "openfema_flood", "pdf_report", "pptx_deck", "report"]

[mcp]
config = "mcp.json"
```

`[model.options.openai]` is passed through to the chat model. The page can still switch among the chat models and efforts for a single turn.

`mcp.json` lists MCP servers. A server that cannot be reached is skipped. The plugins still load.

## Where things live

| Path | Role |
| --- | --- |
| `src/patchai/` | The agent, channels, and plugins |
| `web/` | The Next.js chat |
| `skills/` | Procedures the agent reads when a task needs them |
| `memory/AGENTS.md` | Standing instructions for the agent |
| `exports/` | PDFs and PowerPoints. Gitignored |
| `.env` | Secrets and `PATCHAI_MODEL`. Gitignored |

Chats stay in the browser. The agent process keeps the thread, saved preferences, and in-progress report specs in memory, so those are gone when the process exits. The page sends the visible thread again with the next message. A PDF or PowerPoint in `exports/` stays on disk.

## Plugins

A plugin is a module at `src/patchai/plugins/<name>.py` (or a package of that name) that exports `plugin` with a `name` and a `tools()` method. Add the module name to `[plugins].enabled`.

| Name | What it adds |
| --- | --- |
| `example_clock` | Current UTC time |
| `openfema_flood` | US NFIP flood-claim counts from the public OpenFEMA API |
| `pdf_report` | Create, read, and update a PDF |
| `pptx_deck` | Create, read, and update a PowerPoint |
| `report` | An interactive report rendered in the web chat |

`report` checks the spec with `web/scripts/render-spec.mjs`, so `npm install` inside `web/` has to have been run.

## Tests

```bash
pip install -e ".[dev,pdf,pptx]"
pytest
```

From `web/`:

```bash
npm run typecheck
```

## License

[MIT](LICENSE)
