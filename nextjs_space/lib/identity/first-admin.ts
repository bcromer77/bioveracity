// First production administrator bootstrap (Identity & Trust).
//
// Grants the admin role to exactly ONE existing, human-created, email-verified
// account, and only while no verified administrator exists. It never reads,
// sets or handles a password, never creates or reads an administrator step-up
// code, and does not change AUTH_REQUIRE_VERIFIED_EMAIL / AUTH_ADMIN_EMAIL_STEP_UP.
// authVersion is incremented so every existing session for the account is
// invalidated and the next sign-in must pass the emailed administrator step-up.
// Every grant writes an append-only AdminGrantAudit row in the same transaction.

import { randomUUID } from 'node:crypto'
import type { Database } from '../workspaces/service'

export type FirstAdminRefusal =
  | 'invalid_email' | 'confirmation_mismatch' | 'missing_attribution' | 'account_not_found'
  | 'email_not_verified' | 'no_password_credential' | 'not_role_user' | 'verified_admin_exists'

export class FirstAdminError extends Error {
  constructor(public code: FirstAdminRefusal, message: string) { super(message) }
}

export interface AccountState { role: string; accessState: string; authVersion: number }
export interface FirstAdminInput { email: string; confirm: string; operator: string; authorisedBy: string; reason: string }
export interface FirstAdminPlan { userId: string; email: string; before: AccountState; verifiedAdminsBefore: number }
export interface FirstAdminResult extends FirstAdminPlan { auditId: string; after: AccountState; grantedAt: string }

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/
const label = (v: string) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 200

function validate(i: FirstAdminInput) {
  // Exact email only: no trimming or case-folding on the operator's behalf.
  if (typeof i.email !== 'string' || !EMAIL.test(i.email)) throw new FirstAdminError('invalid_email', 'Provide one exact, lower-case email address.')
  if (i.confirm !== i.email) throw new FirstAdminError('confirmation_mismatch', 'Confirmation must repeat the exact email address.')
  if (!label(i.operator) || !label(i.authorisedBy) || !label(i.reason)) throw new FirstAdminError('missing_attribution', 'operator, authorised-by and reason are required.')
}

// Read-only precondition check. Same rules as the grant; performs no writes.
async function inspect(sql: Pick<Database, 'query'>, email: string, lock: boolean): Promise<FirstAdminPlan> {
  const [u] = await sql.query<{ id: string; email: string; verified: boolean; has_password: boolean; role: string; accessState: string; authVersion: number }>(
    `SELECT id, email, ("emailVerified" IS NOT NULL) AS verified, (password IS NOT NULL) AS has_password,
            role, "accessState", "authVersion" FROM "User" WHERE email = $1${lock ? ' FOR UPDATE' : ''}`, [email])
  if (!u) throw new FirstAdminError('account_not_found', 'No account with exactly that email exists.')
  if (!u.verified) throw new FirstAdminError('email_not_verified', 'The account email is not verified.')
  if (!u.has_password) throw new FirstAdminError('no_password_credential', 'The account has no password credential.')
  if (u.role !== 'user' || u.accessState === 'ADMIN') throw new FirstAdminError('not_role_user', 'The account is not currently an ordinary user.')
  const [c] = await sql.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM "User" WHERE (role = 'admin' OR "accessState" = 'ADMIN') AND "emailVerified" IS NOT NULL`, [])
  const verifiedAdminsBefore = Number(c?.n ?? 0)
  if (verifiedAdminsBefore > 0) throw new FirstAdminError('verified_admin_exists', 'A verified administrator already exists; this bootstrap only creates the first.')
  return { userId: u.id, email: u.email, before: { role: u.role, accessState: u.accessState, authVersion: Number(u.authVersion) }, verifiedAdminsBefore }
}

export async function checkFirstAdmin(db: Pick<Database, 'query'>, input: FirstAdminInput): Promise<FirstAdminPlan> {
  validate(input)
  return inspect(db, input.email, false)
}

// The caller must supply a Database whose transaction() runs at SERIALIZABLE isolation.
export async function grantFirstAdmin(db: Database, input: FirstAdminInput, now: () => Date = () => new Date()): Promise<FirstAdminResult> {
  validate(input)
  return db.transaction(async (sql) => {
    // Serialise concurrent bootstrap attempts, in addition to SERIALIZABLE isolation.
    // pg_advisory_xact_lock returns void, which Prisma raw queries cannot deserialise; project a constant.
    await sql.query(`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('bioveracity:first-admin-bootstrap'))`, [])
    const plan = await inspect(sql, input.email, true)
    const at = now()
    const [row] = await sql.query<{ role: string; accessState: string; authVersion: number }>(
      `UPDATE "User" SET role = 'admin', "accessState" = 'ADMIN', "authVersion" = "authVersion" + 1, "updatedAt" = $2
        WHERE id = $1 AND role = 'user' RETURNING role, "accessState", "authVersion"`, [plan.userId, at])
    if (!row) throw new FirstAdminError('not_role_user', 'The account changed during the grant.')
    const after = { role: row.role, accessState: row.accessState, authVersion: Number(row.authVersion) }
    const auditId = randomUUID()
    await sql.query(
      `INSERT INTO "AdminGrantAudit" (id, action, "userId", email, operator, "authorisedBy", reason,
         "beforeRole", "beforeAccessState", "beforeAuthVersion", "afterRole", "afterAccessState", "afterAuthVersion",
         "verifiedAdminsBefore", "grantedAt")
       VALUES ($1,'FIRST_ADMIN_GRANT',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [auditId, plan.userId, plan.email, input.operator.trim(), input.authorisedBy.trim(), input.reason.trim(),
       plan.before.role, plan.before.accessState, plan.before.authVersion, after.role, after.accessState, after.authVersion,
       plan.verifiedAdminsBefore, at])
    return { ...plan, auditId, after, grantedAt: at.toISOString() }
  })
}
