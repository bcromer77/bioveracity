// Place-neutral instantiation of a reviewed Place manifest (PILOT-001).
// Submits every manifest item through the real V1 evidence service (so the
// normal projector registry validates and projects it), assigns the canonical
// slug and, only when asked, enables Place-level listening participation.
// Used by scripts/place-instantiate.ts (local/test databases) and by tests.

import type { Database } from '@/lib/workspaces/service'
import { parseEvidenceCreate } from '@/lib/v1/contract'
import { parseToken } from '@/lib/v1/keys'
import { platformService } from '@/lib/v1/service'
import { v1ServiceOptions } from '@/lib/v1/processor'
import { assignCanonicalPlaceSlug } from '@/lib/place/slugs'
import { manifestEvidenceBody, type ValidatedPlaceManifest } from './place-manifest'

export type InstantiateOptions = {
  mode?: 'live' | 'test'
  enableListening?: boolean
  service?: Partial<NonNullable<Parameters<typeof platformService>[1]>>
}

export async function instantiateManifestPlace(db: Database, manifest: ValidatedPlaceManifest, options: InstantiateOptions = {}) {
  const mode = options.mode ?? 'live'
  const service = platformService(db, { ...v1ServiceOptions(db), ...options.service })
  // Re-running the same reviewed manifest is a no-op: items already stored for
  // this Place, manifest hash and mode are reported, never resubmitted.
  const existing = await db.query<{ item_key: string; status: string }>(
    `SELECT "metadata"->'place_memory'->>'item_key' AS item_key, "processingStatus" AS status
       FROM "PlatformEvidence"
      WHERE "mode"::text=$1 AND "metadata"->'place_memory'->>'place_id'=$2
        AND "metadata"->'place_memory'->>'manifest_sha256'=$3`,
    [mode, manifest.place.id, manifest.sha256],
  )
  const stored = new Map(existing.map((r) => [r.item_key, r.status]))
  const results: Array<{ itemKey: string; status: string }> = []
  const pending = manifest.items.filter((item) => {
    const status = stored.get(item.item_key)
    if (status) results.push({ itemKey: item.item_key, status: `ALREADY_${status}` })
    return !status
  })
  const apiKey = pending.length ? await (async () => {
    const key = await service.createKey({ name: `manifest:${manifest.place.slug}:${mode}`, mode })
    const found = await service.findKeyByLookup(parseToken(key.token)!.lookupId)
    if (!found) throw new Error('place_instantiate:key_lookup_failed')
    return found
  })() : null
  for (const item of pending) {
    if (!apiKey) break
    const body = manifestEvidenceBody(manifest, item)
    const created = await service.createEvidence({
      apiKey, body: parseEvidenceCreate(body), rawBody: body,
      idempotencyKey: `manifest:${manifest.sha256.slice(0, 16)}:${item.item_key}`.slice(0, 200),
      requestId: `req_manifest_${results.length}`,
    })
    results.push({ itemKey: item.item_key, status: created.evidence.processing_status })
  }
  if (mode !== 'live') return { placeId: manifest.place.id, results, slug: null, listeningEnabled: false }
  await assignCanonicalPlaceSlug(db, manifest.place.id, manifest.place.slug)
  if (options.enableListening) {
    await db.query(
      `INSERT INTO "PlaceParticipation" ("placeId","listeningEnabledAt") VALUES ($1,CURRENT_TIMESTAMP)
       ON CONFLICT ("placeId") DO UPDATE SET "listeningEnabledAt"=COALESCE("PlaceParticipation"."listeningEnabledAt",CURRENT_TIMESTAMP),"updatedAt"=CURRENT_TIMESTAMP`,
      [manifest.place.id],
    )
  }
  return { placeId: manifest.place.id, results, slug: manifest.place.slug, listeningEnabled: !!options.enableListening }
}
