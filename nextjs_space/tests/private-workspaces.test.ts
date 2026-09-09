import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { caseInput, permits, workspaceService, WorkspaceError, type Database, type Sql } from '../lib/workspaces/service'

test('role policy fails closed; export is a separate grant', () => {
  for (const role of ['OWNER', 'CONTRIBUTOR', 'REVIEWER', 'VIEWER']) {
    assert.equal(permits(role, 'read'), true)
    assert.equal(permits(role, 'export'), false)
    assert.equal(permits(role, 'export', true), true)
  }
  assert.equal(permits('ADMIN', 'read'), false)
  assert.equal(permits('ADMIN', 'export', true), false)
  assert.equal(permits('VIEWER', 'write'), false)
  assert.equal(permits('REVIEWER', 'write'), false)
  assert.equal(permits('CONTRIBUTOR', 'review'), false)
})
test('input bounds and unknown coordinates stay honest', () => {
  assert.deepEqual(caseInput({ title: 'Test', sites: [{ name: 'Site' }] }).sites[0], { name: 'Site', latitude: null, longitude: null })
  for (const value of [null, {}, { title: 'x'.repeat(181) }, { title: 'x', template: 'ADMIN' }, { title: 'x', sites: [{ name: 'x', latitude: 51 }] }, { title: 'x', sites: [{ name: 'x', latitude: NaN, longitude: 0 }] }, { title: 'x', sites: Array(21).fill({ name: 'x' }) }]) assert.throws(() => caseInput(value), WorkspaceError)
})
test('isolated PostgreSQL: scope, revocation, composite FKs, audit and rollback', async () => {
  const pg = new PGlite()
  try {
    await pg.exec('CREATE TABLE "User" (id TEXT PRIMARY KEY); INSERT INTO "User" VALUES (\'alice\'),(\'bob\'),(\'viewer\');')
    await pg.exec(readFileSync(new URL('../prisma/migrations/20260909_private_workspace_foundation/migration.sql', import.meta.url), 'utf8'))
    const sql = (client: Pick<PGlite, 'query'>): Sql => ({ query: async <T>(text: string, values: unknown[]) => (await client.query<T>(text, values)).rows })
    const db: Database = { ...sql(pg), transaction: operation => pg.transaction(tx => operation(sql(tx))) }
    const alice = workspaceService(db, 'alice'), bob = workspaceService(db, 'bob')
    assert.throws(() => workspaceService(db, ''), WorkspaceError)
    const wa = await alice.createWorkspace({ name: 'Alice private' }), wb = await bob.createWorkspace({ name: 'Bob private' })
    const ca = await alice.createCase(wa.id, { title: "Permit '; DROP TABLE x; --", template: 'PLANNING', sites: [{ name: 'First' }, { name: 'Second' }, { name: 'Third' }] })
    const cb = await bob.createCase(wb.id, { title: 'Freight imports', template: 'FREIGHT' })
    assert.deepEqual((await alice.listWorkspaces()).map(w => w.id), [wa.id])
    assert.equal((await alice.getCase(wa.id, ca.id)).sites.length, 3)
    assert.equal((await alice.listCases(wa.id))[0].title, "Permit '; DROP TABLE x; --")
    const denied = (p: Promise<unknown>) => assert.rejects(p, (e: unknown) => e instanceof WorkspaceError && e.status === 404)
    await denied(alice.listCases(wb.id))
    await denied(alice.createCase(wb.id, { title: 'Forged owner', userId: 'bob' }))
    await denied(alice.getCase(wb.id, cb.id))
    await denied(alice.getCase(wa.id, cb.id))
    await denied(alice.getCase(wa.id, 'missing'))
    await pg.query('INSERT INTO "PrivateWorkspaceMember" ("workspaceId","userId",role) VALUES ($1,$2,$3)', [wa.id, 'viewer', 'VIEWER'])
    const viewer = workspaceService(db, 'viewer')
    assert.deepEqual(await viewer.listCases(wa.id), []) // workspace membership alone never reveals cases
    await denied(viewer.getCase(wa.id, ca.id))
    await denied(viewer.createCase(wa.id, { title: 'Forbidden' }))
    await pg.query('INSERT INTO "PrivateCaseMember" ("workspaceId","caseId","userId",role) VALUES ($1,$2,$3,$4)', [wa.id, ca.id, 'viewer', 'VIEWER'])
    assert.equal((await viewer.getCase(wa.id, ca.id)).id, ca.id)
    await pg.query('UPDATE "PrivateCaseMember" SET "revokedAt"=now() WHERE "userId"=$1', ['viewer'])
    await denied(viewer.getCase(wa.id, ca.id))
    await pg.query('UPDATE "PrivateCaseMember" SET "revokedAt"=NULL WHERE "userId"=$1', ['viewer'])
    await pg.query('UPDATE "PrivateWorkspaceMember" SET "revokedAt"=now() WHERE "userId"=$1', ['viewer'])
    await denied(viewer.getCase(wa.id, ca.id))
    assert.deepEqual(await viewer.listWorkspaces(), [])
    await assert.rejects(pg.query('INSERT INTO "PrivateCaseSite" (id,"workspaceId","caseId",name) VALUES ($1,$2,$3,$4)', ['bad', wa.id, cb.id, 'Foreign site']))
    await assert.rejects(pg.query('INSERT INTO "PrivateCaseMember" ("workspaceId","caseId","userId",role) VALUES ($1,$2,$3,$4)', [wa.id, cb.id, 'alice', 'OWNER']))
    const audits = await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM "PrivateWorkspaceAudit"')
    assert.equal(audits.rows[0].count, 4)
    const exports = await pg.query<{ canExport: boolean }>('SELECT "canExport" FROM "PrivateCaseMember"')
    assert.equal(exports.rows.every(r => !r.canExport), true)
    // A failed user FK must roll back the workspace insert and its audit together.
    await assert.rejects(workspaceService(db, 'missing-user').createWorkspace({ name: 'Must roll back' }))
    assert.equal((await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM "PrivateWorkspace"')).rows[0].count, 2)
  } finally { await pg.close() }
})
