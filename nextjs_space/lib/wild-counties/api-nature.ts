import { COUNTIES, NBDC_GADM, NBDC_PUBLISHER, type County } from '@/lib/ingest/connectors-ireland'
import { fetchJson, sourceDate, type ProviderOptions } from '@/lib/honeycomb/providers'

export type CountyNatureRecord = { id: string; name: string; publisher: string; sourceUrl: string; apiUrl: string; licence: string; eventDate: string | null; datePrecision: string; dataset: string }
// `reasons` is a maintainer-facing breakdown of why sampled records were excluded. It is not shown in guest copy.
export type CountyNatureResult = { county: string; status: 'ok' | 'partial' | 'unavailable' | 'unsupported'; checkedAt: string; records: CountyNatureRecord[]; inspected: number; excluded: number; reasons: Record<string, number>; note: string }

// Accept the canonical CC0 / CC BY 4.0 deeds AND the `/legalcode` variant GBIF appends. Anything else (e.g. by-nc) is still rejected.
const ELIGIBLE_LICENCE = /^https?:\/\/creativecommons\.org\/(?:publicdomain\/zero\/1\.0|licenses\/by\/4\.0)(?:\/legalcode)?\/?$/

export function supportedNatureCounty(slug: string): County | null {
 return COUNTIES.find(county => county.toLowerCase() === slug) || null
}

export async function fetchCountyNature(slug: string, options: ProviderOptions = {}): Promise<CountyNatureResult> {
 const county = supportedNatureCounty(slug)
 const result: CountyNatureResult = { county: county || slug, status: 'unsupported', checkedAt: (options.now?.() || new Date()).toISOString(), records: [], inspected: 0, excluded: 0, reasons: {}, note: 'An API for this county is not connected. No substitute webpage summary is shown.' }
 if (!county) return result
 const bump = (reason: string) => { result.excluded++; result.reasons[reason] = (result.reasons[reason] || 0) + 1 }
 try {
  const params = new URLSearchParams({ publishingOrg: NBDC_PUBLISHER, country: 'IE', gadmGid: NBDC_GADM[county], occurrenceStatus: 'PRESENT', limit: '50', offset: '0' })
  const data = await fetchJson('https://api.gbif.org/v1/occurrence/search?' + params, options)
  if (!Array.isArray(data.results)) throw Error('Invalid API response')
  result.status = data.endOfRecords === true ? 'ok' : 'partial'
  const seen = new Set<string>()
  for (const a of data.results.slice(0, 50)) {
   result.inspected++
   if (!a || !/^\d+$/.test(String(a.key))) { bump('invalid-key'); continue }
   if (a.publishingOrgKey !== NBDC_PUBLISHER) { bump('not-nbdc-publisher'); continue }
   if (a.countryCode !== 'IE' || a.gadm?.level1?.gid !== NBDC_GADM[county] || a.occurrenceStatus !== 'PRESENT') { bump('outside-county-scope'); continue }
   if (a.informationWithheld) { bump('information-withheld'); continue }
   if (a.dataGeneralizations) { bump('location-generalised'); continue }
   if (typeof a.scientificName !== 'string' || !a.scientificName.trim()) { bump('no-scientific-name'); continue }
   if (typeof a.license !== 'string' || !ELIGIBLE_LICENCE.test(a.license)) { bump('licence-not-eligible'); continue }
   const id = String(a.key)
   if (seen.has(id)) continue
   seen.add(id)
   result.records.push({ id: 'gbif:' + id, name: a.scientificName.trim().slice(0, 200), publisher: 'National Biodiversity Data Centre via GBIF', sourceUrl: 'https://www.gbif.org/occurrence/' + id, apiUrl: 'https://api.gbif.org/v1/occurrence/' + id, licence: a.license, ...sourceDate(a.eventDate || (Number.isInteger(a.year) ? String(a.year) : null)), dataset: typeof a.datasetKey === 'string' ? a.datasetKey.slice(0, 100) : 'Not stated' })
  }
  if (result.excluded || data.results.length > 50) result.status = 'partial'
  result.note = 'A bounded sample of at most 50 NBDC-published API records assigned to this county by GBIF GADM administrative area. Historical records, not a survey, a complete species list or sightings at a venue. Personal names and precise locations are not displayed. Withheld, generalised and unsupported-licence records are excluded.'
  return result
 } catch {
  return { ...result, status: 'unavailable', records: [], reasons: {}, note: 'The biodiversity API could not be checked. No webpage, invented record or previous success is substituted.' }
 }
}
