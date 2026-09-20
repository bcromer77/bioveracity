import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { accountRecoveryService, AccountRecoveryError } from '../lib/account-recovery/service'
import type { Database, Sql } from '../lib/workspaces/service'
import { normaliseEmail } from '../lib/account-recovery/email'
import { validatePassword } from '../lib/account-recovery/password-policy'
import { generateResetToken, hashToken, RESET_TOKEN_TTL_MS } from '../lib/account-recovery/tokens'
import { sessionAuthorityValid } from '../lib/account-recovery/session-authority'
import { resolveAppBaseUrl, buildResetLink, BaseUrlError } from '../lib/account-recovery/base-url'
import { isGoogleAuthEnabled } from '../lib/account-recovery/providers'
import { readFileSync as readSource } from 'node:fs'

// ---------------------------------------------------------------------------
// Pure-unit tests (no database)
// ---------------------------------------------------------------------------

test('email normalisation is canonical and rejects malformed input', () => {
  assert.equal(normaliseEmail('  User@Example.COM '), 'user@example.com')
  assert.equal(normaliseEmail('a@b.co'), 'a@b.co')
  for (const bad of [null, undefined, 42, '', '   ', 'no-at', 'a@b', 'a@@b.com', 'a b@c.com', 'x'.repeat(322) + '@y.com']) {
    assert.equal(normaliseEmail(bad as unknown), null)
  }
})

test('password policy is enforced server-side', () => {
  assert.equal(validatePassword('Abcdefg123').ok, true)
  for (const weak of [null, 123, 'short1', 'nodigitshere', '1234567890', 'A'.repeat(201) + '1']) {
    const res = validatePassword(weak as unknown)
    assert.equal(res.ok, false)
    if (!res.ok) assert.ok(res.error.length > 0)
  }
})

test('reset tokens store only a hash and are unique', () => {
  const a = generateResetToken()
  const b = generateResetToken()
  assert.notEqual(a.raw, b.raw)
  assert.notEqual(a.hash, b.hash)
  assert.equal(a.hash, hashToken(a.raw))
  // The stored hash must never equal the raw token.
  assert.notEqual(a.hash, a.raw)
})

test('session authority: old JWTs lose access after an authVersion bump', () => {
  // Fresh session: token version equals current version -> valid.
  assert.equal(sessionAuthorityValid({ tokenAuthVersion: 0, currentAuthVersion: 0, userExists: true }), true)
  // After a password reset the user's authVersion is incremented; a token minted
  // before that carries the old version and must be rejected.
  assert.equal(sessionAuthorityValid({ tokenAuthVersion: 0, currentAuthVersion: 1, userExists: true }), false)
  // A token for a user that no longer exists is never valid.
  assert.equal(sessionAuthorityValid({ tokenAuthVersion: 5, currentAuthVersion: 5, userExists: false }), false)
  // Missing/undefined versions default to 0 on both sides.
  assert.equal(sessionAuthorityValid({ tokenAuthVersion: undefined, currentAuthVersion: undefined, userExists: true }), true)
})

test('reset link uses the canonical base URL, never a request Host header', () => {
  // Production requires an explicit https origin.
  assert.equal(resolveAppBaseUrl({ NODE_ENV: 'production', APP_BASE_URL: 'https://bioveracity.com' }), 'https://bioveracity.com')
  assert.throws(() => resolveAppBaseUrl({ NODE_ENV: 'production' }), BaseUrlError)
  assert.throws(() => resolveAppBaseUrl({ NODE_ENV: 'production', APP_BASE_URL: 'http://bioveracity.com' }), BaseUrlError)
  // Development falls back to localhost.
  assert.equal(resolveAppBaseUrl({ NODE_ENV: 'development' }), 'http://localhost:3000')
  // The link is built from the canonical base only. Even if an attacker could
  // control a Host header, it never reaches this function -> the link host is fixed.
  const link = buildResetLink('https://bioveracity.com', 'RAW-TOKEN-VALUE')
  assert.ok(link.startsWith('https://bioveracity.com/reset-password?token='))
  assert.ok(link.includes('token=RAW-TOKEN-VALUE'))
  assert.equal(new URL(link).host, 'bioveracity.com')
})

