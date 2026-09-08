import { timingSafeEqual } from 'node:crypto'

export function evidenceEnabled() { return process.env.BIOVERACITY_EVIDENCE_ENABLED === 'true' }
export function validIngestKey(provided: string | null) {
  const expected = process.env.BIOVERACITY_EVIDENCE_INGEST_KEY
  if (!expected || expected.length < 32 || !provided) return false
  const a = Buffer.from(expected), b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}
export async function boundedJson(request: Request, maxBytes = 1000000) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Body required')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > maxBytes) { await reader.cancel(); throw new Error('Request too large') }
    chunks.push(value)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
