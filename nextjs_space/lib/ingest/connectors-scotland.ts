/** Scottish source adapters. Raw source JSON is retained; ingestion is not verification. */
import { parseEvidenceDate } from '../evidence-contract'
export type EvidenceInput = {
  url: string; title: string; publisher: string; authority_id: string; jurisdiction: string;
  representation_id: string; content_kind: 'source_text'; retrieved_at: string;
  event_date: string | null; event_date_precision: 'unknown' | 'day' | 'month' | 'year'; publication_date: null;
  acquisition_permitted: boolean; sections: { locator: string; text: string }[];
}
export type RejectionNote = { locator: string | null; reason: RejectionReason }
export type ConnectorResult = {
  source: string; status: 'ok' | 'partial' | 'error' | 'blocked'; records: EvidenceInput[];
  nextOffset: number | null; rejected: number; rejections?: RejectionNote[]; error?: string; coverage: string;
}
export type Options = { fetcher?: typeof fetch; now?: () => Date; offset?: number; limit?: number }
export const SEPA_URL = 'https://timeseries.sepa.org.uk/KiWIS/KiWIS'
export const SSSI_URL = 'https://services1.arcgis.com/LM9GyVFsughzHdbO/arcgis/rest/services/Sites_of_Special_Scientific_Interest/FeatureServer/0'
const MAX_BYTES = 4 * 1024 * 1024
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid source object')
  return value as Record<string, unknown>
}
export function id(value: unknown): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || !String(value).trim() || String(value).length > 200) throw new Error('Missing source identity')
  return String(value)
}
export function page(options: Options) {
  const offset = options.offset ?? 0, limit = options.limit ?? 20
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Invalid page')
  return { offset, limit }
}
export function bbox(value: string) {
  const pieces = value.split(',')
  if (pieces.length !== 4 || pieces.some(x => !x.trim())) throw new Error('Invalid bounding box')
  const [w, s, e, n] = pieces.map(Number)
  if (![w,s,e,n].every(Number.isFinite) || w < -180 || e > 180 || s < -90 || n > 90 || w >= e || s >= n) throw new Error('Invalid bounding box')
  return [w,s,e,n].join(',')
}
export async function json(url: string, options: Options): Promise<unknown> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await (options.fetcher ?? fetch)(url, { headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal: controller.signal })
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Empty source response')
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      size += value.length
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Source response too large') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size); let at = 0
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length }
    const data = object(JSON.parse(new TextDecoder().decode(bytes)))
    if (data.error || data.errors) throw new Error('Upstream API error')
    return data
  } finally { clearTimeout(timer) }
}
export function record(url: string, title: string, publisher: string, authority: string, key: string, raw: unknown, retrieved: string, day: string | null = null): EvidenceInput {
  const text = JSON.stringify(raw)
  if (text.length > 95000) throw new Error('Source feature too large')
  return { url, title, publisher, authority_id: authority, jurisdiction: 'Scotland', representation_id: key,
    content_kind: 'source_text', retrieved_at: retrieved, event_date: day, event_date_precision: day ? 'day' : 'unknown',
    publication_date: null, acquisition_permitted: false,
    sections: [{ locator: key, text }] }
}
export function failure(source: string, coverage: string, error: unknown): ConnectorResult {
  // Never echo an upstream body or arbitrary error message.
  return { source, coverage, status: 'error', records: [], nextOffset: null, rejected: 0,
    error: error instanceof Error && /^Upstream HTTP \d{3}$/.test(error.message) ? error.message : 'Source unavailable or schema invalid' }
}
// Fixed allowlist of rejection reason codes. A skipped record is only ever tagged with one of
// these exact, developer-authored reasons; any other error collapses to the generic code, so an
// upstream body, arbitrary text or PII can never reach the report. Extend this list deliberately
// when a connector introduces a new validation throw.
export const REJECTION_REASONS = [
  'Wrong publisher or county', 'Wrong authority', 'Withheld/generalised source needs separate review',
  'Missing taxon', 'Missing source identity', 'Invalid source object', 'Source feature too large',
] as const
export type RejectionReason = typeof REJECTION_REASONS[number] | 'Rejected by validation'
const REJECTION_REASON_SET: ReadonlySet<string> = new Set(REJECTION_REASONS)
export function safeReason(error: unknown): RejectionReason {
  const message = error instanceof Error ? error.message : ''
  return (REJECTION_REASON_SET.has(message) ? message : 'Rejected by validation') as RejectionReason
}
export async function fetchSEPARiverLevels(options: Options = {}): Promise<ConnectorResult> {
  const source = 'sepa', coverage = 'Bounded page of latest SG river readings; excludes tidal series. Latest can be stale.'
  try {
    const { offset, limit } = page(options)
    const params = new URLSearchParams({ service: 'kisters', type: 'queryServices', datasource: '0', request: 'getTimeseriesValueLayer', timeseriesgroup_id: '41804', format: 'geojson', returnfields: 'timestamp,ts_value,q_code', metadata: 'true', md_returnfields: 'station_name,station_no,ts_path' })
    const data = object(await json(`${SEPA_URL}?${params}`, options))
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid feature collection')
    // Stable order for bounded paging. It is a changing latest-values view, not a snapshot.
    const rows = data.features.filter(f => String(object(object(f).properties).ts_path).includes('/SG/'))
      .sort((a,b) => String(object(object(a).properties).ts_path).localeCompare(String(object(object(b).properties).ts_path)))
    const records: EvidenceInput[] = []; let rejected = 0
    const retrieved = (options.now?.() ?? new Date()).toISOString()
    for (const raw of rows.slice(offset, offset + limit)) {
      try {
        const p = object(object(raw).properties), key = id(p.ts_path), station = id(p.station_no)
        if (typeof p.ts_value !== 'number' || !Number.isFinite(p.ts_value)) throw new Error('Missing reading')
        const stamp = p.timestamp
        if (typeof stamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(stamp) || !Number.isFinite(Date.parse(stamp))) throw new Error('Invalid observation timestamp')
        const day = stamp.slice(0,10)
        if (new Date(day + 'T00:00:00Z').toISOString().slice(0,10) !== day) throw new Error('Invalid observation date')
        const query = new URLSearchParams({ service: 'kisters', type: 'queryServices', datasource: '0', request: 'getTimeseriesValues', ts_path: key, format: 'json', from: stamp, to: stamp })
        records.push(record(`${SEPA_URL}?${query}`, `SEPA river level: ${String(p.station_name ?? station).slice(0,200)}`, 'SEPA', 'uk:sepa', `sepa:${key}:${stamp}`, raw, retrieved, day))
      } catch { rejected++ }
    }
    return { source, coverage, status: rejected ? 'partial' : 'ok', records, rejected,
      nextOffset: offset + limit < rows.length ? offset + limit : null }
  } catch (e) { return failure(source, coverage, e) }
}
export async function fetchNatureScotProtectedSites(bounds = '-4.5,55.8,-3.0,56.0', options: Options = {}): Promise<ConnectorResult> {
  const source = 'naturescot-sssi', coverage = 'SSSI attribute records intersecting the requested bbox; geometry omitted, no centroid inferred.'
  try {
    const { offset, limit } = page(options)
    const params = new URLSearchParams({ where: '1=1', outFields: 'OBJECTID,PA_CODE,NAME,STATUS,TYPE,SITE_HA,UPDATED', geometry: bbox(bounds), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'false', orderByFields: 'OBJECTID ASC', resultOffset: String(offset), resultRecordCount: String(limit), f: 'json' })
    const data = object(await json(`${SSSI_URL}/query?${params}`, options))
    if (!Array.isArray(data.features)) throw new Error('Missing features')
    const records: EvidenceInput[] = []; let rejected = 0
    const retrieved = (options.now?.() ?? new Date()).toISOString()
    for (const raw of data.features.slice(0,limit)) {
      try {
        const a = object(object(raw).attributes), oid = id(a.OBJECTID), code = id(a.PA_CODE)
        if (typeof a.NAME !== 'string' || !a.NAME.trim()) throw new Error('Missing name')
        const query = new URLSearchParams({ objectIds: oid, outFields: 'OBJECTID,PA_CODE,NAME,STATUS,TYPE,SITE_HA,UPDATED', returnGeometry: 'false', f: 'json' })
        records.push(record(`${SSSI_URL}/query?${query}`, `NatureScot SSSI: ${a.NAME}`, 'NatureScot', 'uk:naturescot', `sssi:${code}:object:${oid}`, raw, retrieved))
      } catch { rejected++ }
    }
    return { source, coverage, status: rejected ? 'partial' : 'ok', records, rejected,
      nextOffset: data.exceededTransferLimit === true || data.features.length > limit ? offset + limit : null }
  } catch (e) { return failure(source, coverage, e) }
}
export const HABITATS_URL = 'https://ogc.nature.scot/geoserver/habitatsandspecies/wfs'
export async function fetchNatureScotHabitats(options: Options = {}, bounds = '-4.5,55.8,-3.0,56.0'): Promise<ConnectorResult> {
  const source = 'naturescot-habitats', coverage = 'Bounded HabMoS habitat polygons, not species sightings or a complete ecological survey; dates retain source precision.'
  try {
    const { offset, limit } = page(options)
    const params = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'habitatsandspecies:habmos', outputFormat: 'application/json', count: String(limit), startIndex: String(offset), srsName: 'CRS:84', bbox: bbox(bounds) + ',urn:ogc:def:crs:OGC:1.3:CRS84', sortBy: 'POLYGON_ID A,HAB_NUMBER A' })
    const data = object(await json(`${HABITATS_URL}?${params}`, options))
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid habitat response')
    const records: EvidenceInput[] = []; let rejected = 0
    const retrieved = (options.now?.() ?? new Date()).toISOString()
    for (const raw of data.features.slice(0,limit)) {
      try {
        const f = object(raw), key = id(f.id), p = object(f.properties)
        if (typeof p.HABITAT_NAME !== 'string' || !p.HABITAT_NAME.trim()) throw new Error('Missing habitat name')
        const date = parseEvidenceDate(p.SURVEY_DATE)
        const query = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'habitatsandspecies:habmos', resourceID: key, outputFormat: 'application/json', srsName: 'CRS:84' })
        const r = record(`${HABITATS_URL}?${query}`, `NatureScot habitat: ${p.HABITAT_NAME}`, 'NatureScot', 'uk:naturescot', `habmos:${key}`, raw, retrieved)
        r.event_date = date.value; r.event_date_precision = date.precision
        records.push(r)
      } catch { rejected++ }
    }
    const count = typeof data.numberMatched === 'number' ? data.numberMatched : null
    const more = count === null ? data.features.length >= limit : offset + data.features.length < count
    return { source, coverage, status: rejected ? 'partial' : 'ok', records, rejected, nextOffset: more ? offset + limit : null }
  } catch (e) { return failure(source, coverage, e) }
}
export async function fetchScottishPlanningData(): Promise<ConnectorResult> {
  return { source: 'glasgow-planning', status: 'blocked', records: [], rejected: 0, nextOffset: null,
    coverage: 'Glasgow only; not all Scottish councils', error: 'Official weekly-list app discovered, but its backing service returned 403. No access bypass or fabricated records.' }
}
