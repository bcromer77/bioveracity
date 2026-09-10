import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export class ScanError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// Only a successful local scan permits parsing. The injectable runner is for tests;
// application callers always use the default executable and fixed resource limits.
export async function scanLocalFile(bytes, run = execFile) {
  const directory = await mkdtemp(path.join(tmpdir(), 'bv-scan-'))
  try {
    const file = path.join(directory, 'input')
    await writeFile(file, bytes, { mode: 0o600 })
    await new Promise((resolve, reject) => {
      run('clamscan', ['--no-summary', '--max-filesize=6M', '--max-scansize=25M', '--max-recursion=3', '--alert-exceeds-max=yes', file], { timeout: 20000, maxBuffer: 8192 }, error => {
        if (!error) { resolve(); return }
        if (error.code === 1) {
          reject(new ScanError(422, 'This file did not pass the security scan. Nothing imported.'))
        } else if (error.code === 'ENOENT') {
          reject(new ScanError(503, 'Uploads are unavailable because the security scanner is not installed on the server. Nothing imported. Please contact the site operator.'))
        } else if (error.killed || error.code === 'ETIMEDOUT') {
          reject(new ScanError(503, 'The security scan could not finish in time. Nothing imported. Please try again; if this repeats, contact the site operator.'))
        } else {
          reject(new ScanError(503, 'The server could not complete the security scan. Nothing imported. The site operator needs to check the scanner and its signature database.'))
        }
      })
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
