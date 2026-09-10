import { fork, execFile } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { WorkspaceError } from './service'
export type ParsedFile = { name: string; hash: string; bytes: string; mediaType: string; status: string; warnings: string[]; metadata: Record<string, unknown>; passages: { locator: string; text: string }[]; children: ParsedFile[] }
export async function scanFile(bytes: Buffer) {
  // Mandatory local scanner; never send private files to an external API.
  const directory = await mkdtemp(path.join(tmpdir(), 'bv-scan-'))
  try {
    const file = path.join(directory, 'input')
    await writeFile(file, bytes, { mode: 0o600 })
    await new Promise<void>((resolve, reject) => {
      execFile('clamscan', ['--no-summary', '--max-filesize=6M', '--max-scansize=25M', '--max-recursion=3', '--alert-exceeds-max=yes', file], { timeout: 20000, maxBuffer: 8192 }, error => error ? reject(new WorkspaceError(422, 'Malware scan did not pass or the scanner is unavailable. Nothing imported.')) : resolve())
    })
  } finally { await rm(directory, { recursive: true, force: true }) }
}
// Resolve the worker path at runtime so the production bundler's static
// analyzer never sees a literal module specifier for the forked script.
// The forked worker is a self-contained, pre-bundled ES module committed
// at public/parser/worker.mjs (see scripts/build-parser-worker.mjs). It inlines
// every heavy parser dependency, so it needs nothing from node_modules on the
// deployed host, and it ships automatically because the deploy step always
// copies public/ into the standalone artifact — independent of the
// platform-managed next.config.js file-tracing configuration.
// The path is assembled from parts (dynamic spread) so the analyzer treats the
// fork argument as opaque; an operator can override it with BV_PARSER_WORKER.
function resolveWorkerPath(): string {
  if (process.env.BV_PARSER_WORKER) return process.env.BV_PARSER_WORKER
  const segments = ['public', 'parser', ['worker', 'mjs'].join('.')]
  return path.join(process.cwd(), ...segments)
}
export async function parseIsolated(bytes: Buffer, name: string): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const child = fork(resolveWorkerPath(), [], {
      execArgv: ['--max-old-space-size=128'], stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      // Do not give parsers application secrets or inherited node injection flags.
      env: { PATH: process.env.PATH, LANG: 'C.UTF-8', NODE_ENV: 'production' },
    })
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new WorkspaceError(422, 'Parsing time limit exceeded. Nothing imported.')) }, 20000)
    child.once('message', (message: { result?: ParsedFile }) => {
      clearTimeout(timeout); child.kill()
      if (message.result) resolve(message.result)
      else reject(new WorkspaceError(422, 'Parsing failed: check file type, encryption and size. Nothing imported.'))
    })
    child.once('error', () => { clearTimeout(timeout); reject(new WorkspaceError(503, 'Parser unavailable')) })
    child.once('exit', () => { clearTimeout(timeout); reject(new WorkspaceError(422, 'Parser stopped before completion')) })
    child.send({ bytes: bytes.toString('base64'), name })
  })
}
