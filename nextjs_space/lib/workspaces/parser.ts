import { fork } from 'node:child_process'
import path from 'node:path'
import { WorkspaceError } from './service'
import { scanBytes, ScanError } from './scan-file.mjs'

export type ParsedFile = { name: string; hash: string; bytes: string; mediaType: string; status: string; warnings: string[]; metadata: Record<string, unknown>; passages: { locator: string; text: string }[]; children: ParsedFile[] }

// --- Format allowlist for the evaluation period ---
// Requirement §6: "Check scanning coverage for DOCX contents and EML attachments.
// Do not assume the outer file's verdict covers every embedded item. Keep any
// unvalidated format blocked during the evaluation."
//
// Cloudmersive scans the outer file bytes but does NOT recursively scan:
//   - EML attachments (children parsed by parse-file.mjs)
//   - Arbitrary OLE/embedded objects that might bypass the outer scan
//
// During the evaluation, only formats whose full content the scanner CAN validate
// are permitted.  Everything else is blocked with a clear UI message.
const ALLOWED_EXTENSIONS = new Set(['pdf', 'txt', 'csv'])

export function checkFormatAllowed(name: string): void {
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const blocked: Record<string, string> = {
      docx: 'DOCX files may contain macros and embedded objects that the scanner cannot fully verify during this evaluation. Convert to PDF and re-upload.',
      eml:  'Email files (.eml) may contain attachments the scanner cannot individually verify during this evaluation. Save the email body as PDF and re-upload.',
      png:  'Image uploads are not scanned during this evaluation. Add a text note instead.',
      jpg:  'Image uploads are not scanned during this evaluation. Add a text note instead.',
      jpeg: 'Image uploads are not scanned during this evaluation. Add a text note instead.',
      mp3:  'Audio uploads are not scanned during this evaluation. Add a text note instead.',
      wav:  'Audio uploads are not scanned during this evaluation. Add a text note instead.',
    }
    throw new WorkspaceError(422, blocked[ext] || `The file type ".${ext}" is not accepted during this evaluation. Convert to PDF or plain text and re-upload.`)
  }
}

// --- Maximum file size for the evaluation (3,000,000 bytes as per brief §4) ---
export const MAX_EVAL_BYTES = 3_000_000

/**
 * Scan bytes via Cloudmersive before permitting parsing.
 * Reads the API key from the environment; never exposes it to the client.
 */
export async function scanFile(bytes: Buffer, apiKey: string) {
  try {
    await scanBytes(bytes, apiKey)
  } catch (error) {
    if (error instanceof ScanError) throw new WorkspaceError(error.status, error.message)
    throw new WorkspaceError(503, 'The server could not prepare the security scan. Nothing imported. Please contact the site operator.')
  }
}

// Resolve the worker path at runtime so the production bundler's static
// analyzer never sees a literal module specifier for the forked script.
function resolveWorkerPath(): string {
  if (process.env.BV_PARSER_WORKER) return process.env.BV_PARSER_WORKER
  const segments = ['public', 'parser', ['worker', 'mjs'].join('.')]
  return path.join(process.cwd(), ...segments)
}

export async function parseIsolated(bytes: Buffer, name: string): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const child = fork(resolveWorkerPath(), [], {
      execArgv: ['--max-old-space-size=128'], stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
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
