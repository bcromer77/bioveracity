import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { Sql } from '../lib/workspaces/service'
import {
  CURRENT_PRESENCE_WARNING,
  DESIGNATION_FEATURE_NOTE,
  PUBLIC_ITEM_GATE,
  PublicReadInputError,
  buildPublicAnswerContext,
  listPublicPlaceMemory,
  readPublicMemoryItem,
  readPublicPlace,
  searchPublicPlaceMemory,
} from '../lib/place/public-read'

// Synthetic, Place-neutral fixtures. Every non-public row carries a unique
// SENTINEL_* marker in each field a leak could surface through.
const MIGRATIONS = [
  '0000_init', '20260909_private_workspace_foundation', '20260920_observation_revisions',
  '20261001_developer_platform_v1', '20261003_kerry_place_memory_v1', '20261004_place_slug_history',
]
const ALPHA = 'bv_place_synthetic_alpha'
const BETA = 'bv_place_synthetic_beta'
const DRAFT = 'bv_place_synthetic_draft'
const PRIVATE_ONLY = 'bv_place_synthetic_private_only'
const UNKNOWN = 'bv_place_synthetic_unknown'
const handleOf = (id: string) => `pmi_${createHash('sha256').update(`bv-public-item-v1:${id}`).digest('hex').slice(0, 24)}`
const j = (value: unknown) => JSON.stringify(value)

type Variant = {
  id: string
  place?: string
  visibility?: string
  rights?: string
  status?: string
  mode?: string
  processing?: string
  provenance?: unknown
  evidence?: boolean
  link?: boolean
  disclosure?: string
  event?: { sensitive: boolean; disclosure: string }
  kind?: string
  evidenceClass?: string
  relation?: string
  statement?: string
  sourceUrl?: string
  uncertainty?: unknown
}

const CLEARED = { licence: 'Open Licence 1.0', rights_class: 'CLEARED_FOR_INGEST', attribution: 'Synthetic Publisher', internal_locator: 'SENTINEL_PROVENANCE_LOCATOR' }

