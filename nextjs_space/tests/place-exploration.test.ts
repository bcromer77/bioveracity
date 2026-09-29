import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PGlite } from '@electric-sql/pglite'
import type { Sql } from '../lib/workspaces/service'
import { CURRENT_PRESENCE_WARNING, DESIGNATION_FEATURE_NOTE } from '../lib/place/public-read'
import { loadPlaceShell } from '../lib/place/shell-loader'
import {
  PLACE_PROMPTS, PLACE_SEARCH_MAX_LENGTH, SPECIES_SLUG_RE, recordAnchor, searchPlaceView, speciesJourney, speciesSlug,
  type PlaceShellView,
} from '../lib/place/shell-view'
import { PlaceShell } from '../components/place/place-shell'
import { PlaceJourney } from '../components/place/place-journey'
import { PLACE_ARRIVE_CSS } from '../components/place/place-arrive-styles'
import { placePresentation } from '../lib/place-memory/place-presentation'

// PR F Place Exploration: PLACE -> EXPLORE -> TIME -> SPECIES -> EVIDENCE ->
// ORIGINAL SOURCE. Synthetic, Place-neutral fixtures; SENTINEL marks anything
// that must never surface.
const root = process.cwd()
const MIGRATIONS = [
  '0000_init', '20260909_private_workspace_foundation', '20260920_observation_revisions',
  '20261001_developer_platform_v1', '20261003_kerry_place_memory_v1', '20261004_place_slug_history',
]
const PLACE = 'bv_place_synthetic_gamma'
const EMPTY = 'bv_place_synthetic_delta'
const j = (v: unknown) => JSON.stringify(v)
const CLEARED = { licence: 'Open Licence 1.0', rights_class: 'CLEARED_FOR_INGEST', attribution: 'Synthetic Publisher' }

type Row = { id: string; statement: string; kind?: string; cls?: string; relation?: string; visibility?: string; rights?: string; disclosure?: string; entity?: string; label?: string; common?: string; uncertainty?: unknown; start?: string }
const ROWS: Row[] = [
  { id: 'mem_g_designation', statement: 'Synthetic protected area lists grey heron as a qualifying interest', kind: 'DESIGNATION', cls: 'AUTHORITATIVE_STATUTORY', relation: 'QUALIFYING_INTEREST',
    entity: 'ent_heron', label: 'Ardea cinerea', common: 'Grey heron', uncertainty: { designation_not_observation: true, current_presence_not_established: true, observation_time_unknown: true } },
  { id: 'mem_g_heron_obs', statement: 'Heron seen feeding at the channel edge', cls: 'PROFESSIONAL_OBSERVATION', disclosure: 'GENERALISED', entity: 'ent_heron', label: 'Ardea cinerea', start: '2019-05-02T00:00:00Z' },
  { id: 'mem_g_hidden', statement: 'Roost count with withheld location', cls: 'PROFESSIONAL_OBSERVATION', disclosure: 'HIDDEN', entity: 'ent_dunlin', label: 'Calidris alpina', common: 'Dunlin', start: '2012-01-10T00:00:00Z' },
  { id: 'mem_x_restricted', statement: 'SENTINEL_RESTRICTED record', visibility: 'RESTRICTED', rights: 'PERMISSION_REQUIRED', entity: 'ent_sentinel', label: 'SENTINEL_TAXON' },
]

