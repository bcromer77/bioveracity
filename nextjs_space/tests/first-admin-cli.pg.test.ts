// Real Prisma + PostgreSQL regression test for the first-admin operator CLI.
// The PGlite suite (first-admin.test.ts) uses a different query adapter and cannot catch
// Prisma deserialisation failures (e.g. void-returning SQL). This test runs the actual CLI.
//
//   FIRST_ADMIN_PG_ADMIN_URL=postgresql://user@127.0.0.1:PORT/postgres \
//     node --import tsx --test tests/first-admin-cli.pg.test.ts
//
// Loopback servers only: it creates and drops its own scratch database and refuses any other host.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const ADMIN_URL = process.env.FIRST_ADMIN_PG_ADMIN_URL ?? ''
const APP = fileURLToPath(new URL('..', import.meta.url))
const PRISMA = join(APP, 'node_modules/.bin/prisma')
const MIGRATION = join(APP, 'prisma/migrations/20261002_admin_grant_audit/migration.sql')
const TARGET = 'admin@bioveracity.com'
const PW = 'bcrypt-hash-placeholder'
const skip = ADMIN_URL ? false : 'FIRST_ADMIN_PG_ADMIN_URL not set (needs a disposable loopback PostgreSQL)'

let dbName = ''
let dbUrl = ''
let admin: PrismaClient
let scratch: PrismaClient
let tmp = ''

function urlFor(db: string) { const u = new URL(ADMIN_URL); u.pathname = `/${db}`; return u.toString() }

function execSql(url: string, sqlText: string) {
  const f = join(tmp, `s${randomBytes(4).toString('hex')}.sql`)
  writeFileSync(f, sqlText)
  const r = spawnSync(PRISMA, ['db', 'execute', '--url', url, '--file', f], { encoding: 'utf8', env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' } })
  assert.equal(r.status, 0, r.stderr || r.stdout)
}

const ARGS = ['--email', TARGET, '--operator', 'pg regression test', '--authorised-by', 'test', '--reason', 'CLI regression']
function cliArgs(extra: string[]) { return ['--import', 'tsx', 'scripts/grant-first-admin.ts', ...ARGS, ...extra] }
function cliEnv() { return { ...process.env, DATABASE_URL: dbUrl, PRISMA_HIDE_UPDATE_MESSAGE: '1' } }

function cli(extra: string[] = []) {
  const r = spawnSync(process.execPath, cliArgs(extra), { cwd: APP, encoding: 'utf8', env: cliEnv() })
  return { code: r.status, out: r.stdout, err: r.stderr }
}

function cliAsync(extra: string[]): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((res) => {
    const p = spawn(process.execPath, cliArgs(extra), { cwd: APP, env: cliEnv() })
    let out = '', err = ''
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => res({ code, out, err }))
  })
}

const target = async () => (await scratch.$queryRawUnsafe<any[]>(
  `SELECT role, "accessState", "authVersion", password FROM "User" WHERE email = $1`, TARGET))[0]
const audits = async () => scratch.$queryRawUnsafe<any[]>(`SELECT * FROM "AdminGrantAudit"`)

async function resetTarget() {
  // Test-only reset on the scratch database; the audit trigger requires TRUNCATE rather than DELETE.
  await scratch.$executeRawUnsafe(`TRUNCATE "AdminGrantAudit"`)
  await scratch.$executeRawUnsafe(`UPDATE "User" SET role='user', "accessState"='REGISTERED', "authVersion"=0 WHERE email=$1`, TARGET)
}

before(async () => {
  if (skip) return
  const host = new URL(ADMIN_URL).hostname
  assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host), `refusing non-loopback host ${host}`)
  tmp = mkdtempSync(join(tmpdir(), 'first-admin-pg-'))
  dbName = `bv_first_admin_${randomBytes(6).toString('hex')}`
  dbUrl = urlFor(dbName)
  admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } })
  await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`)
  execSql(dbUrl, `CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT, "emailVerified" TIMESTAMP(3),
    role TEXT NOT NULL DEFAULT 'user', "accessState" TEXT NOT NULL DEFAULT 'REGISTERED', "authVersion" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
  INSERT INTO "User" (id, email, password, "emailVerified", role, "accessState") VALUES
    ('seed', 'admin@example.com', '${PW}', NULL, 'admin', 'ADMIN'),
    ('stg', 'p@staging.test', '${PW}', NULL, 'admin', 'ADMIN'),
    ('target', '${TARGET}', '${PW}', '2026-09-28 09:32:00', 'user', 'REGISTERED');`)
  execSql(dbUrl, (await import('node:fs')).readFileSync(MIGRATION, 'utf8'))
  scratch = new PrismaClient({ datasources: { db: { url: dbUrl } } })
})

after(async () => {
  if (skip) return
  await scratch?.$disconnect()
  if (admin) {
    await admin.$executeRawUnsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, dbName).catch(() => {})
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`)
    await admin.$disconnect()
  }
  if (tmp) rmSync(tmp, { recursive: true, force: true })
})

test('real CLI: check-only, confirmation refusal, grant, second-run refusal, append-only', { skip }, async () => {
  const check = cli()
  assert.equal(check.code, 0, check.err)
  assert.match(check.out, /check-only \(no writes\)/)
  assert.deepEqual(await target(), { role: 'user', accessState: 'REGISTERED', authVersion: 0, password: PW })

  const bad = cli(['--grant', '--confirm', 'admin@bioveracity.COM'])
  assert.equal(bad.code, 2)
  assert.match(bad.err, /confirmation_mismatch/)

  const grant = cli(['--grant', '--confirm', TARGET])
  assert.equal(grant.code, 0, `grant failed: ${grant.err}`)
  const out = JSON.parse(grant.out)
  assert.deepEqual(out.after, { role: 'admin', accessState: 'ADMIN', authVersion: 1 })
  assert.deepEqual(await target(), { role: 'admin', accessState: 'ADMIN', authVersion: 1, password: PW })
  const rows = await audits()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, out.auditId)
  assert.equal(rows[0].action, 'FIRST_ADMIN_GRANT')
  assert.equal(rows[0].verifiedAdminsBefore, 0)

  const second = cli(['--grant', '--confirm', TARGET])
  assert.equal(second.code, 2)
  assert.match(second.err, /not_role_user/)
  assert.equal((await audits()).length, 1)

  await assert.rejects(scratch.$executeRawUnsafe(`UPDATE "AdminGrantAudit" SET reason = 'x'`), /append-only/)
  await assert.rejects(scratch.$executeRawUnsafe(`DELETE FROM "AdminGrantAudit"`), /append-only/)
})

test('real CLI: two concurrent grants produce exactly one admin and one audit row', { skip }, async () => {
  await resetTarget()
  const [a, b] = await Promise.all([cliAsync(['--grant', '--confirm', TARGET]), cliAsync(['--grant', '--confirm', TARGET])])
  // Exactly one wins. The loser either sees the refusal (exit 2) or is aborted by PostgreSQL with a
  // SERIALIZABLE conflict (40001, exit 1) and rolled back; both are fail-closed.
  const [win, lose] = a.code === 0 ? [a, b] : [b, a]
  assert.equal(win.code, 0, `no winner: ${a.err} ${b.err}`)
  assert.ok((lose.code === 2 && /not_role_user/.test(lose.err)) || (lose.code === 1 && /40001|could not serialize/.test(lose.err)),
    `unexpected loser outcome ${lose.code}: ${lose.err}`)
  assert.deepEqual(await target(), { role: 'admin', accessState: 'ADMIN', authVersion: 1, password: PW })
  assert.equal((await audits()).length, 1)
})
