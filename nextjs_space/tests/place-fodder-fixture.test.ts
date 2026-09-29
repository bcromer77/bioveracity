import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { Sql } from '../lib/workspaces/service'
import { listPublicPlaceMemory, readPublicPlace, searchPublicPlaceMemory } from '../lib/place/public-read'
import { isPlaceExperienceEnabled, loadPlaceShell } from '../lib/place/shell-loader'
import { assertPlaceSlug, isPlaceSlug } from '../lib/place/slugs'
import { isPlaceId } from '../lib/place/identity'
import type { PlaceShellView } from '../lib/place/shell-view'
import { placePresentation } from '../lib/place-memory/place-presentation'
import { normaliseMemoryTerm, stableMemoryId } from '../lib/place-memory/memory-utils'
import * as kerryAdapter from '../lib/place-memory/kerry-001'
import { KERRY_PLACE_ID, KERRY_PLACE_SLUG } from '../lib/place-memory/kerry-001'
import { FODDER_EVIDENCE_STATE, FODDER_PLACE_ID, FODDER_PLACE_SLUG, fodderAssetSeed } from '../lib/place-memory/fodder-fixture'

// PR G replication gate: Fodder (a sparse, venue-shaped, NON-PRODUCTION
// fixture) traverses exactly the same generic loader, read model and
// presentation seam as Tralee Wetlands. The Kerry row below is synthetic —
// not the real KERRY-001 cargo — to keep the suite fast and standalone.
const root = process.cwd()
const MIGRATIONS = [
  '0000_init', '20260909_private_workspace_foundation', '20260920_observation_revisions',
  '20261001_developer_platform_v1', '20261003_kerry_place_memory_v1', '20261004_place_slug_history',
]
const j = (v: unknown) => JSON.stringify(v)
const CLEARED = { licence: 'Open Licence 1.0', rights_class: 'CLEARED_FOR_INGEST', attribution: 'Synthetic Publisher' }
const KERRY_ITEM = 'mem_k_synthetic_designation'
const ECOLOGICAL_CLAIM = /species|\bSPA\b|pNHA|\bSAC\b|bird|NPWS|designation|qualifying|habitat|taxon/i

async function harness(opts: { kerry: boolean }) {
  const pg = new PGlite()
  for (const m of MIGRATIONS) await pg.exec(readFileSync(join(root, 'prisma/migrations', m, 'migration.sql'), 'utf8'))
  const db: Sql = { query: async <T>(text: string, values: unknown[]) => (await pg.query<T>(text, values)).rows }
  const q = (text: string, values: unknown[] = []) => pg.query(text, values)
  const insertPlace = async (a: { id: string; slug: string; name: string; type: string; region: string; regionSlug: string; status: string }) => {
    await q(`INSERT INTO "Asset" (id,slug,name,type,region,"regionSlug",status,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,now())`,
      [a.id, a.slug, a.name, a.type, a.region, a.regionSlug, a.status])
    await q(`INSERT INTO "PlaceSlug" (slug,"placeId") VALUES ($1,$2)`, [a.slug, a.id])
  }
  // Fodder: Asset + slug only. No evidence rows — the honest sparse state.
  await insertPlace(fodderAssetSeed())
  if (opts.kerry) {
    await insertPlace({ id: KERRY_PLACE_ID, slug: KERRY_PLACE_SLUG, name: 'Synthetic Kerry Asset', type: 'living_place', region: 'r', regionSlug: 'r', status: 'active' })
    await q(`INSERT INTO "PlatformApiKey" (id,name,mode,"lookupId","secretHash") VALUES ('ak_sentinel','k','live','SENTINEL_LOOKUP','SENTINEL_HASH')`)
    await q(`INSERT INTO "PlatformRawEvidence" (id,"apiKeyId",mode,"payloadFingerprint","rawBody","requestId") VALUES ('raw_k','ak_sentinel','live','SENTINEL_FP_k',$1::jsonb,'req_k')`,
      [j({ body: 'SENTINEL_RAW_BODY' })])
    await q(`INSERT INTO "PlatformEvidence" (id,"apiKeyId",mode,"rawEvidenceId",provider,"sourceExternalId","evidenceType",publisher,"sourceUrl","retrievalTime","sourceData",provenance,"processingStatus","requestId","idempotencyKey")
      VALUES ('ev_k','ak_sentinel','live','raw_k','synthetic','SRC-K-001','t','Synthetic Publisher','https://example.org/source','2026-01-02T03:04:05Z','{}'::jsonb,$1::jsonb,'PROCESSED','req_k','SENTINEL_IDEM_k')`,
      [j(CLEARED)])
    await q(`INSERT INTO "PlaceMemoryItem" (id,"itemKey","placeId","platformEvidenceId",kind,"evidenceClass",visibility,"rightsState","originalStatement","sourceIndependenceKey","geographyPrecision","locationDisclosure",uncertainty,status)
      VALUES ($1,$1,$2,'ev_k','DESIGNATION','AUTHORITATIVE_STATUTORY','PUBLIC','CLEARED_FOR_INGEST','Synthetic wetland record lists grey heron','SENTINEL_INDEPENDENCE','named site','NAMED_ONLY','{}'::jsonb,'ACTIVE')`,
      [KERRY_ITEM, KERRY_PLACE_ID])
    await q(`INSERT INTO "PlaceMemorySourceLink" ("itemId","platformEvidenceId",relationship,"sourceIndependenceKey") VALUES ($1,'ev_k','PRIMARY','SENTINEL_INDEPENDENCE')`, [KERRY_ITEM])
  }
  return { pg, db }
}

