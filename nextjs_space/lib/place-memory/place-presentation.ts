// Per-Place presentation configuration (Place Experience PR D). This is DATA,
// kept outside the generic lib/place and components/place directories: the
// universal shell only ever receives a PlacePresentation value. The display
// title is a human-facing name; it never replaces or rewrites the immutable
// Place ID, and the Asset name remains available as data-backed context.

import type { PlacePresentation } from '@/lib/place/shell-view'
import { KERRY_PLACE_ID } from './kerry-001'
import { FODDER_PLACE_ID } from './fodder-fixture'
import { placeManifestFor } from '@/data/places'

const PLACE_PRESENTATION: Readonly<Record<string, PlacePresentation>> = Object.freeze({
  // relationRecord is shown only if a public statutory record names it (shell-view.ts).
  [KERRY_PLACE_ID]: Object.freeze({ displayTitle: 'Tralee Wetlands', relationRecord: 'Tralee Bay Complex' }),
  // Non-production fixture (PR G); a Place with no public record still has no page.
  [FODDER_PLACE_ID]: Object.freeze({ displayTitle: 'Fodder', relationRecord: 'Fodder in the Woods' }),
})

export function placePresentation(placeId: string): PlacePresentation | null {
  if (Object.prototype.hasOwnProperty.call(PLACE_PRESENTATION, placeId)) return PLACE_PRESENTATION[placeId]
  // Manifest-backed Places carry their presentation as reviewed data (PILOT-001).
  const manifest = placeManifestFor(placeId)
  if (!manifest) return null
  const { display_title, relation_record } = manifest.place.presentation
  return Object.freeze({
    ...(display_title ? { displayTitle: display_title } : {}),
    ...(relation_record ? { relationRecord: relation_record } : {}),
  })
}
