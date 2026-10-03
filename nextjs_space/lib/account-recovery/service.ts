import { randomUUID } from 'node:crypto'
import type { Database, Sql } from '../workspaces/service'
import { normaliseEmail } from './email'
import { validatePassword } from './password-policy'
import { generateResetToken, hashToken, RESET_TOKEN_TTL_MS } from './tokens'
import { consumeRateLimit, RATE_LIMITS } from './rate-limit'

// Core account-recovery logic, written against the raw Sql/Database abstraction
// so it runs identically in production (Prisma) and in isolated PGlite tests.
// Every public response is deliberately identical whether or not an account
// exists, so account enumeration is impossible.

export class AccountRecoveryError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'AccountRecoveryError'
  }
}

export type RecoveryDeps = {
  sendEmail: (input: { to: string; resetUrl: string }) => Promise<void>
  buildResetLink: (rawToken: string) => string
  hashPassword: (plain: string) => Promise<string>
  now?: () => Date
  generateToken?: () => { raw: string; hash: string }
}

export function accountRecoveryService(db: Database, deps: RecoveryDeps) {
  const now = () => (deps.now ? deps.now() : new Date())
  const genToken = deps.generateToken ?? generateResetToken

  async function requestReset(input: { email: unknown; ip: string }): Promise<{ ok: true }> {
    const at = now()

    // IP rate limit first, so a flood of malformed requests still cannot be used
    // to hammer the endpoint.
    const ipLimit = await consumeRateLimit(db, 'resetRequestIp', input.ip, RATE_LIMITS.resetRequestIp, at)
    if (!ipLimit.allowed) throw new AccountRecoveryError(429, 'Too many requests. Please try again later.')

    const email = normaliseEmail(input.email)
    if (!email) throw new AccountRecoveryError(400, 'A valid email address is required')

    const emailLimit = await consumeRateLimit(db, 'resetRequestEmail', email, RATE_LIMITS.resetRequestEmail, at)
    if (!emailLimit.allowed) throw new AccountRecoveryError(429, 'Too many requests. Please try again later.')

    const users = await db.query<{ id: string; password: string | null }>(
      'SELECT id, password FROM "User" WHERE email = $1',
      [email],
    )
    const user = users[0]
    // Unknown account, or an account with no password (e.g. OAuth-only): behave
    // exactly like the success path and issue nothing.
    if (!user || !user.password) return { ok: true }

    const token = genToken()
    const expiresAt = new Date(at.getTime() + RESET_TOKEN_TTL_MS)

    await db.transaction(async (tx) => {
      // Issuing a new token invalidates any prior unused tokens for this user.
      await tx.query(
        'UPDATE "PasswordResetToken" SET "consumedAt" = $2 WHERE "userId" = $1 AND "consumedAt" IS NULL',
        [user.id, at],
      )
      await tx.query(
        `INSERT INTO "PasswordResetToken" ("id","userId","tokenHash","expiresAt","createdAt")
         VALUES ($1,$2,$3,$4,$5)`,
        [randomUUID(), user.id, token.hash, expiresAt, at],
      )
    })

    try {
      await deps.sendEmail({ to: email, resetUrl: deps.buildResetLink(token.raw) })
    } catch {
      // Delivery failed: invalidate the token we just issued so it cannot linger,
      // but still return the generic success response (no enumeration, no leak).
      await db.query(
        'UPDATE "PasswordResetToken" SET "consumedAt" = $2 WHERE "tokenHash" = $1 AND "consumedAt" IS NULL',
        [token.hash, now()],
      )
      return { ok: true }
    }

    return { ok: true }
  }

  async function consumeReset(input: { token: unknown; newPassword: unknown; ip: string }): Promise<{ ok: true }> {
    const at = now()

    const ipLimit = await consumeRateLimit(db, 'resetSubmitIp', input.ip, RATE_LIMITS.resetSubmitIp, at)
    if (!ipLimit.allowed) throw new AccountRecoveryError(429, 'Too many requests. Please try again later.')

    if (typeof input.token !== 'string' || !input.token) {
      throw new AccountRecoveryError(400, 'This reset link is invalid or has expired')
    }
    const policy = validatePassword(input.newPassword)
    if (!policy.ok) throw new AccountRecoveryError(400, policy.error)

    const tokenHash = hashToken(input.token)
    // Hash the new password before opening the transaction to keep the critical
    // section short.
    const passwordHash = await deps.hashPassword(input.newPassword as string)

    await db.transaction(async (tx) => {
      // Atomically claim the token: only an unused, unexpired token matches, and
      // RETURNING confirms exactly one row was consumed. Concurrent/repeat
      // submissions find zero rows.
      const claimed = await tx.query<{ userId: string }>(
        `UPDATE "PasswordResetToken" SET "consumedAt" = $2
         WHERE "tokenHash" = $1 AND "consumedAt" IS NULL AND "expiresAt" > $2
         RETURNING "userId"`,
        [tokenHash, at],
      )
      const row = claimed[0]
      if (!row) throw new AccountRecoveryError(400, 'This reset link is invalid or has expired')

      // Set the new password and bump authVersion so every existing JWT/session
      // for this user is invalidated.
      await tx.query(
        'UPDATE "User" SET "password" = $2, "authVersion" = "authVersion" + 1, "updatedAt" = $3 WHERE "id" = $1',
        [row.userId, passwordHash, at],
      )
      // Invalidate any other outstanding tokens for this user.
      await tx.query(
        'UPDATE "PasswordResetToken" SET "consumedAt" = $2 WHERE "userId" = $1 AND "consumedAt" IS NULL',
        [row.userId, at],
      )
    })

    return { ok: true }
  }

  return { requestReset, consumeReset }
}

export type { Database, Sql }
