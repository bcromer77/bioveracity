// Universal Place identity. Source-neutral and Place-neutral: no individual Place,
// county, designation or source may be named in this module (enforced by
// tests/place-generic-literals.test.ts).
//
// A Place ID is the immutable identity of a Place. It is stored on Asset.id.
// Slugs and QR access IDs are locators that resolve TO a Place ID; they are never
// identity and a Place ID is never derived from them. See
// docs/adr/ADR-0001-place-experience-identity.md.

export const PLACE_ID_PREFIX = 'bv_place_'

/** Canonical bound on the suffix after PLACE_ID_PREFIX. */
export const PLACE_ID_MAX_SUFFIX_LENGTH = 120

/** Canonical Place ID: prefix + 1..120 of [a-z0-9_]. */
export const PLACE_ID_RE = /^bv_place_[a-z0-9_]{1,120}$/

/**
 * Place ID shape without the canonical suffix bound. Retained only so the
 * existing QR draft contract keeps its exact behaviour (its caller bounds the
 * whole value at 160 characters). Converging it on PLACE_ID_RE is a deliberate
 * behaviour change deferred to a later, separately reviewed slice (ADR-0001 §9).
 */
export const PLACE_ID_SHAPE_RE = /^bv_place_[a-z0-9_]+$/

export type PlaceId = string & { readonly __placeId: unique symbol }

export function isPlaceId(value: string): value is PlaceId {
  return PLACE_ID_RE.test(value)
}

export function hasPlaceIdShape(value: string): boolean {
  return PLACE_ID_SHAPE_RE.test(value)
}

export function assertPlaceId(value: string, message = 'Invalid place id'): PlaceId {
  if (!isPlaceId(value)) throw new Error(message)
  return value
}

/**
 * Application-level Asset.id immutability guard for Place Assets.
 *
 * Returns normally only if a proposed Asset write payload cannot change the
 * identity of an existing Place. Any `id` key in an update payload is refused
 * when the target is a Place (or when the payload would turn an Asset into a
 * Place ID). Database-level enforcement (trigger) is deferred to the approved
 * migration gate (ADR-0001 §8).
 */
export function assertPlaceIdentityUnchanged(currentId: string, update: Record<string, unknown>): void {
  if (!Object.prototype.hasOwnProperty.call(update, 'id')) return
  const next = update.id
  if (hasPlaceIdShape(currentId)) {
    throw new Error('place_identity_immutable')
  }
  if (typeof next === 'string' && hasPlaceIdShape(next)) {
    throw new Error('place_identity_immutable')
  }
}
