import test from 'node:test'
import assert from 'node:assert/strict'
import { observationStore } from '../lib/observations/store'
import { fromCommunityObservation, fromOccurrenceRecord } from '../lib/observations/adapters'
import type { Database, Sql } from '../lib/workspaces/service'

class FakeDb implements Database {
  queries: { sql: string; values: unknown[] }[] = []
  eventIds = new Map<string, string>()
  sources = new Set<string>()
  async query<T>(sql: string, values: unknown[]): Promise<T[]> {
    this.queries.push({ sql, values })
    if (sql.startsWith('SELECT id FROM "ObservationEventRecord"')) {
      const id = this.eventIds.get(String(values[0]))
      return (id ? [{ id }] : []) as T[]
    }
    if (sql.startsWith('INSERT INTO "ObservationEventRecord"')) {
      this.eventIds.set(String(values[1]), String(values[0]))
      return [] as T[]
    }
    if (sql.startsWith('SELECT id FROM "ObservationSourceRecord"')) {
      const key = [values[0], values[1], values[2], values[3]].join('|')
      return (this.sources.has(key) ? [{ id: 'source' }] : []) as T[]
    }
    if (sql.startsWith('INSERT INTO "ObservationSourceRecord"')) {
      this.sources.add([values[1], values[2], values[5], values[10]].join('|'))
      return [] as T[]
    }
    return [] as T[]
  }
  async transaction<T>(operation: (tx: Sql) => Promise<T>): Promise<T> { return operation(this) }
}

test('saving the same canonical event reuses the event record and does not create an independent event twice', async () => {
  const db = new FakeDb()
  const store = observationStore(db)
  const first = fromOccurrenceRecord({
    recordId: 'gbif-1', eventId: 'survey-42', scientificName: 'Aeshna cyanea', eventDate: '2026-07-10',
    receivedAt: '2026-09-19T12:00:00Z', publisher: 'Scheme via GBIF',
  })
  const second = fromOccurrenceRecord({
    recordId: 'nbn-9', eventId: 'survey-42', scientificName: 'Aeshna cyanea', eventDate: '2026-07-10',
    receivedAt: '2026-09-19T12:05:00Z', publisher: 'Scheme via NBN',
  })
  const a = await store.save(first)
  const b = await store.save(second)
  assert.equal(a.id, b.id)
  assert.equal(db.queries.filter(q => q.sql.startsWith('INSERT INTO "ObservationEventRecord"')).length, 1)
  assert.equal(db.queries.filter(q => q.sql.startsWith('INSERT INTO "ObservationSourceRecord"')).length, 2)
})

test('unknown community observation date is stored as unknown rather than upload time', async () => {
  const db = new FakeDb()
  const store = observationStore(db)
  await store.save(fromCommunityObservation({
    contributionId: 'c1', hubId: 'hub1', broadCategory: 'plant', observedAt: null,
    createdAt: '2026-09-19T12:00:00Z', whatYouThink: 'snowdrop?',
  }))
  const insert = db.queries.find(q => q.sql.startsWith('INSERT INTO "ObservationEventRecord"'))
  assert.ok(insert)
  assert.equal(insert.values[4], null)
  assert.equal(insert.values[5], 'unknown')
})

test('evidence check persists bounded scope separately from observations', async () => {
  const db = new FakeDb()
  const store = observationStore(db)
  await store.recordEvidenceCheck({
    assetId: 'site-1',
    question: 'Was a monitoring report located?',
    scope: { period: '2026', sources: ['planning-portal'] },
    sourceVersions: [{ source: 'planning-portal', checkedAt: '2026-09-19' }],
    method: { terms: ['monitoring report'] },
    resultStatus: 'NOT_LOCATED_IN_REVIEWED_SCOPE',
    coverage: { status: 'complete_for_scope' },
  })
  const insert = db.queries.find(q => q.sql.startsWith('INSERT INTO "EvidenceCheckRecord"'))
  assert.ok(insert)
  assert.equal(insert.values[6], 'NOT_LOCATED_IN_REVIEWED_SCOPE')
})
