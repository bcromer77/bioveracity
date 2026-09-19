export type ObservationMethod =
  | 'CASUAL_OBSERVATION'
  | 'STRUCTURED_CHECK'
  | 'INSTRUMENT'
  | 'REMOTE_SENSING'
  | 'OFFICIAL_RECORD'
  | 'DOCUMENTARY_CONTEXT'

export type ObservationKind =
  | 'COMMUNITY_OBSERVATION'
  | 'OCCURRENCE'
  | 'NON_DETECTION'
  | 'MEASUREMENT'
  | 'SPATIAL_CONTEXT'
  | 'DOCUMENTARY_CONTEXT'

export type TimePrecision = 'instant' | 'day' | 'month' | 'year' | 'interval' | 'unknown'
export type CoverageState = 'complete_for_scope' | 'partial' | 'unavailable' | 'not_applicable' | 'unknown'
export type FindingState = 'DETECTED' | 'LOOKED_NOT_DETECTED' | 'MEASURED' | 'REPORTED' | 'CONTEXT_ONLY'

export interface ObservationTime {
  value: string | null
  precision: TimePrecision
  end?: string | null
  basis: 'source' | 'recorder' | 'metadata' | 'system' | 'unknown'
}

export interface ObservationPlace {
  placeId?: string | null
  label?: string | null
  geometry?: unknown
  crs?: string | null
  spatialUncertaintyMeters?: number | null
  scopeNote?: string | null
}

export interface ObservationEffort {
  protocolId?: string | null
  durationMinutes?: number | null
  surveyedAreaSquareMetres?: number | null
  deviceHours?: number | null
  sampleCount?: number | null
  notes?: string | null
}

export interface SourceRepresentation {
  sourceSystem: string
  publisher?: string | null
  datasetIdentifier?: string | null
  upstreamRecordId?: string | null
  upstreamEventId?: string | null
  sourceUrl?: string | null
  licence?: string | null
  retrievedAt: string
  versionHash?: string | null
}

export interface ObservationFinding {
  id: string
  kind: ObservationKind
  state: FindingState
  target?: string | null
  value?: number | null
  unit?: string | null
  ordinalValue?: string | null
  rawStatement?: string | null
  reviewStatus: 'UNREVIEWED' | 'REVIEWED' | 'REJECTED' | 'NOT_REQUIRED'
  evidenceClass: 'COMMUNITY' | 'PROFESSIONAL' | 'INSTRUMENT' | 'OFFICIAL' | 'DERIVED'
}

export interface ObservationEvent {
  id: string
  canonicalEventId: string
  method: ObservationMethod
  observedTime: ObservationTime
  receivedAt: string
  place: ObservationPlace
  effort?: ObservationEffort | null
  source: SourceRepresentation
  findings: ObservationFinding[]
  coverage: {
    state: CoverageState
    note: string
  }
  lineage: {
    possibleDuplicateOf?: string[]
    derivedFrom?: string[]
  }
}

const iso = (value: string, field: string) => {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) throw new Error(`Invalid ${field}`)
  return new Date(time).toISOString()
}

function nonNegative(value: number | null | undefined, field: string) {
  if (value == null) return
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be non-negative`)
}

export function validateObservationEvent(event: ObservationEvent): ObservationEvent {
  if (!event.id || !event.canonicalEventId) throw new Error('Observation identifiers are required')
  event.receivedAt = iso(event.receivedAt, 'receivedAt')
  event.source.retrievedAt = iso(event.source.retrievedAt, 'retrievedAt')

  if (event.observedTime.value) {
    const observed = Date.parse(event.observedTime.value)
    if (!Number.isFinite(observed)) throw new Error('Invalid observed time')
    if (observed > Date.parse(event.receivedAt) + 300000) throw new Error('Observed time cannot be after receipt')
  } else if (event.observedTime.precision !== 'unknown') {
    throw new Error('Missing observed time must have unknown precision')
  }

  nonNegative(event.place.spatialUncertaintyMeters, 'spatial uncertainty')
  if (event.effort) {
    nonNegative(event.effort.durationMinutes, 'duration')
    nonNegative(event.effort.surveyedAreaSquareMetres, 'surveyed area')
    nonNegative(event.effort.deviceHours, 'device hours')
    nonNegative(event.effort.sampleCount, 'sample count')
  }

  if (!event.findings.length && event.method !== 'DOCUMENTARY_CONTEXT') {
    throw new Error('Observation event requires at least one finding')
  }

  for (const finding of event.findings) {
    if (!finding.id) throw new Error('Finding identifier is required')
    if (finding.state === 'MEASURED') {
      if (finding.value == null || !Number.isFinite(finding.value) || !finding.unit) {
        throw new Error('Measured finding requires finite value and unit')
      }
    }
    if (finding.state === 'LOOKED_NOT_DETECTED') {
      if (event.method !== 'STRUCTURED_CHECK' || !finding.target) {
        throw new Error('Non-detection requires a structured check and explicit target')
      }
      if (!event.effort?.protocolId) throw new Error('Non-detection requires a recorded protocol')
    }
    if (finding.state === 'CONTEXT_ONLY' && !['SPATIAL_CONTEXT', 'DOCUMENTARY_CONTEXT'].includes(finding.kind)) {
      throw new Error('Context-only finding requires a context kind')
    }
  }

  if (!event.coverage.note.trim()) throw new Error('Coverage note is required')
  return event
}

export function independentObservationCount(events: ObservationEvent[]): number {
  const canonical = new Set(events.map(event => event.canonicalEventId))
  return canonical.size
}

export function coverageSummary(events: ObservationEvent[]) {
  const counts: Record<CoverageState, number> = {
    complete_for_scope: 0,
    partial: 0,
    unavailable: 0,
    not_applicable: 0,
    unknown: 0,
  }
  for (const event of events) counts[event.coverage.state]++
  return counts
}
