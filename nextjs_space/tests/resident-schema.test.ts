import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
test('additive migration preserves baselines and defaults intake to private pending with retry uniqueness', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE TABLE "User" (id TEXT PRIMARY KEY); CREATE TABLE "Asset" (id TEXT PRIMARY KEY); CREATE TABLE "Event" (id TEXT PRIMARY KEY); CREATE TABLE "CapitalProject" (id TEXT PRIMARY KEY, value TEXT); CREATE TABLE "Authorisation" (id TEXT PRIMARY KEY); INSERT INTO "CapitalProject" VALUES ('baseline', '2025 capacity'); INSERT INTO "User" VALUES ('alice'), ('bob'); INSERT INTO "Asset" VALUES ('cam');`)
    await db.exec(fs.readFileSync('prisma/migrations/0004_port_provenance_resident_intake/migration.sql', 'utf8'))
    const sql = `INSERT INTO "ResidentSubmission" (id,"userId","assetId","requestId",category,description,"observedAt") VALUES ($1,$2,'cam','retry-key','RIVER','Cloudy water','2026-09-08')`
    await db.query(sql, ['a', 'alice'])
    await assert.rejects(db.query(sql, ['duplicate', 'alice']))
    await db.query(sql, ['b', 'bob'])
    const rows = await db.query<{ status: string; visibility: string }>(`SELECT status, visibility FROM "ResidentSubmission" WHERE "userId"='alice'`)
    assert.deepEqual(rows.rows, [{ status: 'PENDING_VERIFICATION', visibility: 'PRIVATE' }])
    await assert.rejects(db.exec(`UPDATE "ResidentSubmission" SET visibility='PUBLIC' WHERE id='a'`))
    const baseline = await db.query<{ value: string }>(`SELECT value FROM "CapitalProject" WHERE id='baseline'`)
    assert.equal(baseline.rows[0].value, '2025 capacity')
  } finally { await db.close() }
})
