// Per-Place presentation configuration (Place Experience PR D). This is DATA,
// kept outside the generic lib/place and components/place directories: the
// universal shell only ever receives a PlacePresentation value. The display
// title is a human-facing name; it never replaces or rewrites the immutable
// Place ID, and the Asset name remains available as data-backed context.

import type { PlacePresentation } from '@/lib/place/shell-view'
import { KERRY_PLACE_ID } from './kerry-001'

const PLACE_PRESENTATION: Readonly<Record<string, PlacePresentation>> = Object.freeze({
  // relationRecord is shown only if a public statutory record names it (shell-view.ts).
  [KERRY_PLACE_ID]: Object.freeze({ displayTitle: 'Tralee Wetlands', relationRecord: 'Tralee Bay Complex' }),
})

export function placePresentation(placeId: string): PlacePresentation | null {
  return Object.prototype.hasOwnProperty.call(PLACE_PRESENTATION, placeId) ? PLACE_PRESENTATION[placeId] : null
}
