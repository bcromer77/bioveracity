import test from 'node:test'
import assert from 'node:assert/strict'
import { validateResidentReport, HONEYCOMB_CATEGORIES } from '../lib/resident-report'
import { assertPortSeedReady } from '../lib/port-seed-gate'
const now = Date.parse('2026-09-08T12:00:00Z')
const valid = { assetId: 'river-cam', category: 'RIVER', description: 'I observed unusually cloudy water.', observedAt: '2026-09-08T10:00:00Z', requestId: '65dcba98-2303-4e0b-8dca-1665de93b7e8' }
test('all honeycomb topics preserve user observations with explicit timezones', () => {
  for (const category of HONEYCOMB_CATEGORIES) assert.equal(validateResidentReport({ ...valid, category }, now).category, category)
  assert.equal(validateResidentReport(valid, now).observedAt.toISOString(), valid.observedAt.replace('Z', '.000Z'))
})
test('client cannot promote, publish, impersonate or supply sensitive coordinates', () => {
  for (const extra of [{ status: 'VERIFIED' }, { visibility: 'PUBLIC' }, { userId: 'someone-else' }, { latitude: 52.1 }]) assert.throws(() => validateResidentReport({ ...valid, ...extra }, now), /Unsupported/)
})
test('rejects malformed times, identifiers, topics and excessive or empty descriptions', () => {
  for (const bad of [{ category: 'VERIFIED' }, { observedAt: '2026-02-31T10:00:00Z' }, { observedAt: '2026-09-08T10:00:00' }, { observedAt: '2027-01-01T00:00:00Z' }, { description: ' ' }, { description: 'x'.repeat(2001) }, { requestId: '-'.repeat(36) }]) assert.throws(() => validateResidentReport({ ...valid, ...bad }, now))
})
test('legacy port enrichment is blocked before writes rather than manufacturing provenance', () => {
  assert.throws(assertPortSeedReady, /quarantined/)
})
