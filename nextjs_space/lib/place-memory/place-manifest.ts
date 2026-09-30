// Controlled Place manifests (PILOT-001). A Place is added by committing a
// reviewed JSON manifest under data/places/ and listing it in
// data/places/index.ts — never by writing Place-specific code. This module is
// Place-neutral: it only validates the manifest shape and the evidence rules
// every manifest must obey (source-attributed, licensed, no invented time).

import { fingerprint } from '@/lib/v1/contract'
import { isPlaceId } from '@/lib/place/identity'
import { PLACE_SLUG_MAX_LENGTH, PLACE_SLUG_RE } from '@/lib/place/slugs'

export const PLACE_MANIFEST_TRAIN = 'PLACE-MANIFEST-V1'
export const PLACE_MANIFEST_VERSION = 'place-manifest-v1'

const ITEM_KINDS = ['DESIGNATION', 'CLAIM'] as const
const ENTITY_KINDS = ['TAXON', 'ECOLOGICAL_FEATURE'] as const
const UNCERTAINTY_FLAGS = [
  'designation_not_observation',
  'current_presence_not_established',
  'abundance_not_established',
  'condition_not_established',
  'observation_time_unknown',
  'publication_time_unknown',
] as const
const SHA256_RE = /^[a-f0-9]{64}$/
const TOKEN_RE = /^[a-z][a-z0-9_]{1,63}$/

export type PlaceManifestSource = {
  ref: string
  provider: string
  publisher: string
  url: string
  retrieved_at: string
  sha256: string
  licence: string
  licence_url: string
  attribution: string
}

export type PlaceManifestEntity = {
  kind: (typeof ENTITY_KINDS)[number]
  label: string
  authority: string
  external_id: string
  source_assertion: string
  source_terms: string[]
  curated_terms: string[]
}

export type PlaceManifestItem = {
  item_key: string
  kind: (typeof ITEM_KINDS)[number]
  evidence_type: string
  statement: string
  source_ref: string
  source_external_id: string
  source_locator: string
  search_terms: string[]
  uncertainty: Array<(typeof UNCERTAINTY_FLAGS)[number]>
  entities: PlaceManifestEntity[]
}

export type PlaceManifest = {
  manifest_version: typeof PLACE_MANIFEST_VERSION
  place: {
    id: string
    slug: string
    label: string
    region: string
    region_slug: string
    jurisdiction: string
    summary: string
    presentation: { display_title?: string; relation_record?: string }
  }
  sources: PlaceManifestSource[]
  items: PlaceManifestItem[]
}

export type ValidatedPlaceManifest = PlaceManifest & { sha256: string }

const fail = (field: string): never => { throw new Error(`place_manifest_invalid:${field}`) }
const obj = (v: unknown, f: string): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(f)
const str = (v: unknown, f: string, max = 600): string =>
  typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v) ? v : fail(f)
const strs = (v: unknown, f: string): string[] => (Array.isArray(v) ? v.map((x, i) => str(x, `${f}.${i}`, 120)) : fail(f))
const https = (v: unknown, f: string): string => {
  const s = str(v, f, 400)
  try { if (new URL(s).protocol === 'https:') return s } catch { /* fall through */ }
  return fail(f)
}
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], f: string): T =>
  (allowed as readonly unknown[]).includes(v) ? (v as T) : fail(f)

