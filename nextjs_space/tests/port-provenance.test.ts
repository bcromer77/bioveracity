import test from 'node:test'
import assert from 'node:assert/strict'
import { hasPortProvenance, portDatePrecision, portReplayWindow } from '../lib/port-provenance'

const provenance = {
  sourceUrl: 'https://example.org/projects/port', sourcePublisher: 'Example publisher',
  sourceRetrievedAt: '2026-09-08T12:00:00Z', sourceLocation: 'Programme section',
}

test('legacy URLs and unsafe links cannot pass the source metadata gate', () => {
  assert.equal(hasPortProvenance(provenance), true)
  assert.equal(hasPortProvenance({ sourceUrl: provenance.sourceUrl }), false)
  for (const sourceUrl of ['javascript:alert(1)', 'https://example.org/', 'https://user:secret@example.org/project']) {
    assert.equal(hasPortProvenance({ ...provenance, sourceUrl }), false)
  }
  assert.equal(hasPortProvenance({ ...provenance, sourceRetrievedAt: 'invalid' }), false)
  assert.equal(hasPortProvenance({ ...provenance, sourceLocation: ' ' }), false)
})

test('missing precision never becomes an exact day', () => {
  assert.equal(portDatePrecision({}), 'unknown')
  assert.equal(portDatePrecision({ datePrecision: 'year' }), 'year')
})

test('project, permit and event cards share the same server-side replay window', () => {
  const records = [
    { id: 'old-project', date: '2022-04-23T00:00:00Z' },
    { id: 'permit', date: '2025-09-09T00:00:00Z' },
    { id: 'event', date: '2026-09-08T00:00:00Z' },
    { id: 'undated', date: 'unknown' },
  ]
  assert.deepEqual(portReplayWindow(records, false).map(r => r.id), ['permit', 'event'])
  assert.deepEqual(portReplayWindow(records, true).map(r => r.id), ['old-project', 'permit', 'event'])
})
