import test from 'node:test'
import assert from 'node:assert/strict'
import {
  coverageSummary,
  independentObservationCount,
  validateObservationEvent,
  type ObservationEvent,
} from '../lib/observations/contract'
import {
  fromCommunityObservation,
  fromOccurrenceRecord,
  fromPhysicalMeasurement,
  fromSpatialContext,
  structuredNonDetection,
} from '../lib/observations/adapters'

test('community observation preserves unknown date instead of inventing upload time', () => {
  const event = fromCommunityObservation({
    contributionId: 'c1',
    hubId: 'fodder',
    broadCategory: 'plant',
    whatYouThink: 'First snowdrop?',
    observedAt: null,
    coarseLocation: 'beside the woodland path',
    createdAt: '2026-09-19T12:00:00Z',
  })
  assert.equal(event.observedTime.value, null)
  assert.equal(event.observedTime.precision, 'unknown')
  assert.equal(event.findings[0].state, 'REPORTED')
  assert.equal(event.coverage.state, 'unknown')
})

test('two records within the same source dataset sampling event share canonical identity', () => {
  const a = fromOccurrenceRecord({
    recordId: 'gbif-1', sourceSystem: 'gbif', datasetIdentifier: 'dataset-a',
    eventId: 'survey-42',
    scientificName: 'Aeshna cyanea',
    eventDate: '2026-07-10',
    receivedAt: '2026-09-19T12:00:00Z',
    publisher: 'Recorder scheme via GBIF',
  })
  const b = fromOccurrenceRecord({
    recordId: 'gbif-9', sourceSystem: 'gbif', datasetIdentifier: 'dataset-a',
    eventId: 'survey-42',
    scientificName: 'Aeshna cyanea',
    eventDate: '2026-07-10',
    receivedAt: '2026-09-19T12:00:01Z',
    publisher: 'Recorder scheme via GBIF',
  })
  assert.equal(independentObservationCount([a, b]), 1)
})

test('instrument measurement requires a numeric value and unit and retains station scope', () => {
  const rain = fromPhysicalMeasurement({
    sourceSystem: 'environment-agency-hydrology',
    recordId: 'chatteris:2026-09-18',
    parameter: 'rainfall',
    value: 3.4,
    unit: 'mm/day',
    observedAt: '2026-09-18',
    retrievedAt: '2026-09-19T12:00:00Z',
    stationId: 'chatteris',
    quality: 'Good',
  })
  assert.equal(rain.findings[0].value, 3.4)
  assert.equal(rain.findings[0].unit, 'mm/day')
  assert.match(rain.place.scopeNote ?? '', /not automatically a site estimate/i)
})

test('official polygon remains context and never becomes ecological condition', () => {
  const sssi = fromSpatialContext({
    sourceSystem: 'natural-england-sssi',
    recordId: '1000123',
    label: 'Example SSSI',
    geometry: { type: 'Polygon', coordinates: [] },
    retrievedAt: '2026-09-19T12:00:00Z',
    publisher: 'Natural England',
    scopeNote: 'Designation boundary only; not a condition assessment.',
  })
  assert.equal(sssi.findings[0].state, 'CONTEXT_ONLY')
  assert.equal(sssi.findings[0].kind, 'SPATIAL_CONTEXT')
})

test('non-detection is allowed only for an explicit target under a structured protocol', () => {
  const event = structuredNonDetection({
    eventId: 'pond-check-1',
    placeId: 'pond-a',
    target: 'frogspawn',
    protocolId: 'pond-check/v1',
    observedAt: '2026-03-10',
    receivedAt: '2026-03-10T10:00:00Z',
    durationMinutes: 20,
    sourceSystem: 'bioveracity:structured-check',
    upstreamRecordId: 'pond-check-1',
  })
  assert.equal(event.findings[0].state, 'LOOKED_NOT_DETECTED')
  assert.match(event.coverage.note, /not proof of absence/i)

  const invalid: ObservationEvent = {
    ...event,
    method: 'CASUAL_OBSERVATION',
  }
  assert.throws(() => validateObservationEvent(invalid), /structured check/)
})

test('coverage is reported separately from observations', () => {
  const a = structuredNonDetection({
    eventId: 'a',
    placeId: 'p',
    target: 'dragonflies',
    protocolId: 'odonata/v1',
    observedAt: '2026-07-01',
    receivedAt: '2026-07-01T12:00:00Z',
    sourceSystem: 'test',
    upstreamRecordId: 'a',
  })
  const b = { ...a, id: 'b', canonicalEventId: 'b', coverage: { state: 'partial' as const, note: 'Second half of transect inaccessible.' } }
  assert.deepEqual(coverageSummary([a, b]), {
    complete_for_scope: 1,
    partial: 1,
    unavailable: 0,
    not_applicable: 0,
    unknown: 0,
  })
})
