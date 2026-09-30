// Place Access Points (Place Experience PR E, ADR-0001 §2, gate G-ACCESS).
//
// A public access ID is an opaque, physical-entry LOCATOR (for example, printed
// in a QR code). It encodes nothing: not database identity, tenant, permission
// or geography. Resolution always runs
//   publicAccessId -> Place ID (immutable Asset.id) -> current canonical slug
// and the Place must also pass the PR C public read model before a redirect is
// issued. Every failure collapses to one frozen `not_found`, so the public route
// cannot act as an existence oracle. Place-neutral: no individual Place, county
// or designation may be named here (tests/place-generic-literals.test.ts).

import { randomBytes } from 'node:crypto'
import type { Database, Sql } from '@/lib/workspaces/service'
import { isPlaceId, type PlaceId } from './identity'
import { isPlaceSlug, placeRoutePath } from './slugs'
import { listPublicPlaceMemory, readPublicPlace } from './public-read'

export const PUBLIC_ACCESS_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
/** 22 base62 characters = 22 × log2(62) ≈ 131 bits of entropy (>= 128). */
export const PUBLIC_ACCESS_ID_LENGTH = 22
export const PUBLIC_ACCESS_ID_RE = /^[0-9A-Za-z]{22}$/
export const PUBLIC_ACCESS_ROUTE_PREFIX = '/p/'

export type PublicAccessId = string & { readonly __publicAccessId: unique symbol }

// Largest multiple of 62 that fits in a byte; bytes at or above it are
// rejected so every character is uniformly distributed (no modulo bias).
const UNBIASED_LIMIT = 248

/** Cryptographically secure, uniformly distributed base62 identifier. */
export function generatePublicAccessId(random: (size: number) => Buffer = randomBytes): PublicAccessId {
  let out = ''
  while (out.length < PUBLIC_ACCESS_ID_LENGTH) {
    for (const byte of random(32)) {
      if (byte >= UNBIASED_LIMIT) continue
      out += PUBLIC_ACCESS_ID_ALPHABET[byte % 62]
      if (out.length === PUBLIC_ACCESS_ID_LENGTH) break
    }
  }
  return out as PublicAccessId
}

/** Pure shape check, run before any database lookup. */
export function isPublicAccessId(value: unknown): value is PublicAccessId {
  return typeof value === 'string' && value.length === PUBLIC_ACCESS_ID_LENGTH && PUBLIC_ACCESS_ID_RE.test(value)
}

export function publicAccessPath(id: string): string {
  if (!isPublicAccessId(id)) throw new PlaceAccessError('malformed_access_id')
  return PUBLIC_ACCESS_ROUTE_PREFIX + id
}

// ------------------------------------------------------------------ resolution

export type PublicAccessResolution =
  | { outcome: 'redirect'; status: 307; location: string }
  | { outcome: 'not_found' }

export const ACCESS_NOT_FOUND: PublicAccessResolution = Object.freeze({ outcome: 'not_found' }) as PublicAccessResolution

type AccessRow = { placeId: string; current: string | null }

/**
 * Active access point -> Place ID -> current canonical slug -> public read model.
 * Malformed, unknown, revoked, non-Place, slug-less, private, unpublished and
 * errored lookups all return the same frozen ACCESS_NOT_FOUND.
 */
export async function resolvePublicAccessPoint(db: Sql, raw: unknown): Promise<PublicAccessResolution> {
  if (!isPublicAccessId(raw)) return ACCESS_NOT_FOUND
  try {
    const rows = await db.query<AccessRow>(
      `SELECT ap."placeId", c."slug" AS current
         FROM "PlaceAccessPoint" ap
         JOIN "Asset" a ON a.id = ap."placeId"
         LEFT JOIN "PlaceSlug" c ON c."placeId" = ap."placeId" AND c."retiredAt" IS NULL
        WHERE ap."publicAccessId" = $1 AND ap."revokedAt" IS NULL`,
      [raw],
    )
    const row = rows.length === 1 ? rows[0] : undefined
    if (!row || !isPlaceId(row.placeId) || !row.current || !isPlaceSlug(row.current)) return ACCESS_NOT_FOUND
    // Same public admission the /place shell applies, so a redirect never lands on a 404.
    if (!(await readPublicPlace(db, row.placeId))) return ACCESS_NOT_FOUND
    if (!(await listPublicPlaceMemory(db, row.placeId, 1)).length) return ACCESS_NOT_FOUND
    return { outcome: 'redirect', status: 307, location: placeRoutePath(row.current) }
  } catch {
    return ACCESS_NOT_FOUND
  }
}

/** Headers on every /p response: never cached, never indexed, never sniffed. */
export const PUBLIC_ACCESS_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
})
export const PUBLIC_ACCESS_NOT_FOUND_BODY = 'Not found\n'

export type PublicAccessResponse = { status: 307 | 404; headers: Record<string, string>; body: string | null }

/**
 * The complete /p HTTP response. A redirect is a bodiless 307 (no HTML, no
 * script); every not_found is byte-identical and never echoes the request.
 */