// Public items first, then every fail-closed variant.
const VARIANTS: Variant[] = [
  { id: 'mem_pub_alpha_obs', statement: 'Grey heron recorded feeding on the estuary', kind: 'OBSERVATION', evidenceClass: 'PROFESSIONAL_OBSERVATION', disclosure: 'GENERALISED', relation: 'SUBJECT',
    uncertainty: { observation_time_unknown: true, SENTINEL_UNCERTAINTY_KEY: true, note: 'SENTINEL_UNCERTAINTY_NOTE' } },
  { id: 'mem_pub_alpha_designation', statement: 'Synthetic protected area designation', kind: 'DESIGNATION', evidenceClass: 'AUTHORITATIVE_STATUTORY', relation: 'QUALIFYING_INTEREST',
    uncertainty: { designation_not_observation: true, current_presence_not_established: true } },
  { id: 'mem_pub_alpha_sensitive', statement: 'Heron nest site record', event: { sensitive: true, disclosure: 'GENERALISED' }, disclosure: 'GENERALISED' },
  { id: 'mem_pub_alpha_hidden', statement: 'Heron roost with hidden location', disclosure: 'HIDDEN' },
  { id: 'mem_pub_alpha_exact', statement: 'Heron exact point record', disclosure: 'EXACT', sourceUrl: 'javascript:alert(1)' },
  { id: 'mem_pub_beta', place: BETA, statement: 'Heron seen at the other place' },
  { id: 'mem_pub_draft', place: DRAFT, statement: 'SENTINEL_DRAFT_PLACE heron' },
  { id: 'mem_x_workspace', visibility: 'WORKSPACE_PRIVATE', rights: 'NOT_CLEARED', statement: 'SENTINEL_WORKSPACE heron' },
  { id: 'mem_x_restricted', visibility: 'RESTRICTED', rights: 'PERMISSION_REQUIRED', statement: 'SENTINEL_RESTRICTED heron' },
  { id: 'mem_x_reference', visibility: 'RESTRICTED', rights: 'REFERENCE_ONLY', statement: 'SENTINEL_REFERENCE heron' },
  { id: 'mem_x_withdrawn', status: 'WITHDRAWN', statement: 'SENTINEL_WITHDRAWN heron' },
  { id: 'mem_x_superseded', status: 'SUPERSEDED', statement: 'SENTINEL_SUPERSEDED heron' },
  { id: 'mem_x_testmode', mode: 'test', statement: 'SENTINEL_TESTMODE heron' },
  { id: 'mem_x_failed', processing: 'PROCESSING_FAILED', statement: 'SENTINEL_FAILED heron' },
  { id: 'mem_x_rawpersisted', processing: 'RAW_PERSISTED', statement: 'SENTINEL_UNPROCESSED heron' },
  { id: 'mem_x_nolicence', provenance: { rights_class: 'CLEARED_FOR_INGEST', attribution: 'x' }, statement: 'SENTINEL_NOLICENCE heron' },
  { id: 'mem_x_blanklicence', provenance: { licence: '   ', rights_class: 'CLEARED_FOR_INGEST' }, statement: 'SENTINEL_BLANKLICENCE heron' },
  { id: 'mem_x_norights', provenance: { licence: 'Open Licence 1.0' }, statement: 'SENTINEL_NORIGHTS heron' },
  { id: 'mem_x_wrongrights', provenance: { licence: 'Open Licence 1.0', rights_class: 'REFERENCE_ONLY' }, statement: 'SENTINEL_WRONGRIGHTS heron' },
  { id: 'mem_x_nullprov', provenance: null, statement: 'SENTINEL_NULLPROVENANCE heron' },
  { id: 'mem_x_arrayprov', provenance: ['licence'], statement: 'SENTINEL_ARRAYPROVENANCE heron' },
  { id: 'mem_x_noevidence', evidence: false, statement: 'SENTINEL_NOEVIDENCE heron' },
  { id: 'mem_x_nolink', link: false, statement: 'SENTINEL_NOLINK heron' },
  { id: 'mem_x_private_only', place: PRIVATE_ONLY, visibility: 'RESTRICTED', rights: 'NOT_CLEARED', statement: 'SENTINEL_PRIVATE_ONLY heron' },
]
const PUBLIC_ALPHA = ['mem_pub_alpha_obs', 'mem_pub_alpha_designation', 'mem_pub_alpha_sensitive', 'mem_pub_alpha_hidden', 'mem_pub_alpha_exact']