test('G1. placePresentation returns Fodder config for FODDER_PLACE_ID', () => {
  const p = placePresentation(FODDER_PLACE_ID)
  assert.ok(p)
  assert.equal(p.displayTitle, 'Fodder')
  assert.equal(p.relationRecord, 'Fodder in the Woods')
  assert.ok(Object.isFrozen(p), 'presentation config is immutable data')
})

test('G2. placePresentation returns Kerry config for KERRY_PLACE_ID — Tralee regression', () => {
  const p = placePresentation(KERRY_PLACE_ID)
  assert.equal(p?.displayTitle, 'Tralee Wetlands')
  assert.equal(p?.relationRecord, 'Tralee Bay Complex')
})

test('G3. placePresentation returns null for unknown place — no fabrication', () => {
  assert.equal(placePresentation('bv_place_synthetic_unknown'), null)
  assert.equal(placePresentation('__proto__'), null)
  assert.equal(placePresentation(''), null)
})

test('G4. Fodder through the generic read model is sparse and honest — no items, no page', async () => {
  const h = await harness({ kerry: false })
  try {
    assert.ok(isPlaceId(FODDER_PLACE_ID))
    assert.equal(FODDER_EVIDENCE_STATE.status, 'sparse')
    assert.deepEqual(await listPublicPlaceMemory(h.db, FODDER_PLACE_ID), [], 'no evidence items exist for Fodder')
    assert.equal(await readPublicPlace(h.db, FODDER_PLACE_ID), null, 'a Place with no public record has no public header')
    const s = await searchPublicPlaceMemory(h.db, FODDER_PLACE_ID, { q: 'heron' })
    assert.equal(s.results.length, 0)
    assert.deepEqual(await loadPlaceShell(h.db, FODDER_PLACE_SLUG, placePresentation), { outcome: 'not_found' },
      'the same generic loader fails closed rather than inventing a rich page')
  } finally { await h.pg.close() }
})

test('G5. Place isolation — Fodder cannot retrieve Kerry evidence in a shared database', async () => {
  const h = await harness({ kerry: true })
  try {
    const kerry = await listPublicPlaceMemory(h.db, KERRY_PLACE_ID)
    assert.equal(kerry.length, 1, 'the Kerry item is present and public')
    assert.deepEqual(await listPublicPlaceMemory(h.db, FODDER_PLACE_ID), [])
    assert.equal(await readPublicPlace(h.db, FODDER_PLACE_ID), null)
    const fodderSearch = await searchPublicPlaceMemory(h.db, FODDER_PLACE_ID, { q: 'heron' })
    assert.equal(fodderSearch.results.length, 0, 'Kerry text is not searchable from Fodder')
    const browse = await searchPublicPlaceMemory(h.db, FODDER_PLACE_ID, {})
    assert.equal(browse.results.length, 0)
    assert.deepEqual(await loadPlaceShell(h.db, FODDER_PLACE_SLUG, placePresentation), { outcome: 'not_found' })
  } finally { await h.pg.close() }
})