async function harness() {
  const pg = new PGlite()
  for (const m of MIGRATIONS) await pg.exec(readFileSync(join(root, 'prisma/migrations', m, 'migration.sql'), 'utf8'))
  const db: Sql = { query: async <T>(text: string, values: unknown[]) => (await pg.query<T>(text, values)).rows }
  const q = (text: string, values: unknown[] = []) => pg.query(text, values)
  for (const [id, name, slug] of [[PLACE, 'Gamma Estuary', 'gamma-estuary'], [EMPTY, 'Delta Moss', 'delta-moss']]) {
    await q(`INSERT INTO "Asset" (id,slug,name,type,region,"regionSlug",status,"updatedAt") VALUES ($1,$2,$3,'living_place','r','r','active',now())`, [id, slug, name])
    await q(`INSERT INTO "PlaceSlug" (slug,"placeId") VALUES ($1,$2)`, [slug, id])
  }
  await q(`INSERT INTO "PlatformApiKey" (id,name,mode,"lookupId","secretHash") VALUES ('ak_sentinel','k','live','SENTINEL_LOOKUP','SENTINEL_HASH')`)
  const entities = new Set<string>()
  for (const [index, r] of ROWS.entries()) {
    await q(`INSERT INTO "PlatformRawEvidence" (id,"apiKeyId",mode,"payloadFingerprint","rawBody","requestId") VALUES ($1,'ak_sentinel','live',$2,$3::jsonb,$4)`,
      [`raw_${r.id}`, `SENTINEL_FP_${r.id}`, j({ body: 'SENTINEL_RAW_BODY' }), `req_${r.id}`])
    await q(`INSERT INTO "PlatformEvidence" (id,"apiKeyId",mode,"rawEvidenceId",provider,"sourceExternalId","evidenceType",publisher,"sourceUrl","retrievalTime","sourceData",provenance,"processingStatus","requestId","idempotencyKey")
      VALUES ($1,'ak_sentinel','live',$2,'synthetic',$3,'t','Synthetic Publisher','https://example.org/source','2026-01-02T03:04:05Z','{}'::jsonb,$4::jsonb,'PROCESSED',$5,'SENTINEL_IDEM_' || $1)`,
      [`ev_${r.id}`, `raw_${r.id}`, `SRC-${String(index).padStart(3, '0')}`, j(CLEARED), `req_${r.id}`])
    await q(`INSERT INTO "PlaceMemoryItem" (id,"itemKey","placeId","platformEvidenceId",kind,"evidenceClass",visibility,"rightsState","originalStatement","sourceIndependenceKey","geographyPrecision","locationDisclosure",uncertainty,status,"eventStart")
      VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,'SENTINEL_INDEPENDENCE','named site',$9,$10::jsonb,'ACTIVE',$11)`,
      [r.id, PLACE, `ev_${r.id}`, r.kind ?? 'OBSERVATION', r.cls ?? 'PROFESSIONAL_OBSERVATION', r.visibility ?? 'PUBLIC', r.rights ?? 'CLEARED_FOR_INGEST', r.statement,
        r.disclosure ?? 'NAMED_ONLY', j(r.uncertainty ?? {}), r.start ?? null])
    await q(`INSERT INTO "PlaceMemorySourceLink" ("itemId","platformEvidenceId",relationship,"sourceIndependenceKey") VALUES ($1,$2,'PRIMARY','SENTINEL_INDEPENDENCE')`, [r.id, `ev_${r.id}`])
    if (r.entity) {
      if (!entities.has(r.entity)) {
        entities.add(r.entity)
        await q(`INSERT INTO "PlaceMemoryEntity" (id,kind,"canonicalLabel",authority,"externalId",metadata) VALUES ($1,'TAXON',$2,'SYNTH',$3,'{}'::jsonb)`, [r.entity, r.label, `T-${entities.size}`])
        if (r.common) await q(`INSERT INTO "PlaceMemoryTerm" (id,"entityId",term,normalized,language,"termType",status) VALUES ($1,$2,$3,lower($3),'en','COMMON_NAME','CURATED')`, [`term_${r.entity}`, r.entity, r.common])
      }
      await q(`INSERT INTO "PlaceMemoryItemEntity" ("itemId","entityId","relationType","assertionState","sourceAssertion",uncertainty) VALUES ($1,$2,$3,'SOURCE_ASSERTION','{}'::jsonb,'{}'::jsonb)`,
        [r.id, r.entity, r.relation ?? 'SUBJECT'])
    }
  }
  return { pg, db }
}

