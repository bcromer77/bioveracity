import { cellsBounds, pointInCell, type Cell } from './geometry'
import { filterHits, validDay } from './search'
import type { HoneycombCoverage, HoneycombHit, HoneycombQuery, HoneycombResponse } from './types'

const NPWS =
  'https://services-eu1.arcgis.com/Jhij7i46ouO8Cc0N/arcgis/rest/services/NPWSDesignatedAreas/FeatureServer'
const PLANNING =
  'https://services.arcgis.com/NzlPQPKn5QF9v2US/arcgis/rest/services/IrishPlanningApplications/FeatureServer/0'
const GBIF = 'https://api.gbif.org/v1/occurrence/search'
const designationLayers = [
  { id: 0, slug: 'spa', name: 'SPA' },
  { id: 1, slug: 'pnha', name: 'Proposed NHA' },
  { id: 2, slug: 'nha', name: 'NHA' },
  { id: 3, slug: 'sac', name: 'SAC' }
]
type Page = Record<string, any>
type Batch = { hits: HoneycombHit[]; coverage: HoneycombCoverage }
export type ProviderOptions = { request?: typeof fetch; signal?: AbortSignal; now?: () => Date }
const text = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const coordinate = (lat: unknown, lng: unknown): boolean =>
  finite(lat) && finite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
const sourceId = (v: unknown) =>
  (typeof v === 'string' || typeof v === 'number') && /^[\w.-]{1,100}$/.test(String(v)) ? String(v) : ''