test('G6. Place isolation — Kerry search and shell never surface Fodder', async () => {
  const h = await harness({ kerry: true })
  try {
    // Browse search (no text): the synthetic row has no search document, so the
    // un-filtered path is the one that exercises the Place gate.
    const s = await searchPublicPlaceMemory(h.db, KERRY_PLACE_ID, {})
    assert.equal(s.results.length, 1)
    assert.equal((await searchPublicPlaceMemory(h.db, KERRY_PLACE_ID, { q: 'fodder' })).results.length, 0)
    assert.ok(!/fodder/i.test(JSON.stringify(s)), 'no Fodder data in Kerry search')
    const r = await loadPlaceShell(h.db, KERRY_PLACE_SLUG, placePresentation)
    assert.equal(r.outcome, 'ok')
    const view = (r as { view: PlaceShellView }).view
    assert.equal(view.title, 'Tralee Wetlands', 'Tralee still resolves through the same presentation seam')
    assert.ok(!/fodder/i.test(JSON.stringify(view)), 'no Fodder data in the Kerry view')
  } finally { await h.pg.close() }
})

test('G7. Fodder presentation config and seed are metadata, not ecological evidence', () => {
  const p = placePresentation(FODDER_PLACE_ID)
  assert.ok(!ECOLOGICAL_CLAIM.test(JSON.stringify(p)), 'presentation makes no ecological claim')
  const seed = fodderAssetSeed()
  assert.ok(!ECOLOGICAL_CLAIM.test(JSON.stringify(seed)), 'seed makes no ecological claim')
  assert.deepEqual(Object.keys(seed).sort(), ['id', 'name', 'region', 'regionSlug', 'slug', 'status', 'type'], 'no coordinates or evidence fields')
  const registry = readFileSync(join(root, 'lib/place-memory/production-registry.ts'), 'utf8')
  assert.ok(!/fodder/i.test(registry), 'Fodder is not a production projector')
})

test('G8. normaliseMemoryTerm from memory-utils is Place-neutral and backward-compatible', () => {
  assert.equal(normaliseMemoryTerm('  Grey HERON!  '), 'grey heron')
  assert.equal(normaliseMemoryTerm('Café—Wood, Co. Down'), 'cafe wood co down')
  assert.equal(normaliseMemoryTerm('Črne  Æ-feature'), 'crne æ feature')
  assert.equal(normaliseMemoryTerm(''), '')
  assert.equal(normaliseMemoryTerm('woodland venue'), 'woodland venue', 'no Place vocabulary is injected')
  assert.equal(stableMemoryId('mem', 'a', 'b'), stableMemoryId('mem', 'a', 'b'))
  assert.match(stableMemoryId('mem', 'a'), /^mem_[0-9a-f]{32}$/)
  assert.equal(kerryAdapter.normaliseMemoryTerm, normaliseMemoryTerm, 'the Kerry adapter re-exports the same function')
  assert.equal(kerryAdapter.stableMemoryId, stableMemoryId)
  const retrieval = readFileSync(join(root, 'lib/place-memory/retrieval.ts'), 'utf8')
  assert.ok(!retrieval.includes("'./kerry-001'"), 'generic retrieval no longer depends on the Kerry adapter')
})

test('G9. loadPlaceShell fails closed for an unknown slug with the flag on — direct route returns 404', async () => {
  const h = await harness({ kerry: true })
  const previous = process.env.PLACE_EXPERIENCE_ENABLED
  process.env.PLACE_EXPERIENCE_ENABLED = 'true'
  try {
    assert.equal(isPlaceExperienceEnabled(), true)
    assert.deepEqual(await loadPlaceShell(h.db, 'no-such-place', placePresentation), { outcome: 'not_found' })
    assert.deepEqual(await loadPlaceShell(h.db, '../fodder-woods', placePresentation), { outcome: 'not_found' })
    assert.deepEqual(await loadPlaceShell(h.db, 'Fodder-Woods', placePresentation), { outcome: 'not_found' })
  } finally {
    if (previous === undefined) delete process.env.PLACE_EXPERIENCE_ENABLED
    else process.env.PLACE_EXPERIENCE_ENABLED = previous
    await h.pg.close()
  }
})

test('G10. Fodder slug is a valid Place slug', () => {
  assert.ok(isPlaceSlug(FODDER_PLACE_SLUG))
  assert.equal(assertPlaceSlug(FODDER_PLACE_SLUG), FODDER_PLACE_SLUG)
  assert.equal(fodderAssetSeed().slug, FODDER_PLACE_SLUG)
})
