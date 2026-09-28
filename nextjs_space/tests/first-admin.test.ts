import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import type { Database, Sql } from '../lib/workspaces/service'
import { checkFirstAdmin, grantFirstAdmin, FirstAdminError, type FirstAdminInput } from '../lib/identity/first-admin'

const MIGRATION = readFileSync(new URL('../prisma/migrations/20261002_admin_grant_audit/migration.sql', import.meta.url), 'utf8')
const TARGET = 'admin@bioveracity.com'
const PW = 'bcrypt-hash-placeholder'

async function setup(users: Array<{ id: string; email: string; verified?: boolean; password?: string | null; role?: string; accessState?: string }>) {
  const pg = new PGlite()
  await pg.exec(`CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT, "emailVerified" TIMESTAMP(3),
    role TEXT NOT NULL DEFAULT 'user', "accessState" TEXT NOT NULL DEFAULT 'REGISTERED', "authVersion" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
  await pg.exec(MIGRATION)
  await pg.exec(MIGRATION) // re-runnable
  for (const u of users) {
    await pg.query('INSERT INTO "User" (id,email,password,"emailVerified",role,"accessState") VALUES ($1,$2,$3,$4,$5,$6)',
      [u.id, u.email, u.password === undefined ? PW : u.password, u.verified === false ? null : new Date('2026-09-28T09:32:00Z'), u.role ?? 'user', u.accessState ?? 'REGISTERED'])
  }
  const sql = (c: Pick<PGlite, 'query'>): Sql => ({ query: async <T>(t: string, v: unknown[]) => (await c.query<T>(t, v)).rows })
  const db: Database = { ...sql(pg), transaction: (op) => pg.transaction((tx) => op(sql(tx))) }
  const user = async (id: string) => (await pg.query<any>('SELECT role,"accessState","authVersion",password FROM "User" WHERE id=$1', [id])).rows[0]
  const audits = async () => (await pg.query<any>('SELECT * FROM "AdminGrantAudit"')).rows
  return { pg, db, user, audits }
}

// Mirrors production: three unverified placeholder admins plus the human-created target.
const prodLike = () => [
  { id: 'seed', email: 'admin@example.com', verified: false, role: 'admin', accessState: 'ADMIN' },
  { id: 'stg', email: 'p@staging.test', verified: false, role: 'admin', accessState: 'ADMIN' },
  { id: 'target', email: TARGET },
]
const input = (o: Partial<FirstAdminInput> = {}): FirstAdminInput =>
  ({ email: TARGET, confirm: TARGET, operator: 'agent (operator CLI)', authorisedBy: 'Bazil Cromer', reason: 'first production administrator', ...o })

async function refuses(o: { users?: Parameters<typeof setup>[0]; input?: Partial<FirstAdminInput> }, code: string) {
  const h = await setup(o.users ?? prodLike())
  const before = await h.user('target')
  await assert.rejects(grantFirstAdmin(h.db, input(o.input)), (e: unknown) => e instanceof FirstAdminError && e.code === code)
  if (before) assert.deepEqual(await h.user('target'), before, 'target unchanged after refusal')
  assert.equal((await h.audits()).length, 0, 'no audit row after refusal')
}

test('success: grants admin, bumps authVersion, writes one audit row, never touches password', async () => {
  const h = await setup(prodLike())
  const plan = await checkFirstAdmin(h.db, input())
  assert.equal(plan.verifiedAdminsBefore, 0)
  assert.deepEqual(await h.user('target'), { role: 'user', accessState: 'REGISTERED', authVersion: 0, password: PW }, 'check is read-only')
  const r = await grantFirstAdmin(h.db, input(), () => new Date('2026-09-28T12:00:00Z'))
  assert.deepEqual(r.before, { role: 'user', accessState: 'REGISTERED', authVersion: 0 })
  assert.deepEqual(r.after, { role: 'admin', accessState: 'ADMIN', authVersion: 1 })
  assert.deepEqual(await h.user('target'), { role: 'admin', accessState: 'ADMIN', authVersion: 1, password: PW })
  const [a, ...rest] = await h.audits()
  assert.equal(rest.length, 0)
  assert.equal(a.action, 'FIRST_ADMIN_GRANT'); assert.equal(a.userId, 'target'); assert.equal(a.email, TARGET)
  assert.equal(a.authorisedBy, 'Bazil Cromer'); assert.equal(a.beforeRole, 'user'); assert.equal(a.afterRole, 'admin')
  assert.equal(a.beforeAuthVersion, 0); assert.equal(a.afterAuthVersion, 1); assert.equal(a.verifiedAdminsBefore, 0)
  assert.equal(new Date(a.grantedAt).toISOString(), '2026-09-28T12:00:00.000Z')
  assert.ok(!Object.keys(a).some((k) => /password|hash|token|code|secret/i.test(k)), 'audit has no secret columns')
  assert.deepEqual(await h.user('seed'), { role: 'admin', accessState: 'ADMIN', authVersion: 0, password: PW }, 'other accounts untouched')
})

test('second run refuses: a verified administrator now exists', async () => {
  const h = await setup([...prodLike(), { id: 'other', email: 'second@bioveracity.com' }])
  await grantFirstAdmin(h.db, input())
  await assert.rejects(grantFirstAdmin(h.db, input({ email: 'second@bioveracity.com', confirm: 'second@bioveracity.com' })),
    (e: unknown) => e instanceof FirstAdminError && e.code === 'verified_admin_exists')
  assert.equal((await h.audits()).length, 1)
})

test('refuses unverified account', () => refuses({ users: [{ id: 'target', email: TARGET, verified: false }] }, 'email_not_verified'))
test('refuses account without password credential', () => refuses({ users: [{ id: 'target', email: TARGET, password: null }] }, 'no_password_credential'))
test('refuses non-user role', () => refuses({ users: [{ id: 'target', email: TARGET, role: 'partner_member' }] }, 'not_role_user'))
test('refuses accessState ADMIN even with role user', () => refuses({ users: [{ id: 'target', email: TARGET, accessState: 'ADMIN' }] }, 'not_role_user'))
test('refuses when a verified admin already exists', () =>
  refuses({ users: [...prodLike(), { id: 'real', email: 'real@bioveracity.com', role: 'admin', accessState: 'ADMIN' }] }, 'verified_admin_exists'))
test('refuses when a verified accessState=ADMIN account exists', () =>
  refuses({ users: [...prodLike(), { id: 'real', email: 'real@bioveracity.com', accessState: 'ADMIN' }] }, 'verified_admin_exists'))
test('refuses unknown account', () => refuses({ input: { email: 'nobody@bioveracity.com', confirm: 'nobody@bioveracity.com' } }, 'account_not_found'))
test('refuses confirmation mismatch', () => refuses({ input: { confirm: 'admin@bioveracity.co' } }, 'confirmation_mismatch'))
test('refuses non-exact email (case/whitespace are not folded)', async () => {
  await refuses({ input: { email: 'Admin@bioveracity.com', confirm: 'Admin@bioveracity.com' } }, 'invalid_email')
  await refuses({ input: { email: ' admin@bioveracity.com', confirm: ' admin@bioveracity.com' } }, 'invalid_email')
})
test('refuses missing attribution', () => refuses({ input: { authorisedBy: ' ' } }, 'missing_attribution'))

test('grant rolls back entirely if the audit insert fails', async () => {
  const h = await setup(prodLike())
  await h.pg.exec('ALTER TABLE "AdminGrantAudit" RENAME TO "AdminGrantAudit_x"')
  await assert.rejects(grantFirstAdmin(h.db, input()))
  assert.deepEqual(await h.user('target'), { role: 'user', accessState: 'REGISTERED', authVersion: 0, password: PW })
})

test('audit table is append-only', async () => {
  const h = await setup(prodLike())
  await grantFirstAdmin(h.db, input())
  await assert.rejects(h.pg.query(`UPDATE "AdminGrantAudit" SET reason='x'`), /append-only/)
  await assert.rejects(h.pg.query(`DELETE FROM "AdminGrantAudit"`), /append-only/)
  assert.equal((await h.audits()).length, 1)
})

test('module never reads/writes passwords or step-up codes and leaves auth flags alone', () => {
  const src = readFileSync(new URL('../lib/identity/first-admin.ts', import.meta.url), 'utf8') +
    readFileSync(new URL('../scripts/grant-first-admin.ts', import.meta.url), 'utf8')
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  // Inspect SQL template literals only: password may appear solely as a boolean projection.
  const sqlText = (code.match(/`[^`]*`/g) ?? []).filter((s) => /\b(SELECT|UPDATE|INSERT|DELETE)\b/i.test(s))
  assert.ok(sqlText.length >= 4, 'expected SQL statements to inspect')
  for (const s of sqlText) {
    assert.doesNotMatch(s.replace(/\(password IS NOT NULL\)/g, ''), /\bpassword\b/i, s)
  }
  assert.doesNotMatch(code, /IdentityChallenge|ADMIN_LOGIN|adminCode|bcrypt/)
  assert.doesNotMatch(code, /AUTH_REQUIRE_VERIFIED_EMAIL|AUTH_ADMIN_EMAIL_STEP_UP|process\.env/)
})
