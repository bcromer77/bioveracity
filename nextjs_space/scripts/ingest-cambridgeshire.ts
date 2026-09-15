import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { ingestRegion } from '../lib/cambridgeshire/ingest'
import { parseSnapshot } from '../lib/cambridgeshire/snapshot'
import { SNAPSHOT_LIMIT } from '../lib/cambridgeshire/model'

async function main() {
  const out = resolve(process.env.CAMBRIDGESHIRE_SNAPSHOT_PATH || '.cache/cambridgeshire/snapshot.json')
  const maxPages = Number(process.env.CAMBRIDGESHIRE_MAX_PAGES || 20)
  const result = parseSnapshot(await ingestRegion(async url => {
    const allowed = ['services1.arcgis.com', 'api.gbif.org']
    if (!allowed.includes(new URL(url).hostname)) throw new Error('Source not allowed')
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error', headers: { Accept: 'application/json' } })
    if (!response.ok || !response.body) throw new Error('Source unavailable')
    const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = []
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > SNAPSHOT_LIMIT) throw new Error('Response too large'); chunks.push(value) }
    } finally { await reader.cancel() }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  }, maxPages, c => console.log(JSON.stringify({ district: c.district, state: c.state, inspected: c.inspected, accepted: c.accepted }))))
  await mkdir(dirname(out), { recursive: true })
  // A failed refresh cannot erase a prior usable snapshot. Always write a
  // separate attempt receipt so outages remain inspectable by the operator.
  await writeFile(`${out}.attempt.json`, JSON.stringify({ generatedAt: result.generatedAt, coverage: result.coverage }, null, 2), { mode: 0o600 })
  let previous = null
  try { if ((await stat(out)).size <= SNAPSHOT_LIMIT) previous = parseSnapshot(JSON.parse(await readFile(out, 'utf8'))) } catch { /* no valid previous snapshot */ }
  if (previous && result.coverage.some(c => c.state === 'unavailable' || c.reason.includes('failed'))) {
    console.error('Refresh failed; previous snapshot retained. Inspect the attempt receipt.'); process.exitCode = 1; return
  }
  const text = JSON.stringify(result)
  if (Buffer.byteLength(text) > SNAPSHOT_LIMIT) throw new Error('Snapshot too large')
  const temporary = `${out}.${process.pid}.tmp`
  await writeFile(temporary, text, { mode: 0o600 }); await rename(temporary, out)
  console.log(JSON.stringify({ districts: result.coverage.map(c => ({ district: c.district, state: c.state, inspected: c.inspected, accepted: c.accepted })), groups: result.groups.length }))
  if (result.coverage.some(c => c.state !== 'complete')) process.exitCode = 2
}
main().catch(() => { console.error('Regional import failed. No production database was modified.'); process.exitCode = 1 })
