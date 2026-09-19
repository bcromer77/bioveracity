import { createHash, randomUUID } from 'node:crypto'
import { validateObservationEvent, type ObservationEvent, type ObservationTime } from './contract'

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const received = (value?: string | null) => value ?? new Date().toISOString()

function time(value: string | null | undefined, basis: ObservationTime['basis'] = 'source'): ObservationTime {
  if (!value) return { value: null, precision: 'unknown', basis: 'unknown' }
  const text = String(value)
  const precision = /^\d{4}$/.test(text) ? 'year' : /^\d{4}-\d{2}$/.test(text) ? 'month' : /^\d{4}-\d{2}-\d{2}$/.test(text) ? 'day' : 'instant'
  return { value: text, precision, basis }
}

export function fromCommunityObservation(input: {
  contributionId: string
  hubId: string
  broadCategory: string
  whatYouThink?: string
  note?: string
  observedAt?: string | null
  coarseLocation?: string
  createdAt: string
}): ObservationEvent {
  const source = {
    sourceSystem: 'bioveracity:wild-field-journal',
    upstreamRecordId: input.contributionId,
    upstreamEventId: input.contributionId,
    retrievedAt: input.createdAt,
    versionHash: hash(input),
  }
  return validateObservationEvent({
    id: `community:${input.contributionId}`,
    canonicalEventId: `community:${input.contributionId}`,
    method: 'CASUAL_OBSERVATION',
    observedTime: time(input.observedAt, 'recorder'),
    receivedAt: input.createdAt,
    place: { placeId: input.hubId, label: input.coarseLocation || null, scopeNote: 'Visitor-supplied coarse location; not a survey footprint.' },
    source,
    findings: [{
      id: `community:${input.contributionId}:finding`,
      kind: 'COMMUNITY_OBSERVATION',
      state: 'REPORTED',
      target: input.broadCategory,
      rawStatement: [input.whatYouThink, input.note].filter(Boolean).join(' — ') || null,
      reviewStatus: 'UNREVIEWED',
      evidenceClass: 'COMMUNITY',
    }],
    coverage: { state: 'unknown', note: 'Casual contribution. No inference about survey effort or ecological absence.' },
    lineage: {},
  })
}

export function fromOccurrenceRecord(input: {
  recordId: string
  eventId?: string | null
  scientificName: string
  eventDate?: string | null
  receivedAt?: string | null
  publisher: string
  datasetIdentifier?: string | null
  sourceUrl?: string | null
  licence?: string | null
  placeId?: string | null
  spatialUncertaintyMeters?: number | null
}): ObservationEvent {
  const retrievedAt = received(input.receivedAt)
  const canonical = input.eventId ? `occurrence-event:${input.eventId}` : `occurrence-record:${input.recordId}`
  return validateObservationEvent({
    id: `occurrence:${input.recordId}`,
    canonicalEventId: canonical,
    method: 'OFFICIAL_RECORD',
    observedTime: time(input.eventDate),
    receivedAt: retrievedAt,
    place: { placeId: input.placeId ?? null, spatialUncertaintyMeters: input.spatialUncertaintyMeters ?? null },
    source: {
      sourceSystem: 'external-occurrence',
      publisher: input.publisher,
      datasetIdentifier: input.datasetIdentifier ?? null,
      upstreamRecordId: input.recordId,
      upstreamEventId: input.eventId ?? null,
      sourceUrl: input.sourceUrl ?? null,
      licence: input.licence ?? null,
      retrievedAt,
      versionHash: hash(input),
    },
    findings: [{
      id: `occurrence:${input.recordId}:presence`,
      kind: 'OCCURRENCE',
      state: 'DETECTED',
      target: input.scientificName,
      reviewStatus: 'UNREVIEWED',
      evidenceClass: 'OFFICIAL',
    }],
    coverage: { state: 'unknown', note: 'Occurrence presence record. No absence or population inference is made.' },
    lineage: {},
  })
}