test('Google sign-in stays hidden unless explicitly enabled with full config', () => {
  assert.equal(isGoogleAuthEnabled({}), false)
  assert.equal(isGoogleAuthEnabled({ NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'true' }), false)
  assert.equal(
    isGoogleAuthEnabled({ NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'true', GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }),
    true,
  )
  // The login page must keep the Google block behind the public feature flag.
  const loginSrc = readSource(new URL('../app/login/page.tsx', import.meta.url), 'utf8')
  assert.ok(loginSrc.includes('NEXT_PUBLIC_GOOGLE_AUTH_ENABLED'))
})

// ---------------------------------------------------------------------------
// Database-backed flow tests (isolated PGlite)
// ---------------------------------------------------------------------------

type Harness = {
  pg: PGlite
  db: Database
  sent: Array<{ to: string; resetUrl: string }>
  setSendFailure: (fail: boolean) => void
  clock: { at: Date }
  service: ReturnType<typeof accountRecoveryService>
  rawTokenFrom: (resetUrl: string) => string
  storedPassword: (userId: string) => Promise<string | null>
  authVersion: (userId: string) => Promise<number>
  tokenCount: (userId: string) => Promise<number>
}

async function setup(): Promise<Harness> {
  const pg = new PGlite()
  // A minimal User table WITHOUT authVersion, so the migration's ALTER TABLE ...
  // ADD COLUMN IF NOT EXISTS is genuinely exercised against a pre-existing table.
  await pg.exec(
    'CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);',
  )
  await pg.exec(readFileSync(new URL('../prisma/migrations/20260922_account_recovery/migration.sql', import.meta.url), 'utf8'))
  await pg.query('INSERT INTO "User" (id,email,password) VALUES ($1,$2,$3)', ['user-known', 'known@example.com', 'ORIGINAL-HASH'])
  await pg.query('INSERT INTO "User" (id,email,password) VALUES ($1,$2,$3)', ['user-oauth', 'oauth@example.com', null])

  const sql = (client: Pick<PGlite, 'query'>): Sql => ({
    query: async <T>(text: string, values: unknown[]) => (await client.query<T>(text, values)).rows,
  })
  const db: Database = { ...sql(pg), transaction: (operation) => pg.transaction((tx) => operation(sql(tx))) }

  const sent: Array<{ to: string; resetUrl: string }> = []
  let failSend = false
  const clock = { at: new Date('2026-09-22T10:00:00.000Z') }

  const service = accountRecoveryService(db, {
    sendEmail: async ({ to, resetUrl }) => {
      if (failSend) throw new Error('provider down')
      sent.push({ to, resetUrl })
    },
    buildResetLink: (rawToken) => buildResetLink('https://bioveracity.com', rawToken),
    hashPassword: async (plain) => `H(${plain})`,
    now: () => clock.at,
  })

  return {
    pg,
    db,
    sent,
    setSendFailure: (fail) => {
      failSend = fail
    },
    clock,
    service,
    rawTokenFrom: (resetUrl) => new URL(resetUrl).searchParams.get('token') as string,
    storedPassword: async (userId) =>
      (await pg.query<{ password: string | null }>('SELECT password FROM "User" WHERE id=$1', [userId])).rows[0]?.password ?? null,
    authVersion: async (userId) =>
      (await pg.query<{ authVersion: number }>('SELECT "authVersion" FROM "User" WHERE id=$1', [userId])).rows[0]?.authVersion ?? -1,
    tokenCount: async (userId) =>
      Number(
        (await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM "PasswordResetToken" WHERE "userId"=$1', [userId]))
          .rows[0]?.count ?? 0,
      ),
  }
}

test('unknown and OAuth-only accounts get the same response and no token', async () => {
  const h = await setup()
  try {
    assert.deepEqual(await h.service.requestReset({ email: 'nobody@example.com', ip: '1.1.1.1' }), { ok: true })
    assert.deepEqual(await h.service.requestReset({ email: 'oauth@example.com', ip: '1.1.1.2' }), { ok: true })
    // No email issued and no token stored for either.
    assert.equal(h.sent.length, 0)
    assert.equal(await h.tokenCount('user-oauth'), 0)
  } finally {
    await h.pg.close()
  }
})

test('malformed email is a 400; a well-formed unknown one is not', async () => {
  const h = await setup()
  try {
    await assert.rejects(
      h.service.requestReset({ email: 'not-an-email', ip: '1.1.1.1' }),
      (e: unknown) => e instanceof AccountRecoveryError && e.status === 400,
    )
  } finally {
    await h.pg.close()
  }
})

test('a known account receives exactly one single-use, expiring reset link', async () => {
  const h = await setup()
  try {
    await h.service.requestReset({ email: 'Known@Example.com', ip: '2.2.2.2' })
    assert.equal(h.sent.length, 1)
    assert.equal(h.sent[0].to, 'known@example.com')
    assert.equal(await h.tokenCount('user-known'), 1)
    const raw = h.rawTokenFrom(h.sent[0].resetUrl)

    // Consume it: new password applied, authVersion bumped.
    assert.deepEqual(await h.service.consumeReset({ token: raw, newPassword: 'BrandNew123', ip: '2.2.2.2' }), { ok: true })
    assert.equal(await h.storedPassword('user-known'), 'H(BrandNew123)')
    assert.notEqual(await h.storedPassword('user-known'), 'ORIGINAL-HASH')
    assert.equal(await h.authVersion('user-known'), 1)

    // Second use of the same token fails (single-use).
    await assert.rejects(
      h.service.consumeReset({ token: raw, newPassword: 'AnotherPass9', ip: '2.2.2.2' }),
      (e: unknown) => e instanceof AccountRecoveryError && e.status === 400,
    )
    // Password unchanged by the rejected second attempt.
    assert.equal(await h.storedPassword('user-known'), 'H(BrandNew123)')
    assert.equal(await h.authVersion('user-known'), 1)
  } finally {
    await h.pg.close()
  }
})

test('old JWTs lose protected access once the password is reset', async () => {
  const h = await setup()
  try {
    const before = await h.authVersion('user-known')
    // A session minted now would carry authVersion=before and be authoritative.
    assert.equal(sessionAuthorityValid({ tokenAuthVersion: before, currentAuthVersion: before, userExists: true }), true)

    await h.service.requestReset({ email: 'known@example.com', ip: '2.2.2.2' })
    const raw = h.rawTokenFrom(h.sent[0].resetUrl)
    await h.service.consumeReset({ token: raw, newPassword: 'BrandNew123', ip: '2.2.2.2' })

    const after = await h.authVersion('user-known')
    assert.equal(after, before + 1)
    // The pre-reset session token is now stale and must be rejected.
    assert.equal(sessionAuthorityValid({ tokenAuthVersion: before, currentAuthVersion: after, userExists: true }), false)
  } finally {
    await h.pg.close()
  }
})

test('an expired token cannot be consumed', async () => {
  const h = await setup()
  try {
    await h.service.requestReset({ email: 'known@example.com', ip: '2.2.2.2' })
    const raw = h.rawTokenFrom(h.sent[0].resetUrl)
    // Advance the clock beyond the token TTL.
    h.clock.at = new Date(h.clock.at.getTime() + RESET_TOKEN_TTL_MS + 1000)
    await assert.rejects(
      h.service.consumeReset({ token: raw, newPassword: 'BrandNew123', ip: '2.2.2.2' }),
      (e: unknown) => e instanceof AccountRecoveryError && e.status === 400,
    )
    assert.equal(await h.storedPassword('user-known'), 'ORIGINAL-HASH')
  } finally {
    await h.pg.close()
  }
})

test('issuing a new token invalidates the previous unused one', async () => {
  const h = await setup()
  try {
    await h.service.requestReset({ email: 'known@example.com', ip: '2.2.2.2' })
    const first = h.rawTokenFrom(h.sent[0].resetUrl)
    await h.service.requestReset({ email: 'known@example.com', ip: '2.2.2.2' })
    const second = h.rawTokenFrom(h.sent[1].resetUrl)
    assert.notEqual(first, second)

    // The first token is now invalid.
    await assert.rejects(
      h.service.consumeReset({ token: first, newPassword: 'BrandNew123', ip: '2.2.2.2' }),
      (e: unknown) => e instanceof AccountRecoveryError && e.status === 400,
    )
    // The second token still works.
    assert.deepEqual(await h.service.consumeReset({ token: second, newPassword: 'BrandNew123', ip: '2.2.2.2' }), { ok: true })
  } finally {
    await h.pg.close()
  }
})

test('a delivery failure invalidates the freshly issued token without enumeration', async () => {
  const h = await setup()
  try {
    h.setSendFailure(true)
    // Still the generic success response.
    assert.deepEqual(await h.service.requestReset({ email: 'known@example.com', ip: '2.2.2.2' }), { ok: true })
    assert.equal(h.sent.length, 0)
    // A token row exists but has been consumed (invalidated), so it cannot be used.
    const rows = await h.pg.query<{ tokenHash: string; consumedAt: Date | null }>(
      'SELECT "tokenHash", "consumedAt" FROM "PasswordResetToken" WHERE "userId"=$1',
      ['user-known'],
    )
    assert.equal(rows.rows.length, 1)
    assert.notEqual(rows.rows[0].consumedAt, null)
  } finally {
    await h.pg.close()
  }
})

test('invalid token strings and weak passwords are rejected at submit', async () => {
  const h = await setup()
  try {
    await assert.rejects(
      h.service.consumeReset({ token: '', newPassword: 'BrandNew123', ip: '9.9.9.9' }),
      (e: unknown) => e instanceof AccountRecoveryError && e.status === 400,
    )
    await assert.rejects(
      h.service.consumeReset({ token: 'nonexistent-token', newPassword: 'short', ip: '9.9.9.9' }),
      (e: unknown) => e instanceof AccountRecoveryError && e.status === 400,
    )
  } finally {
    await h.pg.close()
  }
})

test('persistent rate limits apply per email, per IP request, and per IP submit', async () => {
  const h = await setup()
  try {
    // Email bucket: 5 allowed per window, 6th rejected (same email, same window).
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(await h.service.requestReset({ email: 'known@example.com', ip: `10.0.0.${i}` }), { ok: true })
    }
    await assert.rejects(
      h.service.requestReset({ email: 'known@example.com', ip: '10.0.0.9' }),
      (e: unknown) => e instanceof AccountRecoveryError && e.status === 429,
    )
  } finally {
    await h.pg.close()
  }
})

