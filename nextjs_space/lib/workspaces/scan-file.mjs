// Server-side malware scanning via Cloudmersive Virus Scan Advanced API.
// Replaces the previous clamscan binary dependency that could not run on
// the hosted production runtime.
//
// Design constraints (from the brief):
// • Permit parsing ONLY after an explicit, completed clean verdict.
// • Missing keys, timeouts, quota exhaustion, provider errors,
//   malformed responses and incomplete scans block import.
// • Never bypass scanning or treat HTTP 200 alone as a clean result.
// • Send a neutral filename; avoid logging document contents.
// • Keep bytes in memory — never write to disk or create public URLs.
// • Per-process rate limiter: max 1 call/sec (free-tier constraint).

export class ScanError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// Per-process pacing — serialise calls at ≤1/sec.
let lastCallMs = 0

/**
 * Scan raw file bytes for malware via Cloudmersive.
 *
 * @param {Buffer} bytes    – the exact original file bytes.
 * @param {string} apiKey   – Cloudmersive API key (server env only).
 * @param {object} [opts]   – { timeoutMs, fetchFn } for test injection.
 * @returns {Promise<void>}   Resolves on a clean verdict; rejects with ScanError otherwise.
 */
export async function scanBytes(bytes, apiKey, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 25000
  const fetchFn   = opts.fetchFn   ?? globalThis.fetch

  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
    throw new ScanError(503, 'Uploads are unavailable because the security-scanner key is not configured on the server. Nothing imported.')
  }

  // Per-process rate limiter: wait until ≥1 s since last call.
  const now = Date.now()
  const gap = 1000 - (now - lastCallMs)
  if (gap > 0) await new Promise(r => setTimeout(r, gap))
  lastCallMs = Date.now()

  // Build multipart/form-data with a neutral filename.
  // The Cloudmersive /virus/scan/file/advanced endpoint expects the file
  // in a field named "inputFile".
  const boundary = '----BVScan' + Date.now().toString(36)
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="inputFile"; filename="upload.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`
  )
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([header, bytes, footer])

  let response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    response = await fetchFn('https://api.cloudmersive.com/virus/scan/file/advanced', {
      method: 'POST',
      headers: {
        'Apikey': apiKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        // Allow files that don't strictly conform to their format spec.
        // We enforce our own format allowlist (PDF/TXT/CSV); the
        // structural-conformance check produces false positives on
        // legitimate generated PDFs. Virus/malware/macro/script checks
        // still run fully.
        'allowInvalidFiles': 'true',
      },
      body,
      signal: controller.signal,
    })
    clearTimeout(timer)
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ScanError(503, 'The security scan could not finish in time. Nothing imported. Please try again shortly.')
    }
    throw new ScanError(503, 'The server could not reach the security-scanning service. Nothing imported. Please try again shortly.')
  }

  // Non-200 statuses.
  if (response.status === 401 || response.status === 403) {
    throw new ScanError(503, 'The security-scanner API key is invalid or expired. Nothing imported. Please contact the site operator.')
  }
  if (response.status === 429) {
    throw new ScanError(503, 'The security-scanning service rate limit has been reached. Nothing imported. Please wait a minute and try again.')
  }
  if (!response.ok) {
    throw new ScanError(503, `The security-scanning service returned an error (HTTP ${response.status}). Nothing imported. Please try again shortly.`)
  }

  // Parse the JSON response.
  let result
  try {
    result = await response.json()
  } catch {
    throw new ScanError(503, 'The security-scanning service returned a malformed response. Nothing imported. The scan result could not be verified.')
  }

  // STRICT verdict: only an explicit CleanResult === true is accepted.
  // Anything else — false, null, undefined, missing — is a rejection.
  if (result.CleanResult !== true) {
    // Distinguish actual malware detection from ambiguous/incomplete scans.
    if (result.CleanResult === false) {
      const virusNames = (result.FoundViruses || [])
        .map(v => v?.VirusName).filter(Boolean).join(', ')
      throw new ScanError(422, virusNames
        ? `This file did not pass the security scan (threat detected: ${virusNames}). Nothing imported.`
        : 'This file did not pass the security scan. Nothing imported.')
    }
    // CleanResult is neither true nor false — treat as incomplete/ambiguous.
    throw new ScanError(503, 'The security scan returned an ambiguous result. Nothing imported. The scan could not confirm the file is clean.')
  }

  // Additional Cloudmersive advanced-scan flags — block risky content
  // even when the virus signature check itself was clean.
  if (result.ContainsExecutable) throw new ScanError(422, 'This file contains executable code. Nothing imported.')
  if (result.ContainsMacros)     throw new ScanError(422, 'This file contains macros. Nothing imported.')
  if (result.ContainsScript)     throw new ScanError(422, 'This file contains embedded scripts. Nothing imported.')
  if (result.ContainsXmlExternalEntities) throw new ScanError(422, 'This file contains XML external entities. Nothing imported.')
  if (result.ContainsInsecureDeserialization) throw new ScanError(422, 'This file contains insecure serialisation. Nothing imported.')
  if (result.ContainsUnsafeArchive) throw new ScanError(422, 'This file is an unsafe archive. Nothing imported.')

  // Clean + no risky flags → file is accepted.
}
