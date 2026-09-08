// Named stations, not estimates for a site or catchment. Metadata checked in EA Hydrology.
export const RAIN_STATIONS = {
  chatteris: { name: 'Chatteris', id: '84588a50-e518-4e1f-9513-c59fc4881c55', lat: 52.465214, lng: 0.052104 },
  'fleam-dyke': { name: 'Fleam Dyke', id: '11c9c194-53af-4439-8cfc-98dcc98d534a', lat: 52.171894, lng: 0.250489 },
  'uttons-drove': { name: 'Uttons Drove', id: '9fbb429c-ab7a-4f05-bc88-800ca59c6a63', lat: 52.269093, lng: 0.002157 },
} as const
export type RainStation = keyof typeof RAIN_STATIONS
export const RAIN_LICENCE = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'
export const RAIN_ATTRIBUTION = 'Contains Environment Agency information © Environment Agency and/or database right. Licensed under the Open Government Licence v3.0.'
const ROOT = 'https://environment.data.gov.uk/hydrology/id/'
const DAY = 86400000
export function dateOnly(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use a YYYY-MM-DD date')
  const time = Date.parse(value + 'T00:00:00Z')
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Invalid date')
  return time
}
export function rainfallRequest(station: string, anchor: string, days: number) {
  if (!Object.prototype.hasOwnProperty.call(RAIN_STATIONS, station)) throw new Error('Unsupported station')
  if (![1, 7, 30].includes(days)) throw new Error('Choose 1, 7 or 30 days')
  const end = dateOnly(anchor)
  const start = new Date(end - days * DAY).toISOString().slice(0, 10)
  const metadata = RAIN_STATIONS[station as RainStation]
  const measureId = `${metadata.id}-rainfall-t-86400-mm-qualified`
  const url = `${ROOT}measures/${measureId}/readings.json?mineq-date=${start}&max-date=${anchor}&_limit=64`
  return { station: station as RainStation, metadata, measureId, url, start, end: anchor, days }
}
export type RainRequest = ReturnType<typeof rainfallRequest>
export interface RainDay { date: string; value: number | null; quality: string; completeness: string; providerTime: string | null }
export interface RainResult { station: RainStation; name: string; latitude: number; longitude: number; start: string; end: string; days: RainDay[]; available: number; retrievedAt: string; sourceUrl: string; stationUrl: string; licence: string; attribution: string }

export function parseRainfall(payload: unknown, request: RainRequest): RainResult {
  const packet = payload as { meta?: { publisher?: string; license?: string }; items?: Record<string, unknown>[] }
  if (!packet || packet.meta?.publisher !== 'Environment Agency' || packet.meta.license?.replace('http:', 'https:') !== RAIN_LICENCE || !Array.isArray(packet.items)) throw new Error('Unexpected rainfall source or licence')
  if (packet.items.length >= 64) throw new Error('Rainfall response may be truncated')
  const byDate = new Map<string, RainDay>()
  for (const row of packet.items) {
    const measure = typeof row.measure === 'string' ? row.measure : (row.measure as { '@id'?: string } | undefined)?.['@id']
    if (measure?.replace('http:', 'https:') !== ROOT + 'measures/' + request.measureId) throw new Error('Unexpected measurement series')
    const date = typeof row.date === 'string' ? row.date : ''
    dateOnly(date)
    if (date < request.start || date >= request.end) throw new Error('Reading outside requested dates')
    if (byDate.has(date)) throw new Error('Multiple daily readings require review')
    const quality = typeof row.quality === 'string' ? row.quality : 'Not supplied'
    const completeness = typeof row.completeness === 'string' ? row.completeness : 'Not supplied'
    const value = quality !== 'Missing' && typeof row.value === 'number' && Number.isFinite(row.value) && row.value >= 0 ? row.value : null
    byDate.set(date, { date, value, quality, completeness, providerTime: typeof row.dateTime === 'string' ? row.dateTime : null })
  }
  const days: RainDay[] = []
  for (let time = dateOnly(request.start); time < dateOnly(request.end); time += DAY) {
    const date = new Date(time).toISOString().slice(0, 10)
    days.push(byDate.get(date) ?? { date, value: null, quality: 'Not returned', completeness: 'Unknown', providerTime: null })
  }
  return { station: request.station, name: request.metadata.name, latitude: request.metadata.lat, longitude: request.metadata.lng, start: request.start, end: request.end, days, available: days.filter(day => day.value !== null).length, retrievedAt: new Date().toISOString(), sourceUrl: request.url, stationUrl: ROOT + 'stations/' + request.metadata.id, licence: RAIN_LICENCE, attribution: RAIN_ATTRIBUTION }
}

export async function fetchRainfall(request: RainRequest): Promise<RainResult> {
  const response = await fetch(request.url, { signal: AbortSignal.timeout(15000), redirect: 'error', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Rainfall provider unavailable')
  const body = await response.text()
  if (body.length > 250000) throw new Error('Rainfall response too large')
  return parseRainfall(JSON.parse(body), request)
}
