import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { observationStore } from '../lib/observations/store'
import { fromCommunityObservation, fromOccurrenceRecord, fromPhysicalMeasurement, fromSpatialContext } from '../lib/observations/adapters'
import type { Database, Sql } from '../lib/workspaces/service'

async function fixture(run: (store: ReturnType<typeof observationStore>, pg: PGlite) => Promise<void>) {
  const pg = new PGlite()
  try {
    await pg.exec('CREATE TABLE "Asset" (id TEXT PRIMARY KEY); INSERT INTO "Asset" VALUES (\'hub1\'),(\'site-1\');')
    await pg.exec(readFileSync(join(process.cwd(), 'prisma/migrations/20260920_observation_revisions/migration.sql'), 'utf8'))
    const sql = (client: Pick<PGlite, 'query'>): Sql => ({
      query: async <T>(text: string, values: unknown[]) => (await client.query<T>(text, values)).rows,
    })
    const db: Database = { ...sql(pg), transaction: operation => pg.transaction(tx => operation(sql(tx))) }
    await run(observationStore(db), pg)
  } finally { await pg.close() }
}
const occurrence = { sourceSystem: 'gbif', datasetIdentifier: 'a', recordId: '1', eventId: 'survey-42',
  scientificName: 'Aeshna cyanea', eventDate: '2026-07-10', receivedAt: '2026-09-19T12:00:00Z', publisher: 'Scheme' }
const rain = { sourceSystem: 'ea', recordId: 'r1', parameter: 'rainfall', value: 2, unit: 'mm/day',
  observedAt: '2026-09-18', retrievedAt: '2026-09-19T12:00:00Z' }

