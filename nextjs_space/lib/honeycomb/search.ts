import { cellFromId, cellsBounds } from './geometry'
import type { HoneycombHit, HoneycombQuery } from './types'

export function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === `${value}T00:00:00.000Z`
}
export function parseHoneycombQuery(input: unknown): HoneycombQuery {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw Error('A search request is required.')
  const a = input as Record<string, unknown>
  if (
    !Array.isArray(a.cells) ||
    a.cells.length < 1 ||
    a.cells.length > 7 ||
    !a.cells.every((c) => typeof c === 'string')
  )
    throw Error('Select between one and seven cells.')
  const ids = [...new Set(a.cells as string[])]
  const cells = ids.map(cellFromId)
  if (cells.some((c) => c.size !== cells[0].size)) throw Error('Selected cells must use the same scale.')
  const bounds = cellsBounds(cells)
  if (bounds.north - bounds.south > 0.3 || bounds.east - bounds.west > 0.5)
    throw Error('Select cells within one local area.')
  const q = a.q ?? '',
    from = a.from ?? '',
    to = a.to ?? ''
  if (typeof q !== 'string' || q.length > 160 || typeof from !== 'string' || typeof to !== 'string')
    throw Error('Invalid search filters.')
  if ((from && !validDay(from)) || (to && !validDay(to)) || (from && to && from > to))
    throw Error('Use valid dates in chronological order.')
  return { cells, q: q.trim(), from, to }
}
function normalise(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
// Date filters use interval overlap so a year-only record is never given a fictitious day.
export function dateMatches(hit: HoneycombHit, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!hit.eventDate) return false
  const date = hit.eventDate
  let start = '',
    end = ''
  if (hit.datePrecision === 'day' && validDay(date)) start = end = date
  else if (hit.datePrecision === 'year' && /^\d{4}$/.test(date) && Number(date) > 0) {
    start = `${date}-01-01`
    end = `${date}-12-31`
  } else if (hit.datePrecision === 'month' && /^\d{4}-\d{2}$/.test(date) && validDay(`${date}-01`)) {
    start = `${date}-01`
    const last = new Date(`${date}-01T00:00:00Z`)
    last.setUTCMonth(last.getUTCMonth() + 1)
    last.setUTCDate(0)
    end = last.toISOString().slice(0, 10)
  } else return false
  return (!from || end >= from) && (!to || start <= to)
}
export function filterHits(hits: HoneycombHit[], query: HoneycombQuery): HoneycombHit[] {
  const terms = normalise(query.q)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
  const unique = new Map<string, HoneycombHit>()
  for (const hit of hits) {
    const existing = unique.get(hit.id)
    if (existing) existing.cellIds = [...new Set([...existing.cellIds, ...hit.cellIds])].sort()
    else unique.set(hit.id, { ...hit, cellIds: [...hit.cellIds] })
  }
  return [...unique.values()]
    .filter((hit) => {
      const text = normalise(`${hit.title} ${hit.publisher} ${hit.details}`)
      return terms.every((term) => text.includes(term)) && dateMatches(hit, query.from, query.to)
    })
    .sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
    )
}

export class HoneycombInputError extends Error {}

// Membership must succeed before validation, source requests or result generation.
// Pure injection point allows the real access service to be exercised in isolation.
export async function authorisedHoneycombSearch<T>(
  service: { getCase(workspaceId: string, caseId: string): Promise<unknown> },
  workspaceId: string,
  caseId: string,
  input: unknown | (() => Promise<unknown>),
  search: (query: HoneycombQuery) => Promise<T>
): Promise<T> {
  await service.getCase(workspaceId, caseId)
  const value = typeof input === 'function' ? await input() : input
  let query: HoneycombQuery
  try {
    query = parseHoneycombQuery(value)
  } catch (error) {
    throw new HoneycombInputError(error instanceof Error ? error.message : 'Invalid search.')
  }
  return search(query)
}
