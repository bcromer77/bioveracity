// Server-side loader for the universal Place shell (Place Experience PR D).
// slug -> PR B canonical resolution -> Place ID -> PR C public read contract.
// No other data path exists: this module imports nothing that can read a Place
// Memory table directly. Every failure (flag off, malformed, unknown, retired
// without a current slug, non-public Place) collapses to the same not_found.

import type { Sql } from '@/lib/workspaces/service'
import { resolvePlaceSlug } from './slugs'
import { listPublicPlaceMemory, readPublicPlace } from './public-read'
import { buildPlaceShellView, type PlacePresentation, type PlaceShellView } from './shell-view'

export const PLACE_SHELL_ITEM_LIMIT = 50

/** Server-only flag. Anything other than the exact string 'true' is off. */
export function isPlaceExperienceEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PLACE_EXPERIENCE_ENABLED === 'true'
}

export type PlaceShellLoad =
  | { outcome: 'not_found' }
  | { outcome: 'redirect'; status: 308; location: string }
  | { outcome: 'ok'; view: PlaceShellView }

const NOT_FOUND: PlaceShellLoad = Object.freeze({ outcome: 'not_found' }) as PlaceShellLoad

export async function loadPlaceShell(
  db: Sql,
  rawSlug: unknown,
  presentationFor: (placeId: string) => PlacePresentation | null = () => null,
): Promise<PlaceShellLoad> {
  const resolved = await resolvePlaceSlug(db, rawSlug)
  if (resolved.outcome === 'not_found') return NOT_FOUND
  if (resolved.outcome === 'redirect') return { outcome: 'redirect', status: 308, location: resolved.location }
  const place = await readPublicPlace(db, resolved.placeId)
  if (!place) return NOT_FOUND
  const items = await listPublicPlaceMemory(db, resolved.placeId, PLACE_SHELL_ITEM_LIMIT)
  if (!items.length) return NOT_FOUND
  return { outcome: 'ok', view: buildPlaceShellView(place, items, presentationFor(resolved.placeId) ?? {}) }
}