async function harness() {
  const pg = new PGlite()
  for (const m of MIGRATIONS) await pg.exec(readFileSync(join(process.cwd(), 'prisma/migrations', m, 'migration.sql'), 'utf8'))
  const log: string[] = []
  const db: Sql = { query: async <T>(text: string, values: unknown[]) => { log.push(text); return (await pg.query<T>(text, values)).rows } }
  const q = (text: string, values: unknown[] = []) => pg.query(text, values)
  for (const [id, status] of [[ALPHA, 'active'], [BETA, 'active'], [DRAFT, 'planning'], [PRIVATE_ONLY, 'active']]) {
    await q(`INSERT INTO "Asset" (id,slug,name,type,region,"regionSlug",status,"updatedAt") VALUES ($1,$2,$3,'living_place','r','r',$4,now())`,
      [id, id.replace(/_/g, '-'), `Name of ${id.endsWith('alpha') ? 'Alpha' : id.endsWith('beta') ? 'Beta' : 'SENTINEL_PLACE_NAME'}`, status])
  }
  await q(`INSERT INTO "PlaceSlug" (slug,"placeId") VALUES ('alpha-marsh',$1)`, [ALPHA])
  await q(`INSERT INTO "PrivateWorkspace" (id,name) VALUES ('ws_sentinel','SENTINEL_WORKSPACE_NAME')`)
  await q(`INSERT INTO "PlatformApiKey" (id,name,mode,"lookupId","secretHash") VALUES ('ak_sentinel','k','live','SENTINEL_LOOKUP','SENTINEL_SECRET_HASH')`)
  for (const v of VARIANTS) {
    const ev = `ev_${v.id}`
    const raw = `raw_${v.id}`
    if (v.evidence !== false) {
      const mode = v.mode ?? 'live'
      await q(`INSERT INTO "PlatformRawEvidence" (id,"apiKeyId",mode,"payloadFingerprint","rawBody","requestId") VALUES ($1,'ak_sentinel',$2,$5,$3::jsonb,$4)`,
        [raw, mode, j({ body: `SENTINEL_RAW_BODY_${v.id}` }), `req_${v.id}`, `SENTINEL_FINGERPRINT_${v.id}`])
      await q(`INSERT INTO "PlatformEvidence" (id,"apiKeyId",mode,"rawEvidenceId",provider,"sourceExternalId","evidenceType",publisher,"sourceUrl","retrievalTime","sourceData",provenance,"processingStatus","requestId","idempotencyKey")
        VALUES ($1,'ak_sentinel',$2,$3,'synthetic',$4,'t','Synthetic Publisher',$5,'2026-01-02T03:04:05Z',$6::jsonb,$7::jsonb,$8,$9,'SENTINEL_IDEMPOTENCY_' || $1)`,
        [ev, mode, raw, `SRC-${v.id.startsWith('mem_x') ? 'SENTINEL' : 'OK'}-${handleOf(v.id).slice(4, 12)}`, v.sourceUrl ?? 'https://example.org/source',
          j({ secret: 'SENTINEL_SOURCE_DATA' }), v.provenance === undefined ? j(CLEARED) : v.provenance === null ? null : j(v.provenance),
          v.processing ?? 'PROCESSED', `req_${v.id}`])
    }
    let eventId: string | null = null
    if (v.event) {
      eventId = `evt_${v.id}`
      await q(`INSERT INTO "ObservationEventRecord" (id,"canonicalEventId",method,"observedPrecision","observedBasis","receivedAt","coverageState","coverageNote",geometry,"sensitiveLocation","locationDisclosure")
        VALUES ($1,$1,'m','unknown','source',now(),'c','n',$2::jsonb,$3,$4)`,
        [eventId, j({ type: 'Point', coordinates: ['SENTINEL_GEOMETRY'] }), v.event.sensitive, v.event.disclosure])
    }
    const visibility = v.visibility ?? 'PUBLIC'
    await q(`INSERT INTO "PlaceMemoryItem" (id,"itemKey","placeId","platformEvidenceId","observationEventId","workspaceId",kind,"evidenceClass",visibility,"rightsState","originalStatement","sourceIndependenceKey","geographyPrecision","locationDisclosure",uncertainty,status)
      VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'SENTINEL_INDEPENDENCE_KEY',$11,$12,$13::jsonb,$14)`,
      [v.id, v.place ?? ALPHA, v.evidence === false ? null : ev, eventId, visibility === 'WORKSPACE_PRIVATE' ? 'ws_sentinel' : null,
        v.kind ?? 'OBSERVATION', v.evidenceClass ?? 'STRUCTURED_CITIZEN_OBSERVATION', visibility, v.rights ?? 'CLEARED_FOR_INGEST',
        v.statement ?? v.id, 'named site', v.disclosure ?? 'NAMED_ONLY', j(v.uncertainty ?? {}), v.status ?? 'ACTIVE'])
    if (v.evidence !== false && v.link !== false) {
      await q(`INSERT INTO "PlaceMemorySourceLink" ("itemId","platformEvidenceId",relationship,"sourceIndependenceKey") VALUES ($1,$2,'PRIMARY','SENTINEL_INDEPENDENCE_KEY')`, [v.id, ev])
    }
    const secret = v.id.startsWith('mem_x') || v.place === DRAFT
    await q(`INSERT INTO "PlaceMemorySearchDocument" ("itemId",content,"representationVersion") VALUES ($1,$2,'v1')`,
      [v.id, `${v.statement ?? v.id}\nheron wading bird${secret ? ` SENTINEL_SNIPPET_${v.id}` : ''}`])
    const entity = `ent_${v.id}`
    await q(`INSERT INTO "PlaceMemoryEntity" (id,kind,"canonicalLabel",authority,"externalId",metadata) VALUES ($1,'TAXON',$2,'SYNTH',$3,$4::jsonb)`,
      [entity, secret ? `SENTINEL_ENTITY_${v.id}` : 'Ardea cinerea', `T-${handleOf(v.id).slice(4, 12)}`, j({ private: 'SENTINEL_ENTITY_METADATA' })])
    await q(`INSERT INTO "PlaceMemoryTerm" (id,"entityId",term,normalized,language,"termType",status,provenance) VALUES ($1,$2,'Grey heron','grey heron','en','COMMON_NAME','CURATED',$3::jsonb)`,
      [`term_c_${v.id}`, entity, j({ note: 'SENTINEL_TERM_PROVENANCE' })])
    await q(`INSERT INTO "PlaceMemoryTerm" (id,"entityId",term,normalized,language,"termType",status) VALUES ($1,$2,'SENTINEL_MACHINE_TERM','sentinel machine term','en','COMMON_NAME','MACHINE_INTERPRETATION')`,
      [`term_m_${v.id}`, entity])
    await q(`INSERT INTO "PlaceMemoryItemEntity" ("itemId","entityId","relationType","assertionState","sourceAssertion",uncertainty) VALUES ($1,$2,$3,'SOURCE_ASSERTION',$4::jsonb,$5::jsonb)`,
      [v.id, entity, v.relation ?? 'SUBJECT', j({ raw: 'SENTINEL_SOURCE_ASSERTION' }), j({ note: 'SENTINEL_RELATION_UNCERTAINTY' })])
  }
  return { pg, db, log }
}

