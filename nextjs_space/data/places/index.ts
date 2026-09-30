// Registry of reviewed Place manifests. Adding a Place = add a JSON manifest in
// this directory and list it here (static import, so the standalone build
// bundles it). No Place-specific code is required anywhere else.

import { validatePlaceManifest, type ValidatedPlaceManifest } from '@/lib/place-memory/place-manifest'
import strangfordLough from './strangford-lough.manifest.json'

const manifests: readonly ValidatedPlaceManifest[] = Object.freeze([
  validatePlaceManifest(strangfordLough),
])

if (new Set(manifests.map((m) => m.place.id)).size !== manifests.length) {
  throw new Error('place_manifest_invalid:duplicate_place_id')
}
if (new Set(manifests.map((m) => m.place.slug)).size !== manifests.length) {
  throw new Error('place_manifest_invalid:duplicate_slug')
}

export const PLACE_MANIFESTS = manifests

export function placeManifestFor(placeId: string): ValidatedPlaceManifest | null {
  return manifests.find((m) => m.place.id === placeId) ?? null
}
