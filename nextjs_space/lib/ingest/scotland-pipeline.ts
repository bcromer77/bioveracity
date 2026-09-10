import { timingSafeEqual } from 'node:crypto'
import { bbox, page, fetchSEPARiverLevels, fetchNatureScotProtectedSites, fetchNatureScotHabitats, fetchScottishPlanningData } from './connectors-scotland'
import type { ConnectorResult, EvidenceInput } from './connectors-scotland'
type Receiver = (record: EvidenceInput) => Promise<{ duplicate: boolean; status: string }>
type Settings = { enabled?: string; secret?: string; writeEnabled?: string; acquisitionApproved?: string }
export function validCronKey(provided: string | null, expected?: string): boolean {
  // Require a newly generated 256-bit hex secret, not the publicly pasted phrase.
  if (!expected || !/^[a-f0-9]{64}$/i.test(expected) || !provided) return false
  const actual = Buffer.from(provided), wanted = Buffer.from(`Bearer ${expected}`)
  return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}
export async function handleScotlandPost(request: Request, settings: Settings, receive: Receiver,
  collect?: (offset: number, limit: number, bounds: string) => Promise<ConnectorResult[]>) {
  if (!settings.enabled || settings.enabled !== 'true') return Response.json({ error: 'Scottish intake disabled' }, { status: 503 })
  if (!validCronKey(request.headers.get('authorization'), settings.secret)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  let input: Record<string, unknown>
  try {
    const reader = request.body?.getReader(); let text = '', bytes = 0
    if (reader) {
      const decoder = new TextDecoder()
      while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length
        if (bytes > 4096) { await reader.cancel(); throw new Error('Oversized request') }
        text += decoder.decode(value, { stream: true })
      }
      text += decoder.decode()
    }
    const parsed: unknown = text ? JSON.parse(text) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid request')
    input = parsed as Record<string, unknown>
    if (Object.keys(input).some(k => !['offset','limit','bbox','dryRun'].includes(k))) throw new Error('Unknown option')
    if (input.dryRun !== undefined && typeof input.dryRun !== 'boolean') throw new Error('Invalid dryRun')
    page({ offset: input.offset as number | undefined, limit: input.limit as number | undefined })
    bbox(input.bbox === undefined ? '-4.5,55.8,-3.0,56.0' : String(input.bbox))
  } catch { return Response.json({ error: 'Invalid bounded request' }, { status: 400 }) }
  const dryRun = input.dryRun !== false
  if (!dryRun && settings.writeEnabled !== 'true') return Response.json({ error: 'Write activation required' }, { status: 503 })
  const { offset, limit } = page({ offset: input.offset as number | undefined, limit: input.limit as number | undefined })
  const bounds = String(input.bbox ?? '-4.5,55.8,-3.0,56.0')
  try {
    const results = await (collect ?? (async (offset, limit, bounds) => Promise.all([
      fetchSEPARiverLevels({ offset, limit }), fetchNatureScotProtectedSites(bounds, { offset, limit }),
      fetchNatureScotHabitats({ offset, limit }, bounds), fetchScottishPlanningData(),
    ])))(offset, limit, bounds)
    let created = 0, duplicates = 0, catalogueOnly = 0, failedWrites = 0
    const approved = new Set((settings.acquisitionApproved ?? '').split(',').map(s => s.trim()))
    for (const source of results) for (const record of source.records) {
      if (dryRun) continue
      try {
        const permitted = approved.has(source.source)
        const result = await receive({ ...record, acquisition_permitted: permitted })
        if (result.duplicate) duplicates++; else { created++; if (!permitted) catalogueOnly++ }
      } catch { failedWrites++ }
    }
    const incomplete = failedWrites > 0 || results.some(s => s.status !== 'ok')
    return Response.json({ success: !incomplete, dryRun, created, duplicates, catalogueOnly, failedWrites,
      totalFetched: results.reduce((n,s) => n+s.records.length,0),
      meaning: 'Source intake only; never automatic verification or publication. Follow nextOffset for more records.',
      sources: results.map(({ records, ...r }) => ({ ...r, fetched: records.length })) }, { status: incomplete ? 207 : 200 })
  } catch { return Response.json({ error: 'Scottish ingestion failed' }, { status: 502 }) }
}
