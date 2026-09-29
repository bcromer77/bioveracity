/**
 * Fodder — NON-PRODUCTION architectural fixture (Place Experience PR G).
 *
 * Fodder in the Woods, Co. Down, Northern Ireland. A venue-shaped Place.
 *
 * PURPOSE: architectural replication gate only.
 *   — NOT in production-registry.ts (no projector registered).
 *   — NOT seeded in any production database, and NOT exposed to production
 *     routing, sitemap, indexing or search.
 *   — No ecological, biodiversity, species, designation, chronology or
 *     geographic claims are manufactured here.
 *   — Presentation text is presentation metadata, not ecological evidence.
 *   — Sparse state is truthful: evidence has not yet been gathered for this venue.
 *
 * A sparse but honest Fodder is a successful architectural test.
 * A fabricated rich Fodder would be a failure.
 */

export const FODDER_PLACE_ID = 'bv_place_gb_ni_down_fodder'

/** Fixture-only slug. NOT seeded in the production DB. */
export const FODDER_PLACE_SLUG = 'fodder-woods'

export const FODDER_EVIDENCE_STATE = Object.freeze({
  status: 'sparse',
  reason: 'No evidence records have been submitted for this venue. This is the honest state of the archive.',
} as const)

/**
 * Minimum `Asset` row for PGlite tests, using the real required columns of
 * the Prisma `Asset` model (id, slug, name, type, region, regionSlug, status).
 * No coordinates, summary or evidence fields — nothing is fabricated.
 */
export function fodderAssetSeed() {
  return Object.freeze({
    id: FODDER_PLACE_ID,
    slug: FODDER_PLACE_SLUG,
    name: 'Fodder in the Woods',
    type: 'living_place',
    region: 'fixture',
    regionSlug: 'fixture',
    status: 'active',
  })
}
