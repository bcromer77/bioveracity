// Canonical Place slug history and resolution (Place Experience PR B, ADR-0001 §2).
//
// A slug is a public LOCATOR only. Resolution always runs slug → Place ID →
// content; the Place ID (immutable Asset.id) is never computed from, replaced
// by or written through a slug. Display names are stored on the Asset and are
// never derived from slugs. No route consumes this module yet: the Place shell
// slice maps `redirect` to a permanent 308 and every `not_found` to a uniform 404.

import type { Database, Sql } from '@/lib/workspaces/service'
import { isPlaceId, type PlaceId } from './identity'

export const PLACE_SLUG_MAX_LENGTH = 80
export const PLACE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const PLACE_ROUTE_PREFIX = '/place/'

export type PlaceSlug = string & { readonly __placeSlug: unique symbol }

export type PlaceSlugErrorCode =
  | 'malformed_slug'
  | 'malformed_place_id'
  | 'place_not_found'
  | 'slug_collision'
  | 'slug_conflict_retry_exhausted'

export class PlaceSlugError extends Error {
  constructor(public readonly code: PlaceSlugErrorCode) {
    super(code)
    this.name = 'PlaceSlugError'
  }
}

export function isPlaceSlug(value: unknown): value is PlaceSlug {
  return typeof value === 'string' && value.length >= 1 && value.length <= PLACE_SLUG_MAX_LENGTH && PLACE_SLUG_RE.test(value)
}

// Strict: no case folding, trimming or transliteration. Input that is not
// already canonical is malformed, so a slug can never alias another spelling.
export function assertPlaceSlug(value: unknown): PlaceSlug {
  if (!isPlaceSlug(value)) throw new PlaceSlugError('malformed_slug')
  return value
}

export function placeRoutePath(slug: string): string {
  return PLACE_ROUTE_PREFIX + assertPlaceSlug(slug)
}

export type PlaceSlugResolution =
  | { outcome: 'current'; placeId: PlaceId; slug: PlaceSlug }
  | { outcome: 'redirect'; status: 308; placeId: PlaceId; slug: PlaceSlug; location: string }
  | { outcome: 'not_found'; reason: 'malformed_slug' | 'unknown_slug' | 'no_current_slug' | 'not_a_place' }

type ResolveRow = { placeId: string; retiredAt: Date | string | null; current: string | null }

export async function resolvePlaceSlug(sql: Sql, raw: unknown): Promise<PlaceSlugResolution> {
  if (!isPlaceSlug(raw)) return { outcome: 'not_found', reason: 'malformed_slug' }
  const rows = await sql.query<ResolveRow>(
    `SELECT s."placeId", s."retiredAt", c."slug" AS current
       FROM "PlaceSlug" s
       JOIN "Asset" a ON a.id = s."placeId"
       LEFT JOIN "PlaceSlug" c ON c."placeId" = s."placeId" AND c."retiredAt" IS NULL
      WHERE s."slug" = $1`,
    [raw],
  )
  const row = rows[0]
  if (!row) return { outcome: 'not_found', reason: 'unknown_slug' }
  if (!isPlaceId(row.placeId)) return { outcome: 'not_found', reason: 'not_a_place' }
  if (!row.current || !isPlaceSlug(row.current)) return { outcome: 'not_found', reason: 'no_current_slug' }
  if (row.retiredAt == null) return { outcome: 'current', placeId: row.placeId, slug: raw }
  return { outcome: 'redirect', status: 308, placeId: row.placeId, slug: row.current, location: placeRoutePath(row.current) }
}

export type AssignPlaceSlugResult = {
  placeId: PlaceId
  slug: PlaceSlug
  changed: boolean
  retired: PlaceSlug[]
  reinstated: boolean
}

type SlugRow = { slug: string; placeId: string; retiredAt: Date | string | null }

