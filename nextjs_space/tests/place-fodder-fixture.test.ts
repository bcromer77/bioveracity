import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
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
import { PlaceShell } from '../components/place/place-shell'
import {
  FODDER_EVIDENCE_STATE, FODDER_FIXTURE_SOURCE, FODDER_PLACE_ID, FODDER_PLACE_SLUG, fodderAssetSeed, fodderItemSeeds,
} from '../lib/place-memory/fodder-fixture'

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
  await q(`INSERT INTO "PlatformApiKey" (id,name,mode,"lookupId","secretHash") VALUES ('ak_sentinel','k','live','SENTINEL_LOOKUP','SENTINEL_HASH')`)
  const evidence = async (id: string, publisher: string, sourceExternalId: string, provenance: object, sourceUrl: string | null = null) => {
    await q(`INSERT INTO "PlatformRawEvidence" (id,"apiKeyId",mode,"payloadFingerprint","rawBody","requestId") VALUES ($1,'ak_sentinel','live',$2,$3::jsonb,$4)`,
      [`raw_${id}`, `SENTINEL_FP_${id}`, j({ body: 'SENTINEL_RAW_BODY' }), `req_${id}`])
    await q(`INSERT INTO "PlatformEvidence" (id,"apiKeyId",mode,"rawEvidenceId",provider,"sourceExternalId","evidenceType",publisher,"sourceUrl","retrievalTime","sourceData",provenance,"processingStatus","requestId","idempotencyKey")
      VALUES ($1,'ak_sentinel','live',$2,'synthetic',$3,'t',$4,$8,'2026-01-02T03:04:05Z','{}'::jsonb,$5::jsonb,'PROCESSED',$6,$7)`,
      [id, `raw_${id}`, sourceExternalId, publisher, j(provenance), `req_${id}`, `SENTINEL_IDEM_${id}`, sourceUrl])
  }
  // Fodder: Asset + slug + two FIXTURE-labelled, non-ecological structural items
  // behind the same publication gate as any other Place. No entities, dates or geography.
  await insertPlace(fodderAssetSeed())
  const src = FODDER_FIXTURE_SOURCE
  await evidence(src.evidenceId, src.publisher, src.sourceExternalId,
    { licence: src.licence, rights_class: 'CLEARED_FOR_INGEST', attribution: src.attribution })
  for (const item of fodderItemSeeds()) {
    await q(`INSERT INTO "PlaceMemoryItem" (id,"itemKey","placeId","platformEvidenceId",kind,"evidenceClass",visibility,"rightsState","originalStatement","sourceIndependenceKey",uncertainty,status)
      VALUES ($1,$1,$2,$3,$4,$5,'PUBLIC','CLEARED_FOR_INGEST',$6,'FIXTURE_INDEPENDENCE','{}'::jsonb,'ACTIVE')`,
      [item.id, FODDER_PLACE_ID, src.evidenceId, item.kind, item.evidenceClass, item.originalStatement])
    await q(`INSERT INTO "PlaceMemorySourceLink" ("itemId","platformEvidenceId",relationship,"sourceIndependenceKey") VALUES ($1,$2,'PRIMARY','FIXTURE_INDEPENDENCE')`, [item.id, src.evidenceId])
    await q(`INSERT INTO "PlaceMemorySearchDocument" ("itemId",content,"representationVersion") VALUES ($1,$2,'fixture-v1')`, [item.id, item.originalStatement])
  }
  if (opts.kerry) {
    await insertPlace({ id: KERRY_PLACE_ID, slug: KERRY_PLACE_SLUG, name: 'Synthetic Kerry Asset', type: 'living_place', region: 'r', regionSlug: 'r', status: 'active' })
    await evidence('ev_k', 'Synthetic Publisher', 'SRC-K-001', CLEARED, 'https://example.org/source')
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

const FIXTURE_ITEMS = fodderItemSeeds()
const shellView = async (db: Sql, slug: string) => {
  const r = await loadPlaceShell(db, slug, placePresentation)
  assert.equal(r.outcome, 'ok', `${slug} resolves through the generic loader`)
  return (r as { outcome: 'ok'; view: PlaceShellView }).view
}
const landmarks = (html: string) => ({
  skipLink: /<a [^>]*href="#place-main"[^>]*>Skip to place content<\/a>/.test(html),
  main: /<main id="place-main" tabindex="-1"/.test(html),
  header: /<header[\s>]/.test(html),
  footer: /<footer[\s>]/.test(html),
  sectionNav: /<nav aria-label="Place sections"/.test(html),
  mobileNav: /<nav aria-label="Place navigation"/.test(html),
  singleH1: (html.match(/<h1[\s>]/g) ?? []).length === 1,
  h2: /<h2[\s>]/.test(html),
  decorativeSvgHidden: [...html.matchAll(/<svg\b[^>]*>/g)].every((m) => /aria-hidden="true"|role="img"|aria-label=/.test(m[0])),
})

test('G4. Fodder through the generic read model: public header from FIXTURE items only', async () => {
  const h = await harness({ kerry: false })
  try {
    assert.ok(isPlaceId(FODDER_PLACE_ID))
    assert.equal(FODDER_EVIDENCE_STATE.status, 'sparse')
    const place = await readPublicPlace(h.db, FODDER_PLACE_ID)
    assert.deepEqual(place, { name: 'Fodder in the Woods', slug: FODDER_PLACE_SLUG, publicItemCount: FIXTURE_ITEMS.length })
    const items = await listPublicPlaceMemory(h.db, FODDER_PLACE_ID)
    assert.deepEqual(items.map((i) => i.statement).sort(), FIXTURE_ITEMS.map((i) => i.originalStatement).sort())
    assert.ok(items.every((i) => i.statement.startsWith('FIXTURE (non-production)')), 'every public item is labelled FIXTURE')
    assert.ok(!ECOLOGICAL_CLAIM.test(JSON.stringify(items.map((i) => i.statement))), 'fixture items make no ecological claim')
    assert.equal((await searchPublicPlaceMemory(h.db, FODDER_PLACE_ID, { q: 'fixture' })).results.length, FIXTURE_ITEMS.length)
    assert.equal((await searchPublicPlaceMemory(h.db, FODDER_PLACE_ID, { q: 'heron' })).results.length, 0)
  } finally { await h.pg.close() }
})

test('G4b. loadPlaceShell(fodder-woods) returns ok with a Fodder view built by the generic seam', async () => {
  const h = await harness({ kerry: false })
  try {
    const view = await shellView(h.db, FODDER_PLACE_SLUG)
    assert.equal(view.title, 'Fodder', 'display title from place-presentation.ts')
    assert.equal(view.context, 'Fodder in the Woods')
    assert.equal(view.path, `/place/${FODDER_PLACE_SLUG}`)
    assert.equal(view.publicItemCount, FIXTURE_ITEMS.length)
    assert.equal(view.relation, null, 'no public statutory record names a relation, so none is shown')
    assert.deepEqual(view.species, [], 'no species are fabricated')
    assert.deepEqual(view.timeline, [], 'no chronology is fabricated')
    assert.ok(view.categories.every((c) => c.count === 0), 'every category count is zero')
  } finally { await h.pg.close() }
})

test('G4c. rendered Fodder shell contains Fodder and no Tralee/Kerry text', async () => {
  const h = await harness({ kerry: true })
  try {
    const html = renderToStaticMarkup(createElement(PlaceShell, { view: await shellView(h.db, FODDER_PLACE_SLUG) }))
    assert.ok(/<h1[^>]*>Fodder<\/h1>/.test(html), 'Fodder is the page heading')
    assert.ok(!/tralee|kerry|heron/i.test(html), 'no Tralee/Kerry data in the Fodder page')
    assert.ok(!html.includes(FODDER_PLACE_ID) && !FIXTURE_ITEMS.some((i) => html.includes(i.id)), 'no internal identifiers leak')
    assert.ok(!/<img\b|<iframe\b|coordinates|EPSG/i.test(html), 'no imagery, map embed or geometry')
  } finally { await h.pg.close() }
})

test('G4d. Fodder and Tralee share the same shell contract', async () => {
  const h = await harness({ kerry: true })
  try {
    const fodder = await shellView(h.db, FODDER_PLACE_SLUG)
    const kerry = await shellView(h.db, KERRY_PLACE_SLUG)
    assert.deepEqual(Object.keys(fodder).sort(), Object.keys(kerry).sort(), 'identical PlaceShellView keys')
    assert.deepEqual(fodder.categories.map((c) => c.id), kerry.categories.map((c) => c.id), 'identical category order')
    assert.deepEqual(fodder.prompts.map((p) => p.question), kerry.prompts.map((p) => p.question), 'identical prompts')
    assert.deepEqual(Object.keys(fodder.known).sort(), Object.keys(kerry.known).sort())
    assert.deepEqual(Object.keys(fodder.map).sort(), Object.keys(kerry.map).sort())
    const fh = renderToStaticMarkup(createElement(PlaceShell, { view: fodder }))
    const kh = renderToStaticMarkup(createElement(PlaceShell, { view: kerry }))
    const ids = (html: string) => [...html.matchAll(/<section[^>]* id="([\w-]+)"/g)].map((m) => m[1])
    assert.deepEqual(ids(fh), ids(kh), 'identical section anchors')
    assert.ok(ids(fh).length > 0)
    assert.deepEqual(landmarks(fh), landmarks(kh), 'identical landmark profile')
  } finally { await h.pg.close() }
})

test('G4e. rendered Fodder shell carries the accessibility landmarks', async () => {
  const h = await harness({ kerry: false })
  try {
    const html = renderToStaticMarkup(createElement(PlaceShell, { view: await shellView(h.db, FODDER_PLACE_SLUG) }))
    const l = landmarks(html)
    for (const [name, ok] of Object.entries(l)) assert.ok(ok, `landmark: ${name}`)
    assert.ok(html.indexOf('Skip to place content') < html.indexOf('<main'), 'skip link precedes main')
  } finally { await h.pg.close() }
})

test('G5. Place isolation — Fodder cannot retrieve Kerry evidence in a shared database', async () => {
  const h = await harness({ kerry: true })
  try {
    const kerry = await listPublicPlaceMemory(h.db, KERRY_PLACE_ID)
    assert.equal(kerry.length, 1, 'the Kerry item is present and public')
    const fodder = await listPublicPlaceMemory(h.db, FODDER_PLACE_ID)
    assert.equal(fodder.length, FIXTURE_ITEMS.length, 'Fodder sees only its own FIXTURE items')
    assert.ok(!/heron|wetland|Synthetic Publisher/i.test(JSON.stringify(fodder)))
    assert.equal((await readPublicPlace(h.db, FODDER_PLACE_ID))?.publicItemCount, FIXTURE_ITEMS.length, 'Kerry items are not counted')
    const fodderSearch = await searchPublicPlaceMemory(h.db, FODDER_PLACE_ID, { q: 'heron' })
    assert.equal(fodderSearch.results.length, 0, 'Kerry text is not searchable from Fodder')
    const browse = await searchPublicPlaceMemory(h.db, FODDER_PLACE_ID, {})
    assert.equal(browse.results.length, FIXTURE_ITEMS.length)
    assert.ok(!/heron|wetland/i.test(JSON.stringify(browse)))
    const view = await shellView(h.db, FODDER_PLACE_SLUG)
    assert.ok(!/heron|wetland|tralee|kerry/i.test(JSON.stringify(view)), 'no Kerry data in the Fodder view')
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
  const items = fodderItemSeeds()
  assert.ok(items.length <= 2 && Object.isFrozen(items) && items.every((i) => Object.isFrozen(i)))
  assert.ok(!ECOLOGICAL_CLAIM.test(JSON.stringify([items, FODDER_FIXTURE_SOURCE])), 'item seeds and source make no ecological claim')
  assert.ok(items.every((i) => i.originalStatement.startsWith('FIXTURE (non-production)')), 'every item is labelled FIXTURE')
  assert.ok(items.every((i) => Object.keys(i).sort().join() === 'evidenceClass,id,kind,originalStatement'), 'no entity, date or geography fields')
  assert.ok(/FIXTURE/.test(FODDER_FIXTURE_SOURCE.publisher) && /FIXTURE/.test(FODDER_FIXTURE_SOURCE.licence))
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

