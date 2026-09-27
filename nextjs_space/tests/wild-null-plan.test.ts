import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { activeCampaign, type Snapshot } from '../lib/wild-hubs/domain'
import { reviewService } from '../lib/wild-hubs/review'
import { publicHub } from '../lib/wild-hubs/service'
import type { Sql, Database } from '../lib/workspaces/service'
import { nullPlanSnapshot } from './fixtures/wild-null-plan-snapshot'

test('activeCampaign tolerates the legacy plan:null snapshot shape', () => {
  const snapshot = nullPlanSnapshot as unknown as Snapshot
  assert.equal(snapshot.plan, null)
  assert.equal(activeCampaign(snapshot.plan), null)
  assert.equal(activeCampaign(null, new Date('2026-09-27T12:00:00Z')), null)
  assert.equal(activeCampaign(undefined), null)
})

test('isolated PostgreSQL: null-plan snapshot is served unchanged and can be approved', async () => {
  const pg = new PGlite()
  try {
    await pg.exec('CREATE TABLE "User" (id TEXT PRIMARY KEY, role TEXT DEFAULT \'user\', "accessState" TEXT DEFAULT \'REGISTERED\'); INSERT INTO "User" (id) VALUES (\'owner\'),(\'reviewer\'); UPDATE "User" SET role=\'admin\' WHERE id=\'reviewer\';')
    for (const m of ['20260914_wild_hubs', '20260915_wild_editorial_review'])
      await pg.exec(readFileSync(new URL(`../prisma/migrations/${m}/migration.sql`, import.meta.url), 'utf8'))
    const sql = (client: Pick<PGlite, 'query'>): Sql => ({
      query: async <T>(statement: string, values: unknown[]) => (await client.query<T>(statement, values)).rows,
    })
    const db: Database = { ...sql(pg), transaction: (fn) => pg.transaction((tx) => fn(sql(tx))) }
    const encoded = JSON.stringify(nullPlanSnapshot)
    await pg.query(
      `INSERT INTO "WildHub" ("id","ownerId","profile","plan","published","revision") VALUES ('hub-null','owner',$1::jsonb,'null'::jsonb,$2::jsonb,8)`,
      [JSON.stringify(nullPlanSnapshot.profile), encoded])
    const before = (await pg.query<{ md5: string }>('SELECT md5("published"::text) FROM "WildHub" WHERE id=\'hub-null\'')).rows[0].md5
    const served = await publicHub(db, 'hub-null')
    assert.deepEqual(served, nullPlanSnapshot)
    assert.equal(activeCampaign(served!.plan), null)
    assert.equal((await pg.query<{ md5: string }>('SELECT md5("published"::text) FROM "WildHub" WHERE id=\'hub-null\'')).rows[0].md5, before, 'reading must not rewrite the snapshot')

    // A resubmitted legacy snapshot (plan still null) must list and approve without a TypeError.
    for (const id of nullPlanSnapshot.photoIds)
      await pg.query('INSERT INTO "WildHubPhoto" ("id","hubId","caption","credit","hash","bytes") VALUES ($1,\'hub-null\',\'Fixture\',\'Fixture\',$1,\'\\x00\'::bytea)', [id])
    await pg.query(`INSERT INTO "WildHubReview" ("id","hubId","submittedBy","revision","snapshot") VALUES ('review-null','hub-null','owner',8,$1::jsonb)`, [encoded])
    const reviewer = reviewService(db, 'reviewer')
    const listed = (await reviewer.list()).reviews
    assert.equal(listed.length, 1)
    assert.equal(listed[0].snapshot.plan, null)
    await reviewer.decide('review-null', { action: 'approve', revision: 8, confirmed: true, reason: 'Synthetic null-plan regression fixture.' })
    const [after] = (await pg.query<{ published: Snapshot }>('SELECT "published" FROM "WildHub" WHERE id=\'hub-null\'')).rows
    assert.equal(after.published.plan, null)
    assert.equal(after.published.version, 9)
  } finally {
    await pg.close()
  }
})