async function assignOnce(tx: Sql, placeId: PlaceId, slug: PlaceSlug, now: Date): Promise<AssignPlaceSlugResult> {
  // Row lock on the Place serialises every slug change for that Place.
  const place = await tx.query<{ id: string }>('SELECT id FROM "Asset" WHERE id = $1 FOR UPDATE', [placeId])
  if (place.length !== 1 || place[0].id !== placeId) throw new PlaceSlugError('place_not_found')

  const existing = (await tx.query<SlugRow>(
    'SELECT "slug", "placeId", "retiredAt" FROM "PlaceSlug" WHERE "slug" = $1 FOR UPDATE', [slug],
  ))[0]
  if (existing && existing.placeId !== placeId) throw new PlaceSlugError('slug_collision')
  if (existing && existing.retiredAt == null) return { placeId, slug, changed: false, retired: [], reinstated: false }

  const retired = await tx.query<{ slug: string }>(
    `UPDATE "PlaceSlug" SET "retiredAt" = ($2::timestamptz AT TIME ZONE 'UTC')
      WHERE "placeId" = $1 AND "retiredAt" IS NULL RETURNING "slug"`,
    [placeId, now.toISOString()],
  )
  if (existing) {
    await tx.query('UPDATE "PlaceSlug" SET "retiredAt" = NULL WHERE "slug" = $1 AND "placeId" = $2 RETURNING "slug"', [slug, placeId])
  } else {
    await tx.query(
      `INSERT INTO "PlaceSlug" ("slug", "placeId", "createdAt") VALUES ($1, $2, ($3::timestamptz AT TIME ZONE 'UTC')) RETURNING "slug"`,
      [slug, placeId, now.toISOString()],
    )
  }
  return { placeId, slug, changed: true, retired: retired.map((r) => r.slug as PlaceSlug), reinstated: Boolean(existing) }
}

// Classify driver errors without trusting any one shape: PGlite/pg expose the
// SQLSTATE as `code`; Prisma wraps raw-query failures as P2010 with the SQLSTATE
// in `meta.code` and reports serialisation conflicts as P2034.
const classifyError = (error: unknown): 'collision' | 'retry' | undefined => {
  const e = error as { code?: unknown; meta?: { code?: unknown }; cause?: { code?: unknown } } | null
  const text = error instanceof Error ? error.message : ''
  const codes = new Set([e?.code, e?.meta?.code, e?.cause?.code].filter((c): c is string => typeof c === 'string'))
  for (const m of text.matchAll(/\b(23505|40001|40P01)\b/g)) codes.add(m[1])
  if (codes.has('23505')) return 'collision'
  if (codes.has('40001') || codes.has('40P01') || codes.has('P2034')) return 'retry'
  return undefined
}

export type AssignPlaceSlugOptions = { now?: () => Date; maxAttempts?: number }

// Make `slug` the single current slug of `placeId`, retiring the previous one
// (which then 308-redirects). Re-claiming one of the Place's own retired slugs
// reinstates it. A slug held (currently or historically) by any other Place is
// a collision. Everything runs in one transaction; unique violations from a
// concurrent claim surface as `slug_collision`, serialisation failures retry.
export async function assignCanonicalPlaceSlug(
  db: Database, placeIdInput: unknown, slugInput: unknown, options: AssignPlaceSlugOptions = {},
): Promise<AssignPlaceSlugResult> {
  if (typeof placeIdInput !== 'string' || !isPlaceId(placeIdInput)) throw new PlaceSlugError('malformed_place_id')
  const slug = assertPlaceSlug(slugInput)
  const placeId = placeIdInput
  const attempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 5))
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction((tx) => assignOnce(tx, placeId, slug, (options.now ?? (() => new Date()))()))
    } catch (error) {
      if (error instanceof PlaceSlugError) throw error
      const kind = classifyError(error)
      if (kind === 'collision') throw new PlaceSlugError('slug_collision')
      if (kind === 'retry') {
        if (attempt < attempts) continue
        throw new PlaceSlugError('slug_conflict_retry_exhausted')
      }
      throw error
    }
  }
}
