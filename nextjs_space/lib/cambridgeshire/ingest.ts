import { BOUNDARY_SERVICE, DISTRICTS, normalise, TAXA, type Coverage, type District, type OccurrenceGroup, type Snapshot } from './model'

type Position = [number, number]
export type Geometry = { type: 'Polygon'; coordinates: Position[][] } | { type: 'MultiPolygon'; coordinates: Position[][][] }
type Boundary = { properties: Record<string, unknown>; geometry: Geometry }
export type GetJson = (url: string) => Promise<unknown>
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
function inRing(p: Position, ring: Position[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}
export function contains(p: Position, geometry: Geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.some(rings => !!rings.length && inRing(p, rings[0]) && !rings.slice(1).some(r => inRing(p, r)))
}
function validGeometry(value: unknown): value is Geometry {
  const g = record(value)
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return false
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return Array.isArray(polygons) && polygons.length > 0 && polygons.every(p => Array.isArray(p) && p.length > 0 && p.every(r =>
    Array.isArray(r) && r.length >= 4 && r.every(v => Array.isArray(v) && v.length >= 2 &&
      typeof v[0] === 'number' && Number.isFinite(v[0]) && v[0] >= -180 && v[0] <= 180 &&
      typeof v[1] === 'number' && Number.isFinite(v[1]) && v[1] >= -90 && v[1] <= 90)))
}
function bounds(geometry: Geometry) {
  const coords = geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates.flat(2)
  return coords.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity])
}
const licences = new Set(['http://creativecommons.org/publicdomain/zero/1.0/legalcode', 'http://creativecommons.org/licenses/by/4.0/legalcode'])
export function eligible(value: unknown, geometry: Geometry) {
  const r = record(value)
  const licence = typeof r.license === 'string' ? r.license.replace(/^https:/, 'http:') : ''
  if (!licences.has(licence) || r.occurrenceStatus !== 'PRESENT' || r.countryCode !== 'GB' ||
    r.informationWithheld || r.dataGeneralizations || r.hasGeospatialIssues === true ||
    !Number.isSafeInteger(r.key) || !Number.isInteger(r.year) || Number(r.year) < 1600 || Number(r.year) > new Date().getUTCFullYear() ||
    typeof r.species !== 'string' || !r.species || typeof r.datasetKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(r.datasetKey) ||
    typeof r.decimalLongitude !== 'number' || !Number.isFinite(r.decimalLongitude) ||
    typeof r.decimalLatitude !== 'number' || !Number.isFinite(r.decimalLatitude) ||
    typeof r.coordinateUncertaintyInMeters !== 'number' || r.coordinateUncertaintyInMeters < 0 || r.coordinateUncertaintyInMeters > 1000 ||
    !contains([r.decimalLongitude, r.decimalLatitude], geometry)) return null
  const names = ['species', 'genus', 'family', 'order', 'class', 'kingdom'].map(k => typeof r[k] === 'string' ? normalise(String(r[k])) : '')
  return { key: r.key as number, taxon: r.species.slice(0, 160), year: r.year as number, licence,
    datasetKey: r.datasetKey, attribution: typeof r.datasetTitle === 'string' ? r.datasetTitle.slice(0, 240) : `GBIF dataset ${r.datasetKey}`, taxonKeys: Object.keys(TAXA).filter(k => names.includes(k)) }
}

/** Full refresh over all six district polygons; no Irish grid or taxon restriction.
 * maxPages is an inspection cap, never a completeness claim. Raw occurrence data
 * stays in memory and is never included in the public snapshot or logs. */
export async function ingestRegion(get: GetJson, maxPages = 20, onProgress?: (coverage: Coverage) => void): Promise<Snapshot> {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 300) throw new Error('maxPages must be 1–300')
  const now = new Date().toISOString()
  const coverage: Coverage[] = []
  const groups: OccurrenceGroup[] = []
  const seen = new Set<number>()
  for (const district of Object.keys(DISTRICTS) as District[]) {
    const c: Coverage = { district, source: 'gbif', state: 'unavailable', inspected: 0, accepted: 0, rejected: 0, duplicates: 0, nextOffset: 0, checkedAt: now, reason: '' }
    const grouped = new Map<string, OccurrenceGroup>()
    try {
      const params = new URLSearchParams({ where: `LAD24CD='${district}'`, outFields: 'LAD24CD,LAD24NM', outSR: '4326', f: 'geojson', returnGeometry: 'true' })
      const data = record(await get(`${BOUNDARY_SERVICE}/query?${params}`))
      const features = data.features
      if (!Array.isArray(features) || features.length !== 1) throw new Error('Expected one official district boundary')
      const f = features[0] as Boundary
      if (f.properties?.LAD24CD !== district || !validGeometry(f.geometry)) throw new Error('Invalid official district geometry')
      const [west, south, east, north] = bounds(f.geometry)
      for (let page = 0; page < maxPages; page++) {
        const offset = page * 300
        const query = new URLSearchParams({ country: 'GB', hasCoordinate: 'true', hasGeospatialIssue: 'false', occurrenceStatus: 'PRESENT',
          decimalLongitude: `${west},${east}`, decimalLatitude: `${south},${north}`, limit: '300', offset: String(offset) })
        const raw = record(await get(`https://api.gbif.org/v1/occurrence/search?${query}`))
        if (!Array.isArray(raw.results) || typeof raw.endOfRecords !== 'boolean' || raw.results.length > 300) throw new Error('Invalid occurrence page')
        for (const item of raw.results) {
          c.inspected++
          const r = eligible(item, f.geometry)
          if (!r) { c.rejected++; continue }
          if (seen.has(r.key)) { c.duplicates++; continue }
          seen.add(r.key); c.accepted++
          const key = JSON.stringify([r.taxon, r.licence, r.datasetKey])
          const existing = grouped.get(key)
          if (existing) { existing.count++; existing.firstYear = Math.min(existing.firstYear, r.year); existing.lastYear = Math.max(existing.lastYear, r.year) }
          else grouped.set(key, { id: '', district, taxon: r.taxon, count: 1, firstYear: r.year, lastYear: r.year, licence: r.licence, attribution: r.attribution, datasetKey: r.datasetKey, taxonKeys: r.taxonKeys })
        }
        c.nextOffset = offset + raw.results.length
        if (raw.endOfRecords) { c.state = 'complete'; c.reason = 'All pages of this bounded query inspected. Only eligible records included; no claim of complete biological coverage.'; break }
        c.state = 'partial'; c.reason = 'Inspection cap reached. More source records remain; this is not a complete district inventory.'
        if (!raw.results.length) throw new Error('Empty page without end-of-records')
      }
    } catch {
      // Never expose raw upstream exception text, which may contain record data.
      c.state = c.inspected ? 'partial' : 'unavailable'
      c.reason = 'Source retrieval or validation failed. Missing data does not establish ecological absence.'
    }
    groups.push(...[...grouped.values()].sort((a, b) => a.taxon.localeCompare(b.taxon) || a.attribution.localeCompare(b.attribution)).map((g, i) => ({ ...g, id: `${district}:${i}` })))
    coverage.push(c)
    onProgress?.({ ...c })
  }
  return { version: 1, generatedAt: now, boundarySource: BOUNDARY_SERVICE, coverage, groups }
}
