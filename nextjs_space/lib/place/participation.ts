// Place-level participation (PILOT-001, decision P-1). Place-neutral: no individual
// Place may be named here (tests/place-generic-literals.test.ts).
//
// Listening at a Place is enabled only by a PlaceParticipation row with a non-null
// listeningEnabledAt. The Place is always resolved server-side: slug -> canonical
// Place ID -> public read contract. A browser-supplied Place ID is never accepted.
// This module reads participation config only; it never reads or exposes listening
// data, and nothing on the public Place path reads listening tables.

import type { Sql } from '@/lib/workspaces/service'
import { isPlaceId, type PlaceId } from './identity'
import { placeRoutePath, resolvePlaceSlug } from './slugs'
import { readPublicPlace } from './public-read'

export type ListeningPlace = { placeId: PlaceId; slug: string; name: string }
export type ListeningPlaceResolution =
  | { outcome: 'ok'; place: ListeningPlace }
  | { outcome: 'redirect'; location: string; place: ListeningPlace }
  | { outcome: 'not_found' }

export const LISTEN_PATH_SUFFIX = '/listen'

export function placeListenPath(slug: string): string {
  return placeRoutePath(slug) + LISTEN_PATH_SUFFIX
}

/** Server-only flag shared with the standalone pilot. Anything other than 'true' is off. */
export function isListeningPilotEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.LISTENING_PILOT_ENABLED === 'true'
}

export async function isPlaceListeningEnabled(db: Sql, placeId: string): Promise<boolean> {
  if (typeof placeId !== 'string' || !isPlaceId(placeId)) return false
  const rows = await db.query<{ enabled: boolean }>(
    'SELECT ("listeningEnabledAt" IS NOT NULL) AS enabled FROM "PlaceParticipation" WHERE "placeId" = $1',
    [placeId],
  )
  return rows[0]?.enabled === true
}

/**
 * slug -> Place for listening. A retired slug redirects to the current listen path,
 * so a renamed Place never orphans a history (histories are keyed by Place ID).
 * Unknown, non-public and not-enabled Places collapse to the same not_found.
 */
export async function resolveListeningPlace(db: Sql, rawSlug: unknown): Promise<ListeningPlaceResolution> {
  const resolved = await resolvePlaceSlug(db, rawSlug)
  if (resolved.outcome === 'not_found') return { outcome: 'not_found' }
  const place = await readPublicPlace(db, resolved.placeId)
  if (!place || !(await isPlaceListeningEnabled(db, resolved.placeId))) return { outcome: 'not_found' }
  const current: ListeningPlace = { placeId: resolved.placeId, slug: resolved.slug, name: place.name }
  if (resolved.outcome === 'redirect') return { outcome: 'redirect', location: placeListenPath(resolved.slug), place: current }
  return { outcome: 'ok', place: current }
}