/** Strict validation. Throws `place_manifest_invalid:<field>` on the first problem. */
export function validatePlaceManifest(input: unknown): ValidatedPlaceManifest {
  const root = obj(input, 'root')
  if (root.manifest_version !== PLACE_MANIFEST_VERSION) fail('manifest_version')
  const p = obj(root.place, 'place')
  const id = str(p.id, 'place.id', 130)
  if (!isPlaceId(id)) fail('place.id')
  const slug = str(p.slug, 'place.slug', PLACE_SLUG_MAX_LENGTH)
  if (!PLACE_SLUG_RE.test(slug)) fail('place.slug')
  const pres = obj(p.presentation, 'place.presentation')
  const presentation: PlaceManifest['place']['presentation'] = {}
  if (pres.display_title !== undefined) presentation.display_title = str(pres.display_title, 'presentation.display_title', 120)
  if (pres.relation_record !== undefined) presentation.relation_record = str(pres.relation_record, 'presentation.relation_record', 120)
  const place = {
    id, slug, presentation,
    label: str(p.label, 'place.label', 160),
    region: str(p.region, 'place.region', 80),
    region_slug: str(p.region_slug, 'place.region_slug', 80),
    jurisdiction: str(p.jurisdiction, 'place.jurisdiction', 80),
    summary: str(p.summary, 'place.summary', 300),
  }

  if (!Array.isArray(root.sources) || root.sources.length < 1) fail('sources')
  const sources = (root.sources as unknown[]).map((raw, i): PlaceManifestSource => {
    const s = obj(raw, `sources.${i}`)
    const retrieved = str(s.retrieved_at, `sources.${i}.retrieved_at`, 40)
    if (Number.isNaN(Date.parse(retrieved))) fail(`sources.${i}.retrieved_at`)
    const sha = str(s.sha256, `sources.${i}.sha256`, 64)
    if (!SHA256_RE.test(sha)) fail(`sources.${i}.sha256`)
    const provider = str(s.provider, `sources.${i}.provider`, 64)
    if (!TOKEN_RE.test(provider)) fail(`sources.${i}.provider`)
    return {
      ref: str(s.ref, `sources.${i}.ref`, 64), provider, sha256: sha, retrieved_at: retrieved,
      publisher: str(s.publisher, `sources.${i}.publisher`, 200),
      url: https(s.url, `sources.${i}.url`),
      licence: str(s.licence, `sources.${i}.licence`, 120),
      licence_url: https(s.licence_url, `sources.${i}.licence_url`),
      attribution: str(s.attribution, `sources.${i}.attribution`, 300),
    }
  })
  if (new Set(sources.map((s) => s.ref)).size !== sources.length) fail('sources.ref_unique')

  if (!Array.isArray(root.items) || root.items.length < 1 || root.items.length > 50) fail('items')
  const items = (root.items as unknown[]).map((raw, i): PlaceManifestItem => {
    const it = obj(raw, `items.${i}`)
    const kind = oneOf(it.kind, ITEM_KINDS, `items.${i}.kind`)
    const sourceRef = str(it.source_ref, `items.${i}.source_ref`, 64)
    if (!sources.some((s) => s.ref === sourceRef)) fail(`items.${i}.source_ref`)
    const uncertainty = (Array.isArray(it.uncertainty) ? it.uncertainty : fail(`items.${i}.uncertainty`)) as unknown[]
    // Nothing may be published as if it were a timed observation.
    if (!uncertainty.includes('observation_time_unknown')) fail(`items.${i}.uncertainty.observation_time_unknown`)
    if (kind === 'DESIGNATION' && !uncertainty.includes('designation_not_observation')) fail(`items.${i}.uncertainty.designation`)
    const entities = (Array.isArray(it.entities) ? it.entities : fail(`items.${i}.entities`)) as unknown[]
    if (kind !== 'DESIGNATION' && entities.length) fail(`items.${i}.entities.designation_only`)
    return {
      item_key: str(it.item_key, `items.${i}.item_key`, 120),
      kind,
      evidence_type: str(it.evidence_type, `items.${i}.evidence_type`, 80),
      statement: str(it.statement, `items.${i}.statement`, 1000),
      source_ref: sourceRef,
      source_external_id: str(it.source_external_id, `items.${i}.source_external_id`, 120),
      source_locator: str(it.source_locator, `items.${i}.source_locator`, 400),
      search_terms: strs(it.search_terms, `items.${i}.search_terms`),
      uncertainty: uncertainty.map((u, j) => oneOf(u, UNCERTAINTY_FLAGS, `items.${i}.uncertainty.${j}`)),
      entities: entities.map((rawE, j): PlaceManifestEntity => {
        const e = obj(rawE, `items.${i}.entities.${j}`)
        return {
          kind: oneOf(e.kind, ENTITY_KINDS, `items.${i}.entities.${j}.kind`),
          label: str(e.label, `items.${i}.entities.${j}.label`, 200),
          authority: str(e.authority, `items.${i}.entities.${j}.authority`, 64),
          external_id: str(e.external_id, `items.${i}.entities.${j}.external_id`, 64),
          source_assertion: str(e.source_assertion, `items.${i}.entities.${j}.source_assertion`, 300),
          source_terms: strs(e.source_terms, `items.${i}.entities.${j}.source_terms`),
          curated_terms: strs(e.curated_terms, `items.${i}.entities.${j}.curated_terms`),
        }
      }),
    }
  })
  if (new Set(items.map((x) => x.item_key)).size !== items.length) fail('items.item_key_unique')
  if (new Set(items.map((x) => x.source_external_id)).size !== items.length) fail('items.source_external_id_unique')

  const manifest: PlaceManifest = { manifest_version: PLACE_MANIFEST_VERSION, place, sources, items }
  return Object.freeze({ ...manifest, sha256: fingerprint(manifest) })
}

export function manifestSource(manifest: PlaceManifest, item: PlaceManifestItem): PlaceManifestSource {
  return manifest.sources.find((s) => s.ref === item.source_ref) ?? fail('source_ref')
}

/**
 * The exact V1 evidence body for one manifest item. Used by the local seeding
 * script and by tests; the projection adapter re-validates every field.
 */
export function manifestEvidenceBody(manifest: ValidatedPlaceManifest, item: PlaceManifestItem) {
  const source = manifestSource(manifest, item)
  return {
    provider: source.provider,
    evidence_type: item.evidence_type,
    source_external_id: item.source_external_id,
    publisher: source.publisher,
    source_url: source.url,
    retrieval_time: source.retrieved_at,
    source_data: {
      statement: item.statement,
      source_locator: item.source_locator,
      source_sha256: source.sha256,
      features: item.entities.map((e) => ({ code: e.external_id, label: e.label, assertion: e.source_assertion })),
    },
    metadata: {
      place_memory: {
        train: PLACE_MANIFEST_TRAIN,
        manifest_sha256: manifest.sha256,
        place_id: manifest.place.id,
        item_key: item.item_key,
      },
    },
    provenance: {
      rights_class: 'CLEARED_FOR_INGEST',
      licence: source.licence,
      licence_url: source.licence_url,
      attribution: source.attribution,
      manifest_sha256: manifest.sha256,
      source_sha256: source.sha256,
    },
  }
}
