import type { Cell, Point } from './geometry'
export type HoneycombHit = {
  id: string
  kind: 'designation' | 'planning' | 'species'
  title: string
  sourceUrl: string
  publisher: string
  licence: string | null
  eventDate: string | null
  datePrecision: 'day' | 'month' | 'year' | 'unknown'
  matchReason: string
  cellIds: string[]
  details: string
  location?: Point
  precisionMeters?: number | null
  spatialRelation: 'site-intersects-cell' | 'reported-point-in-cell'
}
export type HoneycombCoverage = {
  id: string
  label: string
  status: 'ok' | 'partial' | 'error'
  returned: number
  note: string
}
export type HoneycombQuery = { cells: Cell[]; q: string; from: string; to: string }
export type HoneycombResponse = {
  cells: Cell[]
  query: { q: string; from: string; to: string }
  retrievedAt: string
  results: HoneycombHit[]
  sources: HoneycombCoverage[]
}
