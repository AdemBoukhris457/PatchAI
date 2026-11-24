/**
 * The README clip is a live conversation. This file stays so an older
 * command still records that conversation instead of a seeded thread.
 */

import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const script = resolve(dirname(fileURLToPath(import.meta.url)), "capture-live.mjs")
const child = spawn(process.execPath, [script], { stdio: "inherit" })
child.on("exit", (code) => process.exit(code ?? 1))
