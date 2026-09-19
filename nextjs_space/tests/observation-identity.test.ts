import test from 'node:test'
import assert from 'node:assert/strict'
import { fromOccurrenceRecord, fromPhysicalMeasurement, fromSpatialContext, structuredNonDetection } from '../lib/observations/adapters'
import { scopedIdentity } from '../lib/observations/identity'
const occurrence = { sourceSystem: 'gbif', datasetIdentifier: 'a', recordId: '1', eventId: 'survey-1',
  scientificName: 'Aeshna cyanea', publisher: 'Scheme', eventDate: '2026-07', receivedAt: '2026-09-19T12:00:00Z' }

test('later retrieval is not a new version; corrected content is', () => {
  const a = fromOccurrenceRecord(occurrence)
  const b = fromOccurrenceRecord({ ...occurrence, receivedAt: '2026-09-20T12:00:00Z' })
  assert.equal(a.source.versionHash, b.source.versionHash)
  assert.notEqual(a.receivedAt, b.receivedAt)
  const c = fromOccurrenceRecord({ ...occurrence, scientificName: 'Aeshna mixta' })
  assert.equal(a.canonicalEventId, c.canonicalEventId)
  assert.notEqual(a.source.versionHash, c.source.versionHash)
})
test('dataset and provider scope protect event, record and finding identities', () => {
  const events = [fromOccurrenceRecord(occurrence),
    fromOccurrenceRecord({ ...occurrence, datasetIdentifier: 'b' }),
    fromOccurrenceRecord({ ...occurrence, sourceSystem: 'nbn' })]
  assert.equal(new Set(events.map(e => e.id)).size, 3)
  assert.equal(new Set(events.map(e => e.canonicalEventId)).size, 3)
  assert.equal(new Set(events.map(e => e.findings[0].id)).size, 3)
  assert.notEqual(fromOccurrenceRecord({ ...occurrence, eventId: null }).id,
    fromOccurrenceRecord({ ...occurrence, eventId: null, datasetIdentifier: 'b' }).id)
  assert.throws(() => fromOccurrenceRecord({ ...occurrence, datasetIdentifier: '' }), /namespace/)
  assert.throws(() => fromOccurrenceRecord({ ...occurrence, sourceSystem: ' ' }), /namespace/)
  assert.notEqual(scopedIdentity('test', 'a:b', 'c'), scopedIdentity('test', 'a', 'b:c'))
})
test('measurement retries are stable; value and quality corrections change the version', () => {
  const input = { sourceSystem: 'ea', recordId: 'r1', parameter: 'rainfall', value: 2, unit: 'mm/day',
    observedAt: '2026-09-18', retrievedAt: '2026-09-19T12:00:00Z' }
  const a = fromPhysicalMeasurement(input)
  assert.equal(a.source.versionHash, fromPhysicalMeasurement({ ...input, retrievedAt: '2026-09-20T12:00:00Z' }).source.versionHash)
  assert.notEqual(a.source.versionHash, fromPhysicalMeasurement({ ...input, value: 3 }).source.versionHash)
  assert.notEqual(a.source.versionHash, fromPhysicalMeasurement({ ...input, quality: 'Suspect' }).source.versionHash)
})
test('JSON key order is not a change; corrected geometry is', () => {
  const input = { sourceSystem: 'sssi', recordId: 's1', label: 'Site', publisher: 'Natural England',
    retrievedAt: '2026-09-19T12:00:00Z', scopeNote: 'Context only', geometry: { type: 'Point', coordinates: [0, 52] } }
  const a = fromSpatialContext(input)
  assert.equal(a.source.versionHash, fromSpatialContext({ ...input, retrievedAt: '2026-09-20T12:00:00Z',
    geometry: { coordinates: [0, 52], type: 'Point' } }).source.versionHash)
  assert.notEqual(a.source.versionHash, fromSpatialContext({ ...input,
    geometry: { type: 'Point', coordinates: [1, 52] } }).source.versionHash)
})
test('structured-check retries without event ID are stable', () => {
  const input = { placeId: 'pond', target: 'frogspawn', protocolId: 'pond/v1', observedAt: '2026-03-10',
    receivedAt: '2026-03-10T12:00:00Z', sourceSystem: 'journal', upstreamRecordId: 'check-1' }
  const a = structuredNonDetection(input)
  const b = structuredNonDetection({ ...input, receivedAt: '2026-03-11T12:00:00Z' })
  assert.equal(a.id, b.id)
  assert.equal(a.source.versionHash, b.source.versionHash)
})