export function publicAccessResponse(resolution: PublicAccessResolution): PublicAccessResponse {
  if (resolution.outcome === 'redirect' && resolution.location.startsWith('/place/')) {
    return { status: 307, headers: { ...PUBLIC_ACCESS_HEADERS, Location: resolution.location }, body: null }
  }
  return {
    status: 404,
    headers: { ...PUBLIC_ACCESS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    body: PUBLIC_ACCESS_NOT_FOUND_BODY,
  }
}

// ------------------------------------------------------------- operator writes

export type PlaceAccessErrorCode =
  | 'malformed_place_id'
  | 'malformed_access_id'
  | 'place_not_found'
  | 'access_point_not_found'
  | 'issue_retry_exhausted'

export class PlaceAccessError extends Error {
  constructor(public readonly code: PlaceAccessErrorCode) {
    super(code)
    this.name = 'PlaceAccessError'
  }
}

export type IssuedAccessPoint = { publicAccessId: PublicAccessId; placeId: PlaceId; createdAt: string }
export type RevokedAccessPoint = { publicAccessId: PublicAccessId; revokedAt: string; alreadyRevoked: boolean }

type ClockOptions = { now?: () => Date }
const iso = (v: Date | string) => new Date(v instanceof Date ? v : `${v}${/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? '' : 'Z'}`).toISOString()
const isUniqueViolation = (error: unknown) => {
  const e = error as { code?: unknown; meta?: { code?: unknown } } | null
  return e?.code === '23505' || e?.meta?.code === '23505' || /\b23505\b/.test(error instanceof Error ? error.message : '')
}

/** Issue a new active access point for an existing Place (operator only). */
export async function issueAccessPoint(
  db: Database, placeIdInput: unknown,
  options: ClockOptions & { generate?: () => PublicAccessId; maxAttempts?: number } = {},
): Promise<IssuedAccessPoint> {
  if (typeof placeIdInput !== 'string' || !isPlaceId(placeIdInput)) throw new PlaceAccessError('malformed_place_id')
  const placeId = placeIdInput
  const generate = options.generate ?? (() => generatePublicAccessId())
  const attempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 5))
  for (let attempt = 1; ; attempt++) {
    const publicAccessId = generate()
    if (!isPublicAccessId(publicAccessId)) throw new PlaceAccessError('malformed_access_id')
    try {
      return await db.transaction(async (tx) => {
        const place = await tx.query<{ id: string }>('SELECT id FROM "Asset" WHERE id = $1 FOR SHARE', [placeId])
        if (place.length !== 1) throw new PlaceAccessError('place_not_found')
        const now = (options.now ?? (() => new Date()))().toISOString()
        const rows = await tx.query<{ createdAt: Date | string }>(
          `INSERT INTO "PlaceAccessPoint" ("publicAccessId", "placeId", "createdAt")
           VALUES ($1, $2, ($3::timestamptz AT TIME ZONE 'UTC')) RETURNING "createdAt"`,
          [publicAccessId, placeId, now],
        )
        return { publicAccessId, placeId, createdAt: iso(rows[0].createdAt) }
      })
    } catch (error) {
      if (error instanceof PlaceAccessError) throw error
      if (isUniqueViolation(error) && attempt < attempts) continue
      if (isUniqueViolation(error)) throw new PlaceAccessError('issue_retry_exhausted')
      throw error
    }
  }
}

/** Revoke an access point. Final and idempotent: a revoked ID never reactivates. */
export async function revokeAccessPoint(db: Database, raw: unknown, options: ClockOptions = {}): Promise<RevokedAccessPoint> {
  if (!isPublicAccessId(raw)) throw new PlaceAccessError('malformed_access_id')
  const publicAccessId = raw
  return db.transaction(async (tx) => {
    const now = (options.now ?? (() => new Date()))().toISOString()
    const updated = await tx.query<{ revokedAt: Date | string }>(
      `UPDATE "PlaceAccessPoint" SET "revokedAt" = GREATEST("createdAt", ($2::timestamptz AT TIME ZONE 'UTC'))
        WHERE "publicAccessId" = $1 AND "revokedAt" IS NULL RETURNING "revokedAt"`,
      [publicAccessId, now],
    )
    if (updated.length === 1) return { publicAccessId, revokedAt: iso(updated[0].revokedAt), alreadyRevoked: false }
    const existing = await tx.query<{ revokedAt: Date | string | null }>(
      'SELECT "revokedAt" FROM "PlaceAccessPoint" WHERE "publicAccessId" = $1', [publicAccessId],
    )
    if (existing.length !== 1 || existing[0].revokedAt == null) throw new PlaceAccessError('access_point_not_found')
    return { publicAccessId, revokedAt: iso(existing[0].revokedAt), alreadyRevoked: true }
  })
}

/** Active access point lookup for operator QR rendering (no public use). */
export async function isActiveAccessPoint(db: Sql, raw: unknown): Promise<boolean> {
  if (!isPublicAccessId(raw)) return false
  const rows = await db.query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM "PlaceAccessPoint" WHERE "publicAccessId" = $1 AND "revokedAt" IS NULL', [raw],
  )
  return Number(rows[0]?.n ?? 0) === 1
}

// ------------------------------------------------------------------ QR payload

/**
 * The configured public origin for printed access points. Only an exact
 * `https://host[:port]` origin is admitted; the request Host header is never
 * consulted, so a spoofed Host cannot redirect a printed code.
 */
export function publicPlaceOrigin(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.PLACE_PUBLIC_ORIGIN
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    if (value !== url.origin && value !== `${url.origin}/`) return null
    return url.origin
  } catch {
    return null
  }
}

/** QR payload: `${origin}/p/${publicAccessId}` and nothing else. */
export function accessPointQrPayload(origin: string, id: string): string {
  return origin + publicAccessPath(id)
}

export const PLACE_ACCESS_QR_OPTIONS = Object.freeze({
  type: 'svg' as const,
  errorCorrectionLevel: 'M' as const,
  margin: 4,
  width: 512,
  color: Object.freeze({ dark: '#173d35', light: '#ffffff' }),
})