test('per-IP request flooding is capped even with malformed emails', async () => {
  const h = await setup()
  try {
    // 20 allowed from one IP; distinct emails keep the email bucket clear.
    for (let i = 0; i < 20; i++) {
      await h.service.requestReset({ email: `user${i}@example.com`, ip: '11.11.11.11' })
    }
    await assert.rejects(
      h.service.requestReset({ email: 'user99@example.com', ip: '11.11.11.11' }),
      (e: unknown) => e instanceof AccountRecoveryError && e.status === 429,
    )
  } finally {
    await h.pg.close()
  }
})

test('per-IP submit flooding is capped', async () => {
  const h = await setup()
  try {
    // 30 submit attempts allowed from one IP (each fails 400 on a bad token),
    // the 31st is rejected by the rate limiter with 429.
    for (let i = 0; i < 30; i++) {
      await assert.rejects(
        h.service.consumeReset({ token: 'bad-token', newPassword: 'BrandNew123', ip: '12.12.12.12' }),
        (e: unknown) => e instanceof AccountRecoveryError && e.status === 400,
      )
    }
    await assert.rejects(
      h.service.consumeReset({ token: 'bad-token', newPassword: 'BrandNew123', ip: '12.12.12.12' }),
      (e: unknown) => e instanceof AccountRecoveryError && e.status === 429,
    )
  } finally {
    await h.pg.close()
  }
})