export function fromPhysicalMeasurement(input: {
  sourceSystem: string
  recordId: string
  parameter: string
  value: number
  unit: string
  observedAt: string
  retrievedAt: string
  stationId?: string | null
  placeId?: string | null
  quality?: string | null
  sourceUrl?: string | null
  licence?: string | null
}): ObservationEvent {
  return validateObservationEvent({
    id: `measurement:${input.sourceSystem}:${input.recordId}`,
    canonicalEventId: `measurement:${input.sourceSystem}:${input.recordId}`,
    method: 'INSTRUMENT',
    observedTime: time(input.observedAt),
    receivedAt: input.retrievedAt,
    place: { placeId: input.placeId ?? input.stationId ?? null, scopeNote: input.stationId ? `Station ${input.stationId}; not automatically a site estimate.` : null },
    source: {
      sourceSystem: input.sourceSystem,
      upstreamRecordId: input.recordId,
      upstreamEventId: input.recordId,
      sourceUrl: input.sourceUrl ?? null,
      licence: input.licence ?? null,
      retrievedAt: input.retrievedAt,
      versionHash: hash(input),
    },
    findings: [{
      id: `measurement:${input.sourceSystem}:${input.recordId}:value`,
      kind: 'MEASUREMENT',
      state: 'MEASURED',
      target: input.parameter,
      value: input.value,
      unit: input.unit,
      rawStatement: input.quality ? `Provider quality: ${input.quality}` : null,
      reviewStatus: 'NOT_REQUIRED',
      evidenceClass: 'INSTRUMENT',
    }],
    coverage: { state: 'complete_for_scope', note: 'Single returned instrument reading; broader temporal or spatial coverage is assessed separately.' },
    lineage: {},
  })
}

export function fromSpatialContext(input: {
  sourceSystem: string
  recordId: string
  label: string
  geometry: unknown
  retrievedAt: string
  publisher: string
  datasetIdentifier?: string | null
  sourceUrl?: string | null
  licence?: string | null
  scopeNote: string
}): ObservationEvent {
  return validateObservationEvent({
    id: `context:${input.sourceSystem}:${input.recordId}`,
    canonicalEventId: `context:${input.sourceSystem}:${input.recordId}`,
    method: 'OFFICIAL_RECORD',
    observedTime: { value: null, precision: 'unknown', basis: 'unknown' },
    receivedAt: input.retrievedAt,
    place: { label: input.label, geometry: input.geometry, crs: 'EPSG:4326', scopeNote: input.scopeNote },
    source: {
      sourceSystem: input.sourceSystem,
      publisher: input.publisher,
      datasetIdentifier: input.datasetIdentifier ?? null,
      upstreamRecordId: input.recordId,
      upstreamEventId: input.recordId,
      sourceUrl: input.sourceUrl ?? null,
      licence: input.licence ?? null,
      retrievedAt: input.retrievedAt,
      versionHash: hash(input),
    },
    findings: [{
      id: `context:${input.sourceSystem}:${input.recordId}:boundary`,
      kind: 'SPATIAL_CONTEXT',
      state: 'CONTEXT_ONLY',
      target: input.label,
      reviewStatus: 'NOT_REQUIRED',
      evidenceClass: 'OFFICIAL',
    }],
    coverage: { state: 'complete_for_scope', note: input.scopeNote },
    lineage: {},
  })
}

export function structuredNonDetection(input: {
  eventId?: string
  placeId: string
  target: string
  protocolId: string
  observedAt: string
  receivedAt: string
  durationMinutes?: number | null
  sourceSystem: string
  upstreamRecordId: string
}): ObservationEvent {
  const eventId = input.eventId ?? randomUUID()
  return validateObservationEvent({
    id: `check:${eventId}`,
    canonicalEventId: `check:${eventId}`,
    method: 'STRUCTURED_CHECK',
    observedTime: time(input.observedAt, 'recorder'),
    receivedAt: input.receivedAt,
    place: { placeId: input.placeId },
    effort: { protocolId: input.protocolId, durationMinutes: input.durationMinutes ?? null },
    source: {
      sourceSystem: input.sourceSystem,
      upstreamRecordId: input.upstreamRecordId,
      upstreamEventId: eventId,
      retrievedAt: input.receivedAt,
      versionHash: hash(input),
    },
    findings: [{
      id: `check:${eventId}:non-detection`,
      kind: 'NON_DETECTION',
      state: 'LOOKED_NOT_DETECTED',
      target: input.target,
      reviewStatus: 'UNREVIEWED',
      evidenceClass: 'PROFESSIONAL',
    }],
    coverage: { state: 'complete_for_scope', note: `Target was in scope under protocol ${input.protocolId}; this is a reported non-detection, not proof of absence.` },
    lineage: {},
  })
}
