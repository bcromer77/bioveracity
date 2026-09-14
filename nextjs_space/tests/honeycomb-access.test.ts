import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { workspaceService, WorkspaceError, type Database, type Sql } from '../lib/workspaces/service'
import { authorisedHoneycombSearch } from '../lib/honeycomb/search'
import { cellAt } from '../lib/honeycomb/geometry'

test('real case access allows owner search and blocks foreign, mismatched and revoked membership before retrieval', async () => {
  const pg = new PGlite()
  try {
    await pg.exec(
      `CREATE TABLE "User" (id TEXT PRIMARY KEY); INSERT INTO "User" VALUES ('owner'),('viewer'),('foreign');`
    )
    for (const migration of ['20260909_private_workspace_foundation', '20260911_workspace_persona'])
      await pg.exec(
        readFileSync(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8')
      )
    const sql = (client: Pick<PGlite, 'query'>): Sql => ({
      query: async <T>(text: string, values: unknown[]) => (await client.query<T>(text, values)).rows
    })
    const db: Database = {
      ...sql(pg),
      transaction: (operation) => pg.transaction((tx) => operation(sql(tx)))
    }
    const owner = workspaceService(db, 'owner'),
      viewer = workspaceService(db, 'viewer'),
      foreign = workspaceService(db, 'foreign')
    const w = await owner.createWorkspace({ name: 'Isolated honeycomb test' }),
      c = await owner.createCase(w.id, { title: 'Public source search' })
    const input = { cells: [cellAt({ lat: 52.65, lng: -7.25 }).id] }
    let calls = 0
    const search = async () => {
      calls++
      return { results: [] }
    }
    await authorisedHoneycombSearch(owner, w.id, c.id, input, search)
    assert.equal(calls, 1)
    for (const [service, wid] of [
      [foreign, w.id],
      [owner, 'different-workspace']
    ] as const)
      await assert.rejects(
        authorisedHoneycombSearch(service, wid, c.id, input, search),
        (e: unknown) => e instanceof WorkspaceError && e.status === 404
      )
    await pg.query('INSERT INTO "PrivateWorkspaceMember" ("workspaceId","userId",role) VALUES ($1,$2,$3)', [
      w.id,
      'viewer',
      'VIEWER'
    ])
    await pg.query(
      'INSERT INTO "PrivateCaseMember" ("workspaceId","caseId","userId",role) VALUES ($1,$2,$3,$4)',
      [w.id, c.id, 'viewer', 'VIEWER']
    )
    await authorisedHoneycombSearch(viewer, w.id, c.id, input, search)
    assert.equal(calls, 2)
    await pg.query('UPDATE "PrivateCaseMember" SET "revokedAt"=now() WHERE "userId"=$1', ['viewer'])
    await assert.rejects(
      authorisedHoneycombSearch(viewer, w.id, c.id, input, search),
      (e: unknown) => e instanceof WorkspaceError && e.status === 404
    )
    assert.equal(calls, 2)
  } finally {
    await pg.close()
  }
})