// Read-only, fixed upstream hosts, bounded response sizes and one total search deadline.
export async function fetchJson(url: string, options: ProviderOptions): Promise<Page> {
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(8000)])
    : AbortSignal.timeout(8000)
  const response = await (options.request ?? fetch)(url, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    redirect: 'error'
  })
  if (!response.ok || Number(response.headers.get('content-length')) > 3_000_000)
    throw Error('Source unavailable')
  const reader = response.body?.getReader()
  if (!reader) throw Error('Missing source response')
  const parts: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 3_000_000) {
        await reader.cancel()
        throw Error('Source response too large')
      }
      parts.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }
  const data = JSON.parse(new TextDecoder().decode(bytes))
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.error)
    throw Error('Invalid source response')
  return data
}
async function pool<T, R>(items: T[], limit: number, operation: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = new Array(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = cursor++
        if (i >= items.length) break
        output[i] = await operation(items[i])
      }
    })
  )
  return output
}
export function sourceDate(raw: unknown): Pick<HoneycombHit, 'eventDate' | 'datePrecision'> {
  const value = text(raw, 80)
  if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && validDay(value.slice(0, 10)))
    return { eventDate: value.slice(0, 10), datePrecision: 'day' }
  if (/^\d{4}-\d{2}$/.test(value) && validDay(`${value}-01`))
    return { eventDate: value, datePrecision: 'month' }
  if (/^\d{4}$/.test(value) && Number(value) > 0) return { eventDate: value, datePrecision: 'year' }
  return { eventDate: null, datePrecision: 'unknown' }
}
export async function fetchDesignations(cells: Cell[], options: ProviderOptions): Promise<Batch[]> {
  const tasks = designationLayers.flatMap((layer) => cells.map((cell) => ({ layer, cell })))
  const parts = await pool(tasks, 4, async ({ layer, cell }) => {
    const hits: HoneycombHit[] = []
    let status: HoneycombCoverage['status'] = 'ok'
    let skipped = 0
    try {
      // NPWS performs polygon intersection; a site's centroid is never substituted.
      const params = new URLSearchParams({
        f: 'json',
        where: '1=1',
        geometry: JSON.stringify({
          rings: [cell.ring.map((p) => [p.lng, p.lat])],
          spatialReference: { wkid: 4326 }
        }),
        geometryType: 'esriGeometryPolygon',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: 'SITECODE,SITE_NAME,VERSION,HA',
        returnGeometry: 'false',
        resultRecordCount: '100'
      })
      const data = await fetchJson(`${NPWS}/${layer.id}/query?${params}`, options)
      if (!Array.isArray(data.features)) throw Error('Invalid features')
      if (data.exceededTransferLimit === true || data.features.length >= 100) status = 'partial'
      for (const feature of data.features.slice(0, 100)) {
        const a = feature?.attributes
        if (!a || !/^\d{6}$/.test(a.SITECODE) || !text(a.SITE_NAME)) {
          skipped++
          continue
        }
        const code = String(a.SITECODE)
        hits.push({
          id: `npws:${layer.slug}:${code}`,
          kind: 'designation',
          title: text(a.SITE_NAME),
          sourceUrl:
            layer.slug === 'pnha'
              ? `${NPWS}/${layer.id}/query?${new URLSearchParams({ f: 'json', where: `SITECODE='${code}'`, outFields: 'SITECODE,SITE_NAME,VERSION,HA', returnGeometry: 'false' })}`
              : `https://www.npws.ie/protected-sites/${layer.slug}/${code}`,
          publisher: 'National Parks & Wildlife Service',
          licence: 'CC BY 4.0',
          eventDate: null,
          datePrecision: 'unknown',
          cellIds: [cell.id],
          spatialRelation: 'site-intersects-cell',
          matchReason:
            layer.slug === 'pnha'
              ? 'NPWS reports that this proposed Natural Heritage Area intersects the cell. Proposed status is not a statutory designation or a species sighting.'
              : 'NPWS reports that the designated site intersects this search cell. This does not establish a species sighting.',
          details: `${layer.name} · Site ${code}${finite(a.VERSION) ? ` · Boundary version ${a.VERSION}` : ''}${finite(a.HA) && a.HA >= 0 ? ` · ${a.HA.toFixed(1)} hectares across the whole site` : ''}. © Government of Ireland / NPWS. Species qualifying interests are not included in this boundary response.`
        })
      }
      if (skipped) status = 'partial'
    } catch {
      status = hits.length ? 'partial' : 'error'
    }
    return { layer, hits, status, skipped }
  })
  return designationLayers.map((layer) => {
    const selected = parts.filter((p) => p.layer.id === layer.id)
    const hits = selected.flatMap((p) => p.hits)
    const status = selected.every((p) => p.status === 'error')
      ? 'error'
      : selected.some((p) => p.status !== 'ok')
        ? 'partial'
        : 'ok'
    return {
      hits,
      coverage: {
        id: `npws-${layer.slug}`,
        label: `NPWS ${layer.name}`,
        status,
        returned: new Set(hits.map((h) => h.id)).size,
        note:
          status === 'error'
            ? 'This designation source could not be checked.'
            : `Boundary intersections only; no species observations. ${status === 'partial' ? 'One or more cell queries failed, were capped or contained invalid records; coverage is incomplete.' : 'All selected cells checked against this service.'}`
      }
    }
  })
}
export async function fetchPlanning(cells: Cell[], options: ProviderOptions): Promise<Batch> {
  const hits: HoneycombHit[] = []
  let status: HoneycombCoverage['status'] = 'ok'
  let skipped = 0
  try {
    const b = cellsBounds(cells)
    for (let page = 0; page < 2; page++) {
      const fields = 'OBJECTID,PlanningAuthority,ApplicationNumber,ApplicationStatus,ReceivedDate'
      const params = new URLSearchParams({
        f: 'json',
        where: '1=1',
        geometry: `${b.west},${b.south},${b.east},${b.north}`,
        geometryType: 'esriGeometryEnvelope',
        inSR: '4326',
        outSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: fields,
        returnGeometry: 'true',
        orderByFields: 'ReceivedDate DESC,OBJECTID DESC',
        resultRecordCount: '100',
        resultOffset: String(page * 100)
      })
      const data = await fetchJson(`${PLANNING}/query?${params}`, options)
      if (!Array.isArray(data.features)) throw Error('Invalid features')
      for (const f of data.features.slice(0, 100)) {
        const a = f?.attributes,
          g = f?.geometry,
          oid = sourceId(a?.OBJECTID)
        if (!oid || !g || !coordinate(g.y, g.x) || !text(a.ApplicationNumber) || !text(a.PlanningAuthority)) {
          skipped++
          continue
        }
        const location = { lat: g.y, lng: g.x },
          cellIds = cells.filter((c) => pointInCell(location, c)).map((c) => c.id)
        if (!cellIds.length) continue
        const date =
          finite(a.ReceivedDate) && Number.isFinite(new Date(a.ReceivedDate).getTime())
            ? sourceDate(new Date(a.ReceivedDate).toISOString())
            : sourceDate(null)
        const query = new URLSearchParams({
          f: 'json',
          objectIds: oid,
          outFields: fields,
          returnGeometry: 'true',
          outSR: '4326'
        })
        hits.push({
          id: `planning:${oid}`,
          kind: 'planning',
          title: `Planning application ${text(a.ApplicationNumber)}`,
          sourceUrl: `${PLANNING}/query?${query}`,
          publisher: text(a.PlanningAuthority),
          licence: 'CC BY 4.0',
          ...date,
          location,
          precisionMeters: null,
          cellIds,
          spatialRelation: 'reported-point-in-cell',
          matchReason:
            'The application’s published map point lies in this cell; it is not the development boundary.',
          details: `${text(a.ApplicationStatus) || 'Status not supplied'}. Date is application receipt date. National planning metadata; proposal documents and objections have not been searched.`
        })
      }
      const more = data.exceededTransferLimit === true || data.features.length >= 100
      if (!more) break
      if (page === 1) status = 'partial'
    }
    if (skipped) status = 'partial'
  } catch {
    status = hits.length ? 'partial' : 'error'
  }
  return {
    hits,
    coverage: {
      id: 'planning',
      label: 'Irish planning applications',
      status,
      returned: new Set(hits.map((h) => h.id)).size,
      note: `Published application points; at most 200 newest records from the enclosing box are inspected before cell and text filtering. ${status !== 'ok' ? 'Retrieval was incomplete or unavailable. ' : ''}${skipped ? `${skipped} malformed records omitted. ` : ''}This is not complete planning history.`
    }
  }
}
export async function fetchSpecies(cells: Cell[], options: ProviderOptions): Promise<Batch> {
  const hits: HoneycombHit[] = []
  let status: HoneycombCoverage['status'] = 'ok',
    excluded = 0
  try {
    const b = cellsBounds(cells)
    for (let page = 0; page < 2; page++) {
      const params = new URLSearchParams({
        taxonKey: '734',
        country: 'IE',
        hasCoordinate: 'true',
        decimalLatitude: `${b.south},${b.north}`,
        decimalLongitude: `${b.west},${b.east}`,
        limit: '100',
        offset: String(page * 100)
      })
      const data = await fetchJson(`${GBIF}?${params}`, options)
      if (!Array.isArray(data.results)) throw Error('Invalid records')
      for (const a of data.results.slice(0, 100)) {
        const key = sourceId(a?.key),
          uncertainty = a?.coordinateUncertaintyInMeters,
          licence = text(a?.license)
        // Retain only reusable, non-generalised records with stated uncertainty.
        if (!speciesAllowed(a)) {
          excluded++
          continue
        }
        const location = { lat: a.decimalLatitude, lng: a.decimalLongitude },
          cellIds = cells.filter((c) => pointInCell(location, c)).map((c) => c.id)
        if (!cellIds.length) continue
        const date = sourceDate(a.eventDate)
        hits.push({
          id: `gbif:${key}`,
          kind: 'species',
          title: text(a.scientificName),
          sourceUrl: `https://www.gbif.org/occurrence/${key}`,
          publisher: `${text(a.institutionCode) || 'Record publisher'} via GBIF`,
          licence,
          ...date,
          location,
          precisionMeters: uncertainty,
          cellIds,
          spatialRelation: 'reported-point-in-cell',
          matchReason: `The reported coordinate lies in this cell. Source coordinate uncertainty: ${uncertainty} m; the possible location may extend outside the cell.`,
          details: `${text(a.basisOfRecord) || 'Occurrence record'}. Historical bat record, not a current-presence claim. Dataset ${text(a.datasetKey)}.`
        })
      }
      if (data.endOfRecords === true) break
      if (page === 1) status = 'partial'
    }
    if (excluded) status = 'partial'
  } catch {
    status = hits.length ? 'partial' : 'error'
  }
  return {
    hits,
    coverage: {
      id: 'bats',
      label: 'Bat observations via GBIF',
      status,
      returned: new Set(hits.map((h) => h.id)).size,
      note: `Bats only; at most 200 source records inspected. ${excluded} records omitted for reuse, sensitivity, location uncertainty or validation restrictions. ${status === 'error' ? 'This source could not be checked. ' : status === 'partial' ? 'Coverage is incomplete. ' : ''}No matches does not establish absence of bats.`
    }
  }
}
function speciesAllowed(a: any): boolean {
  return Boolean(
    a &&
    sourceId(a.key) &&
    a.countryCode === 'IE' &&
    a.order === 'Chiroptera' &&
    coordinate(a.decimalLatitude, a.decimalLongitude) &&
    a.occurrenceStatus === 'PRESENT' &&
    text(a.scientificName) &&
    !a.informationWithheld &&
    !a.dataGeneralizations &&
    finite(a.coordinateUncertaintyInMeters) &&
    a.coordinateUncertaintyInMeters > 0 &&
    a.coordinateUncertaintyInMeters < 5000 &&
    /^https?:\/\/creativecommons\.org\/(?:publicdomain\/zero\/1\.0|licenses\/by\/4\.0)\/?$/.test(
      text(a.license)
    )
  )
}
export async function runHoneycombSearch(
  query: HoneycombQuery,
  options: ProviderOptions = {}
): Promise<HoneycombResponse> {
  const deadline = AbortSignal.timeout(24000)
  const bounded = {
    ...options,
    signal: options.signal ? AbortSignal.any([options.signal, deadline]) : deadline
  }
  const [npws, planning, species] = await Promise.all([
    fetchDesignations(query.cells, bounded),
    fetchPlanning(query.cells, bounded),
    fetchSpecies(query.cells, bounded)
  ])
  const batches = [...npws, planning, species]
  return {
    cells: query.cells,
    query: { q: query.q, from: query.from, to: query.to },
    retrievedAt: (options.now?.() ?? new Date()).toISOString(),
    results: filterHits(
      batches.flatMap((b) => b.hits),
      query
    ),
    sources: batches.map((b) => b.coverage)
  }
}