async function okView(db: Sql, slug: string) {
  const r = await loadPlaceShell(db, slug, placePresentation)
  assert.equal(r.outcome, 'ok')
  return (r as { view: PlaceShellView }).view
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')
const NO_LEAK = /SENTINEL|coordinates|geometry|EPSG|centroid|"Point"|\b(mem|ev|raw|ent)_[a-z0-9_]+/i

test('F1. explore: every prompt leads somewhere, map prompt included, records are anchorable by public handle only', async () => {
  const h = await harness()
  try {
    const view = await okView(h.db, 'gamma-estuary')
    assert.equal(PLACE_PROMPTS.length, 5)
    assert.ok(PLACE_PROMPTS.some((p) => p.id === 'where-was-it-recorded'))
    for (const p of view.prompts) assert.match(p.next.href, /^#(species|evidence|time|how-we-know|map)$/, `${p.id} has a next step`)
    assert.equal(view.prompts.find((p) => p.id === 'where-was-it-recorded')?.next.href, '#map')
    assert.equal(view.cards.length, 3, 'restricted record never reaches the view')
    for (const c of view.cards) assert.equal(recordAnchor(c.handle), `record-${c.handle}`)
    const leak = JSON.stringify(view).match(NO_LEAK)
    assert.ok(!leak, `view leaked: ${leak?.[0]}`)
    const html = renderToStaticMarkup(createElement(PlaceShell, { view }))
    assert.ok(!NO_LEAK.test(html), 'rendered Place leaks nothing')
    for (const c of view.cards) assert.ok(html.includes(`id="${recordAnchor(c.handle)}"`), 'each evidence card is a target')
    assert.equal((html.match(/data-prompt-next=/g) ?? []).length, view.prompts.length, 'no dead-end prompt')
    for (const [from, to] of [['time', 'species'], ['species', 'evidence'], ['evidence', 'how-we-know'], ['map', 'time']]) {
      const after = html.slice(html.indexOf(`id="${from}"`))
      assert.equal(after.match(/data-next-step="([^"]+)"/)?.[1], `#${to}`, `${from} continues to ${to}`)
    }
    assert.ok(PLACE_ARRIVE_CSS.includes('.pa-sheet:has(:target)'), 'a nested record target opens its sheet')
    assert.ok(!html.includes('id="place-search"'), 'no results sheet without a query')
  } finally { await h.pg.close() }
})

test('F2. map: evidence-safe state only; no drawn geometry, restricted location withheld, precision kept', async () => {
  const h = await harness()
  try {
    const view = await okView(h.db, 'gamma-estuary')
    assert.equal(view.map.drawable, false)
    assert.deepEqual([view.map.records, view.map.namedOnly, view.map.generalised, view.map.withheld], [3, 1, 1, 1])
    assert.equal(view.map.state, 'NOT LOCATED')
    assert.ok(view.map.precisions.includes('named site'))
    assert.match(view.map.reason, /no map is drawn/)
    const html = renderToStaticMarkup(createElement(PlaceShell, { view }))
    const sheet = html.slice(html.indexOf('id="map"'))
    assert.match(sheet, /data-map-state="not-supported"/)
    assert.ok(text(sheet).includes('The public evidence does not support a map'))
    assert.ok(!/<canvas|<iframe|<img|leaflet|mapbox|maplibre/i.test(html), 'no GIS or tile imagery')
    assert.deepEqual(await loadPlaceShell(h.db, 'delta-moss'), { outcome: 'not_found' }, 'a Place with no public record has no page to map')
  } finally { await h.pg.close() }
})

test('F3. species journey: Overview -> Chronology -> Map -> Evidence -> Sources; designation is not presence; undated stays off time', async () => {
  const h = await harness()
  try {
    const view = await okView(h.db, 'gamma-estuary')
    const heron = view.species.find((s) => s.label === 'Ardea cinerea')!
    assert.equal(heron.slug, 'ardea-cinerea')
    const jn = speciesJourney(view, 'ardea-cinerea')!
    assert.ok(jn.designation && jn.observed)
    assert.equal(jn.presenceNow, 'UNKNOWN')
    assert.equal(jn.note, DESIGNATION_FEATURE_NOTE)
    assert.equal(jn.cards.length, 2)
    assert.equal(jn.chronology.length, 1, 'only the dated observation is placed in time')
    assert.equal(jn.chronology[0].date.slice(0, 4), '2019')
    assert.equal(jn.undated, 1, 'the designation is counted as undated, not dated')
    assert.equal(jn.map.drawable, false)
    assert.equal(speciesJourney(view, 'nope'), null)
    assert.equal(speciesJourney(view, 'Bad_Slug'), null)
    assert.equal(speciesJourney(view, 'sentinel-taxon'), null, 'a restricted-only object has no journey')
    const html = renderToStaticMarkup(createElement(PlaceShell, { view, children: createElement(PlaceJourney, { j: jn, placeTitle: view.title, placePath: view.path! }) }))
    assert.deepEqual([...html.matchAll(/data-journey-step="([a-z]+)"/g)].map((m) => m[1]), ['overview', 'chronology', 'map', 'evidence', 'sources'])
    assert.match(html, /data-designation-note/)
    assert.match(html, /data-map-state="not-supported"/)
    const sources = html.slice(html.indexOf('data-journey-step="sources"'))
    assert.match(sources, /<button type="button"[^>]*aria-expanded="false"[^>]*>Synthetic Publisher<\/button>/, 'the original source reference is reachable on-site')
    assert.ok(!NO_LEAK.test(html))
    const place = renderToStaticMarkup(createElement(PlaceShell, { view }))
    assert.ok(place.includes('href="/place/gamma-estuary/species/ardea-cinerea"'), 'species rows open the journey')
    const dunlin = speciesJourney(view, 'calidris-alpina')!
    assert.equal(dunlin.map.withheld, 1)
    assert.equal(dunlin.presenceNow, 'UNKNOWN')
  } finally { await h.pg.close() }
})

test('F4. search: Place-scoped, deterministic, presence-safe, bounded', async () => {
  const h = await harness()
  try {
    const view = await okView(h.db, 'gamma-estuary')
    const a = searchPlaceView(view, 'Grey HERON')!
    assert.deepEqual({ ...a, q: '' }, { ...searchPlaceView(view, 'grey heron')!, q: '' }, 'deterministic and case-folded')
    assert.equal(a.status, 'ok')
    assert.deepEqual(a.species.map((s) => s.slug), ['ardea-cinerea'])
    assert.equal(a.records.length, 2)
    assert.equal(a.warning, null)
    const now = searchPlaceView(view, 'can I see a heron now')!
    assert.equal(now.warning, CURRENT_PRESENCE_WARNING)
    assert.equal(searchPlaceView(view, 'SENTINEL')!.records.length, 0, 'restricted text is not searchable')
    assert.equal(searchPlaceView(view, 'x'.repeat(PLACE_SEARCH_MAX_LENGTH + 1))!.status, 'invalid')
    assert.equal(searchPlaceView(view, 'bad\u0000q')!.status, 'invalid')
    assert.equal(searchPlaceView(view, '   '), null)
    assert.equal(searchPlaceView(view, ['heron']), null)
    const html = renderToStaticMarkup(createElement(PlaceShell, { view, search: now }))
    assert.match(html, /id="place-search"/)
    assert.match(html, /data-search-warning/)
    assert.ok(html.includes('href="/place/gamma-estuary/species/ardea-cinerea"'))
    const none = renderToStaticMarkup(createElement(PlaceShell, { view, search: searchPlaceView(view, 'kingfisher') }))
    assert.match(none, /data-search-empty/)
    assert.ok(!NO_LEAK.test(html + none))
  } finally { await h.pg.close() }
})

test('F5. slugs and routes: data-derived slugs, flag first, uniform 404, no new provider', () => {
  assert.equal(speciesSlug('Ardea cinerea'), 'ardea-cinerea')
  assert.equal(speciesSlug('Črne  Æ-feature!'), 'crne-feature')
  assert.ok(SPECIES_SLUG_RE.test('ardea-cinerea') && !SPECIES_SLUG_RE.test('Ardea') && !SPECIES_SLUG_RE.test('a--b') && !SPECIES_SLUG_RE.test('../x'))
  const route = readFileSync(join(root, 'app/place/[slug]/species/[species]/page.tsx'), 'utf8')
  const body = route.slice(route.indexOf('export default'))
  assert.ok(body.indexOf('isPlaceExperienceEnabled()') < body.indexOf('await params'), 'flag is checked first')
  assert.match(route, /robots: \{ index: false/)
  assert.match(route, /loadPlaceShell\(db, slug, placePresentation\)/)
  for (const p of ['lib/place/shell-view.ts', 'components/place/place-journey.tsx', 'app/place/[slug]/species/[species]/page.tsx', 'app/place/[slug]/page.tsx']) {
    assert.ok(!/embedding|vector|openai|leaflet|mapbox|maplibre|turf|centroid\(/i.test(readFileSync(join(root, p), 'utf8')), `${p}: no semantic or GIS provider`)
  }
})
