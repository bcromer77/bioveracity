import { test } from 'node:test'
import assert from 'node:assert/strict'
import { marchCorrection, type MarchStoredEvent, MARCH_SOURCE } from '../lib/march-case'
const event: MarchStoredEvent = { id: 'test', title: 'Lime treatment resumes after summer pause', date: new Date('2025-09-22'), datePrecision: 'day', description: null, sourceUrl: null, sourceDomain: null, evidenceClass: 'O', verified: true }
test('restart assertion becomes a planned milestone and is not marked verified', () => {
  const patch = marchCorrection(event)!
  assert.match(patch.title, /restart unconfirmed/)
  assert.equal(patch.sourceUrl, MARCH_SOURCE)
  assert.equal(patch.verified, false)
  assert.equal(marchCorrection({ ...event, ...patch }), null)
})
test('unrecognised records and different existing sources require manual review', () => {
  assert.equal(marchCorrection({ ...event, title: 'Actual restart independently measured' }), null)
  assert.equal(marchCorrection({ ...event, date: new Date('2025-09-23') }), null)
  assert.equal(marchCorrection({ ...event, sourceUrl: 'https://example.org/other' }), null)
})