test('real migration: repeat imports reuse event, source and snapshot', async () => {
  await fixture(async (store, pg) => {
    const a = await store.save(fromOccurrenceRecord(occurrence))
    const b = await store.save(fromOccurrenceRecord({ ...occurrence, receivedAt: '2026-09-20T12:00:00Z' }))
    assert.deepEqual(a, b)
    assert.equal((await pg.query('SELECT * FROM "ObservationEventRecord"')).rows.length, 1)
    assert.equal((await pg.query('SELECT * FROM "ObservationSourceRecord"')).rows.length, 1)
    const versions = await store.versions(a.id)
    assert.equal(versions.length, 1)
    assert.equal(versions[0].snapshot.receivedAt, new Date(occurrence.receivedAt).toISOString())
  })
})
test('correction preserves both finding values and their source linkage', async () => {
  await fixture(async (store, pg) => {
    const a = await store.save(fromPhysicalMeasurement(rain))
    const b = await store.save(fromPhysicalMeasurement({ ...rain, value: 4.2, quality: 'Corrected', retrievedAt: '2026-09-20T12:00:00Z' }))
    assert.equal(a.id, b.id)
    assert.notEqual(a.sourceId, b.sourceId)
    const versions = await store.versions(a.id)
    assert.deepEqual(versions.map(v => v.snapshot.findings[0].value), [2, 4.2])
    assert.deepEqual(versions.map(v => v.sourceId), [a.sourceId, b.sourceId])
    assert.equal(versions[1].snapshot.findings[0].rawStatement, 'Provider quality: Corrected')
    assert.equal((await pg.query<{ value: number }>('SELECT value FROM "ObservationFindingRecord"')).rows[0].value, 2)
    await store.save(fromPhysicalMeasurement(rain))
    assert.equal((await store.versions(a.id)).length, 2, 'replay must not manufacture a correction')
  })
})
test('corrected dates and polygons survive even though base rows are first-seen records', async () => {
  await fixture(async store => {
    const a = await store.save(fromOccurrenceRecord(occurrence))
    await store.save(fromOccurrenceRecord({ ...occurrence, eventDate: '2026-07', receivedAt: '2026-09-20T12:00:00Z' }))
    assert.deepEqual((await store.versions(a.id)).map(v => v.snapshot.observedTime.precision), ['day', 'month'])
    const context = { sourceSystem: 'sssi', recordId: 's1', label: 'Site', publisher: 'Natural England',
      retrievedAt: '2026-09-19T12:00:00Z', scopeNote: 'Context only', geometry: { type: 'Point', coordinates: [0, 52] } }
    const b = await store.save(fromSpatialContext(context))
    await store.save(fromSpatialContext({ ...context, geometry: { type: 'Point', coordinates: [1, 52] }, retrievedAt: '2026-09-20T12:00:00Z' }))
    assert.deepEqual((await store.versions(b.id)).map(v => v.snapshot.place.geometry),
      [{ type: 'Point', coordinates: [0, 52] }, { type: 'Point', coordinates: [1, 52] }])
  })
})
test('sampling records group within a dataset; other datasets and providers stay separate', async () => {
  await fixture(async (store, pg) => {
    const a = await store.save(fromOccurrenceRecord(occurrence))
    const b = await store.save(fromOccurrenceRecord({ ...occurrence, recordId: '2' }))
    const c = await store.save(fromOccurrenceRecord({ ...occurrence, datasetIdentifier: 'b' }))
    const d = await store.save(fromOccurrenceRecord({ ...occurrence, sourceSystem: 'nbn' }))
    assert.equal(a.id, b.id)
    assert.equal(new Set([a.id, c.id, d.id]).size, 3)
    assert.equal((await pg.query('SELECT * FROM "ObservationFindingRecord"')).rows.length, 4)
    assert.equal((await store.versions(a.id)).length, 2)
  })
})
test('overlapping calls are idempotent in the isolated database', async () => {
  await fixture(async (store, pg) => {
    const results = await Promise.all(Array.from({ length: 4 }, () => store.save(fromPhysicalMeasurement(rain))))
    assert.equal(new Set(results.map(r => r.sourceId)).size, 1)
    assert.equal((await pg.query('SELECT * FROM "ObservationRevisionRecord"')).rows.length, 1)
  })
})
test('unknown dates and bounded documentary checks retain their meaning', async () => {
  await fixture(async (store, pg) => {
    const a = await store.save(fromCommunityObservation({ contributionId: 'c1', hubId: 'hub1', broadCategory: 'plant',
      observedAt: null, createdAt: '2026-09-19T12:00:00Z', whatYouThink: 'snowdrop?' }))
    const [row] = (await pg.query<{ observedAt: string | null; observedPrecision: string }>('SELECT * FROM "ObservationEventRecord"')).rows
    assert.equal(row.observedAt, null)
    assert.equal(row.observedPrecision, 'unknown')
    assert.equal((await store.versions(a.id))[0].snapshot.findings[0].state, 'REPORTED')
    await store.recordEvidenceCheck({ assetId: 'site-1', question: 'Was a monitoring report located?',
      scope: { period: '2026', sources: ['planning-portal'] }, sourceVersions: [], method: { terms: ['monitoring report'] },
      resultStatus: 'NOT_LOCATED_IN_REVIEWED_SCOPE', coverage: { status: 'partial' } })
    assert.equal((await pg.query<{ resultStatus: string }>('SELECT * FROM "EvidenceCheckRecord"')).rows[0].resultStatus,
      'NOT_LOCATED_IN_REVIEWED_SCOPE')
  })
})
test('failed snapshot insert rolls back the entire observation transaction', async () => {
  await fixture(async (store, pg) => {
    await pg.exec('ALTER TABLE "ObservationRevisionRecord" ADD CONSTRAINT reject_snapshot CHECK (false)')
    await assert.rejects(store.save(fromPhysicalMeasurement(rain)), /reject_snapshot/)
    for (const name of ['ObservationEventRecord', 'ObservationFindingRecord', 'ObservationSourceRecord']) {
      assert.equal((await pg.query(`SELECT * FROM "${name}"`)).rows.length, 0)
    }
  })
})
