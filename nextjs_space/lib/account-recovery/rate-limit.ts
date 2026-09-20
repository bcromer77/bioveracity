import { createHash, randomUUID } from 'node:crypto'
import type { Sql } from '../workspaces/service'

// Persistent, database-backed rate limiting using fixed windows. Counters live
// in the AuthRateLimit table so limits survive restarts and apply across every
// server instance. Identifiers (IP addresses, email addresses) are hashed before
// storage so no raw PII or client IP is persisted.

export type RateLimitRule = { limit: number; windowMs: number }

export const RATE_LIMITS = {
  // Reset requests from one IP address.
  resetRequestIp: { limit: 20, windowMs: 60 * 60 * 1000 },
  // Reset requests targeting one email address.
  resetRequestEmail: { limit: 5, windowMs: 60 * 60 * 1000 },
  // Reset-token submissions from one IP address.
  resetSubmitIp: { limit: 30, windowMs: 60 * 60 * 1000 },
} as const

export type RateLimitBucket = keyof typeof RATE_LIMITS

function hashIdentifier(identifier: string): string {
  return createHash('sha256').update(identifier).digest('hex')
}

export async function consumeRateLimit(
  db: Sql,
  bucket: RateLimitBucket,
  identifier: string,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<{ allowed: boolean; count: number }> {
  const identifierHash = hashIdentifier(identifier || 'unknown')
  const windowStart = new Date(Math.floor(now.getTime() / rule.windowMs) * rule.windowMs)
  const rows = await db.query<{ count: number }>(
    `INSERT INTO "AuthRateLimit" ("id","bucket","identifierHash","windowStart","count","updatedAt")
     VALUES ($1,$2,$3,$4,1,$5)
     ON CONFLICT ("bucket","identifierHash","windowStart")
     DO UPDATE SET "count" = "AuthRateLimit"."count" + 1, "updatedAt" = $5
     RETURNING "count"`,
    [randomUUID(), bucket, identifierHash, windowStart, now],
  )
  const count = Number(rows[0]?.count ?? 0)
  return { allowed: count <= rule.limit, count }
}
