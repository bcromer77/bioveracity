import { HubError, profileInput, record, text, type Profile } from './domain'
import { WILD_COUNTIES } from '../wild-counties/counties'

export type VenueSetupInput = { reference: string; email: string; profile: Profile }
export const VENUE_CSV_HEADER = 'reference,email,name,county,kind,story,website'
export function venueSetupInput(raw: unknown): VenueSetupInput {
  const input = record(raw)
  const reference = text(input.reference, 80).toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reference)) throw new HubError(400, 'Use a short venue reference containing letters, numbers and hyphens.')
  const email = text(input.email, 320).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HubError(400, 'Enter the venue representative’s email address.')
  const profile = record(input.profile)
  const countyName = text(profile.county, 60).toLowerCase().replace(/^county\s+/, '')
  const county = WILD_COUNTIES.find(c => c.slug === countyName || c.name.toLowerCase().replace(/^county\s+/, '') === countyName)
  return { reference, email, profile: profileInput({ ...profile, county: county?.slug ?? countyName }) }
}

// Bounded RFC-style CSV reader, including quoted commas/newlines and escaped quotes.
// No evaluation, URL fetching, spreadsheet formula execution or network writes.
export function parseVenueCsv(csv: string): VenueSetupInput[] {
  if (new TextEncoder().encode(csv).length > 180000) throw new HubError(400, 'Use a CSV smaller than 180 KB, with at most 50 places.')
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false, closed = false
  const field = () => { row.push(cell); cell = ''; closed = false }
  const line = () => { field(); if (row.some(c => c.trim())) rows.push(row); row = [] }
  const input = csv.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') { quoted = false; closed = true }
      else cell += c
    } else if (c === ',') field()
    else if (c === '\n' || c === '\r') { if (c === '\r' && input[i + 1] === '\n') i++; line() }
    else if (c === '"' && !cell && !closed) quoted = true
    else { if (closed || c === '"') throw new HubError(400, 'Check CSV quotation marks.'); cell += c }
    if (row.length > 7 || rows.length > 51) throw new HubError(400, 'Use seven columns and at most 50 places.')
  }
  if (quoted) throw new HubError(400, 'Close the quoted CSV field.')
  line()
  if (!rows.length || rows[0].map(c => c.trim().toLowerCase()).join(',') !== VENUE_CSV_HEADER) throw new HubError(400, `Use these CSV headings: ${VENUE_CSV_HEADER}`)
  if (rows.length < 2 || rows.length > 51) throw new HubError(400, 'Add between 1 and 50 places.')
  const results = rows.slice(1).map((r, index) => {
    try {
      if (r.length !== 7) throw new HubError(400, 'Seven columns are required.')
      const [reference, email, name, county, kind, story, website] = r
      return venueSetupInput({ reference, email, profile: { name, county, kind: kind.trim().toLowerCase(), story, website, interests: ['nature'] } })
    } catch (error) { throw new HubError(400, `Row ${index + 2}: ${error instanceof Error ? error.message : 'Check the venue details.'}`) }
  })
  if (new Set(results.map(r => r.reference)).size !== results.length) throw new HubError(400, 'Each venue needs a different reference.')
  return results
}