const INTERNAL_IDS = [
  ...VARIANTS.flatMap((v) => [v.id, `ev_${v.id}`, `raw_${v.id}`, `req_${v.id}`, `ent_${v.id}`, `evt_${v.id}`]),
  ALPHA, BETA, DRAFT, PRIVATE_ONLY, 'ws_sentinel', 'ak_sentinel',
]

function assertNoLeak(label: string, value: unknown) {
  const text = JSON.stringify(value) ?? ''
  assert.ok(!text.includes('SENTINEL'), `${label}: sentinel leaked: ${text.slice(text.indexOf('SENTINEL') - 60, text.indexOf('SENTINEL') + 60)}`)
  for (const id of INTERNAL_IDS) assert.ok(!text.includes(`"${id}"`) && !text.includes(`${id} `), `${label}: internal id ${id} leaked`)
  assert.ok(!/bv_place_|"(ev|raw|req|mem|ent|ws|ak)_/.test(text), `${label}: internal identifier shape leaked`)
}

test('public list returns only the gated items as allowlisted DTOs, with no sentinel or internal identifier', async () => {
  const h = await harness()
  try {
    const items = await listPublicPlaceMemory(h.db, ALPHA)
    assert.deepEqual(items.map((i) => i.handle).sort(), PUBLIC_ALPHA.map(handleOf).sort())
    assertNoLeak('list', items)
    const keys = Object.keys(items[0]).sort()
    assert.deepEqual(keys, ['evidenceClass', 'handle', 'interpretation', 'kind', 'location', 'relationships', 'source', 'statement', 'time', 'uncertainty'])
    assert.deepEqual(Object.keys(items[0].source).sort(), ['attribution', 'licence', 'observationPrecision', 'observedAt', 'publishedAt', 'publisher', 'retrievedAt', 'sourceIdentifier', 'url'])
    const obs = items.find((i) => i.handle === handleOf('mem_pub_alpha_obs'))!
    assert.deepEqual(obs.uncertainty, ['observation_time_unknown']) // unknown keys never published
    assert.equal(obs.source.licence, 'Open Licence 1.0')
    assert.equal(obs.source.url, 'https://example.org/source')
    assert.deepEqual(obs.time, { start: null, end: null, precision: 'unknown', basis: 'source', unknown: true })
    assert.equal(obs.source.publishedAt, null)
    assert.equal(obs.source.observedAt, null)
    assert.deepEqual(obs.location, { disclosure: 'GENERALISED', precision: 'named site' })
    assert.deepEqual(obs.relationships[0].otherNames, ['Grey heron']) // machine term excluded
    const place = await readPublicPlace(h.db, ALPHA)
    assert.deepEqual(place, { name: 'Name of Alpha', slug: 'alpha-marsh', publicItemCount: PUBLIC_ALPHA.length })
    assertNoLeak('place', place)
  } finally { await h.pg.close() }
})

test('sensitive, hidden and exact locations never yield spatial detail or geometry', async () => {
  const h = await harness()
  try {
    const items = await listPublicPlaceMemory(h.db, ALPHA)
    const by = (id: string) => items.find((i) => i.handle === handleOf(id))!
    assert.equal(by('mem_pub_alpha_sensitive').location, null)
    assert.equal(by('mem_pub_alpha_hidden').location, null)
    assert.equal(by('mem_pub_alpha_exact').location, null)
    assert.equal(by('mem_pub_alpha_exact').source.url, null) // non-http locator refused
    assert.ok(!JSON.stringify(items).includes('coordinates'))
  } finally { await h.pg.close() }
})

test('uniform not-found: missing, private, unpublished, cross-Place and malformed lookups are indistinguishable', async () => {
  const h = await harness()
  try {
    for (const id of VARIANTS.filter((v) => v.id.startsWith('mem_x') || v.place === DRAFT).map((v) => v.id)) {
      assert.equal(await readPublicMemoryItem(h.db, ALPHA, handleOf(id)), null, id)
      assert.equal(await readPublicMemoryItem(h.db, PRIVATE_ONLY, handleOf(id)), null, id)
    }
    assert.equal(await readPublicMemoryItem(h.db, ALPHA, handleOf('mem_pub_beta')), null) // cross-Place
    assert.ok(await readPublicMemoryItem(h.db, BETA, handleOf('mem_pub_beta')))
    for (const bad of ['', 'mem_pub_alpha_obs', handleOf('nope'), 'pmi_XYZ', `${handleOf('mem_pub_alpha_obs')} `]) {
      assert.equal(await readPublicMemoryItem(h.db, ALPHA, bad), null)
    }
    const empty = await searchPublicPlaceMemory(h.db, UNKNOWN, { q: 'heron' })
    for (const place of [DRAFT, PRIVATE_ONLY, UNKNOWN, 'not-a-place', 'bv_place_UPPER']) {
      assert.equal(await readPublicPlace(h.db, place), null, place)
      assert.deepEqual(await listPublicPlaceMemory(h.db, place), [], place)
      assert.deepEqual(await searchPublicPlaceMemory(h.db, place, { q: 'heron' }), empty, place)
      assert.equal(await buildPublicAnswerContext(h.db, place, 'heron'), null, place)
    }
    assert.deepEqual(empty, { results: [], resultCount: 0, facets: { evidenceClass: {} }, warning: null })
    // Query-shape errors are thrown before any data access, identically for every Place.
    for (const place of [ALPHA, PRIVATE_ONLY, UNKNOWN]) {
      await assert.rejects(searchPublicPlaceMemory(h.db, place, { q: 'x'.repeat(301) }), PublicReadInputError)
      await assert.rejects(searchPublicPlaceMemory(h.db, place, { evidenceClasses: ['SENTINEL'] }), PublicReadInputError)
    }
  } finally { await h.pg.close() }
})

test('search counts, facets and results come only from gated rows; every data query carries the public gate', async () => {
  const h = await harness()
  try {
    h.log.length = 0
    const lexical = await searchPublicPlaceMemory(h.db, ALPHA, { q: 'heron' })
    assert.equal(lexical.resultCount, PUBLIC_ALPHA.length) // every search document mentions heron; only gated rows count
    assert.deepEqual(lexical.facets.evidenceClass, { AUTHORITATIVE_STATUTORY: 1, PROFESSIONAL_OBSERVATION: 1, STRUCTURED_CITIZEN_OBSERVATION: 3 })
    assert.deepEqual(lexical.results.map((r) => r.handle).sort(), PUBLIC_ALPHA.map(handleOf).sort())
    assertNoLeak('lexical', lexical)
    for (const sentinelWord of ['SENTINEL_WORKSPACE', 'SENTINEL_SNIPPET_mem_x_restricted', 'SENTINEL_MACHINE_TERM', 'SENTINEL_ENTITY_mem_x_nolink']) {
      const r = await searchPublicPlaceMemory(h.db, ALPHA, { q: sentinelWord })
      assert.equal(r.resultCount, 0, sentinelWord) // private text cannot even be matched
      assertNoLeak(sentinelWord, r)
    }
    const itemQueries = h.log.filter((text) => text.includes('"PlaceMemoryItem"'))
    assert.ok(itemQueries.length >= 5)
    for (const text of itemQueries) assert.ok(text.includes(PUBLIC_ITEM_GATE), 'every item query applies the gate')
    for (const text of h.log) assert.ok(!/PlatformRawEvidence|PlatformApiKey|PrivateWorkspace|rawBody|secretHash|sourceData/.test(text))
  } finally { await h.pg.close() }
})

test('semantic re-ranking and answer context receive only gated public content, keyed by public handles', async () => {
  const h = await harness()
  try {
    const seen: Array<{ itemId: string; content: string }> = []
    const reranker = { rerank: async (_q: string, c: Array<{ itemId: string; content: string }>) => { seen.push(...c); return c.map((x) => x.itemId).reverse() } }
    const result = await searchPublicPlaceMemory(h.db, ALPHA, { q: 'wading birds' }, reranker)
    assert.deepEqual(seen.map((c) => c.itemId).sort(), PUBLIC_ALPHA.map(handleOf).sort())
    assertNoLeak('semantic candidates', seen)
    assertNoLeak('semantic result', result)
    const context = await buildPublicAnswerContext(h.db, ALPHA, 'Which herons are recorded?')
    assert.ok(context && context.passages.length >= 1)
    assertNoLeak('answer context', context)
    assert.equal(context!.placeName, 'Name of Alpha')
    const crossPlace = await buildPublicAnswerContext(h.db, BETA, 'heron')
    assert.deepEqual(crossPlace!.passages.map((p) => p.handle), [handleOf('mem_pub_beta')])
  } finally { await h.pg.close() }
})

test('designation features are framed as protection context, never current presence, abundance, trend or condition', async () => {
  const h = await harness()
  try {
    const item = await readPublicMemoryItem(h.db, ALPHA, handleOf('mem_pub_alpha_designation'))
    assert.ok(item)
    assert.equal(item.relationships[0].framing, 'designation_feature')
    assert.deepEqual(item.interpretation, {
      currentPresenceSupported: false, abundanceSupported: false, trendSupported: false, conditionSupported: false,
      note: DESIGNATION_FEATURE_NOTE,
    })
    const presence = await searchPublicPlaceMemory(h.db, ALPHA, { q: 'Is the heron still here today?' })
    assert.equal(presence.warning, CURRENT_PRESENCE_WARNING)
    const context = await buildPublicAnswerContext(h.db, ALPHA, 'How many herons are there now?')
    assert.equal(context!.currentPresenceQuestion, true)
    assert.ok(context!.cautions.includes(CURRENT_PRESENCE_WARNING))
    assert.ok(context!.cautions.includes(DESIGNATION_FEATURE_NOTE))
    assert.ok(context!.passages.some((p) => p.text.includes('Designation features (not current observations)')))
  } finally { await h.pg.close() }
})
