// ==========================================================================
// Developer Platform V1 — API credential generation and verification.
//
// Token shape:  bv_{mode}_{lookupId}_{secret}
//   - mode      : "test" | "live" (recognisable prefix, strict isolation)
//   - lookupId  : public, non-secret handle used for O(1) row lookup
//   - secret    : high-entropy component; ONLY its SHA-256 hash is stored
//
// The plaintext token is returned exactly once at creation. It is never logged,
// never stored and never reconstructable from the database.
// ==========================================================================

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export type KeyMode = 'test' | 'live'

export interface ParsedToken {
  mode: KeyMode
  lookupId: string
  secret: string
}

export interface GeneratedKey {
  id: string // ak_*
  lookupId: string
  mode: KeyMode
  secretHash: string
  token: string // shown once, never persisted
}

const HEX = /^[0-9a-f]+$/

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function isKeyMode(value: unknown): value is KeyMode {
  return value === 'test' || value === 'live'
}

// Generate a fresh credential. `id` is injectable for deterministic tests.
export function generateApiKey(mode: KeyMode, id = 'ak_' + randomBytes(12).toString('hex')): GeneratedKey {
  const lookupId = randomBytes(12).toString('hex') // 24 hex chars
  const secret = randomBytes(24).toString('hex') // 48 hex chars
  const token = `bv_${mode}_${lookupId}_${secret}`
  return { id, lookupId, mode, secretHash: sha256(secret), token }
}

// Strictly parse an inbound token. Returns null for anything malformed so the
// caller can respond with a single, uniform authentication error.
export function parseToken(raw: string | null | undefined): ParsedToken | null {
  if (typeof raw !== 'string') return null
  const parts = raw.trim().split('_')
  if (parts.length !== 4) return null
  const [prefix, mode, lookupId, secret] = parts
  if (prefix !== 'bv' || !isKeyMode(mode)) return null
  if (!lookupId || !secret || !HEX.test(lookupId) || !HEX.test(secret)) return null
  return { mode, lookupId, secret }
}

// Constant-time comparison of a presented secret against the stored hash.
export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(sha256(secret), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

// Redact any token-shaped substring from arbitrary text destined for a log.
const TOKEN_RE = /bv_(?:test|live)_[0-9a-f]+_[0-9a-f]+/g
export function redactSecrets(text: string): string {
  return text.replace(TOKEN_RE, 'bv_[REDACTED]')
}
