import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { Database, Sql } from '../lib/workspaces/service'
import { parseEvidenceCreate } from '../lib/v1/contract'
import { parseToken } from '../lib/v1/keys'
import { platformService } from '../lib/v1/service'
import { v1ServiceOptions } from '../lib/v1/processor'
import { KERRY_001_EXTERNAL_ID, KERRY_PLACE_ID, NPWS_SPA_PAGE_URL } from '../lib/place-memory/kerry-001'
import {
  CURRENT_PRESENCE_WARNING,
  DESIGNATION_FEATURE_NOTE,
  buildPublicAnswerContext,
  listPublicPlaceMemory,
  readPublicMemoryItem,
  readPublicPlace,
  searchPublicPlaceMemory,
} from '../lib/place/public-read'

// KERRY-001 acceptance for the public read model: the exact reviewed cargo is
// submitted through the real V1 service and projector into isolated PGlite.
const kerryBody = JSON.parse(readFileSync(join(process.cwd(), 'docs/kerry-001.proposed.json'), 'utf8'))

async function kerry(mode: 'live' | 'test') {
  const pg = new PGlite()
  for (const m of [
    '0000_init', '20260909_private_workspace_foundation', '20260920_observation_revisions',
    '20261001_developer_platform_v1', '20261003_kerry_place_memory_v1', '20261004_place_slug_history',
  ]) await pg.exec(readFileSync(join(process.cwd(), 'prisma/migrations', m, 'migration.sql'), 'utf8'))
  const sql = (client: Pick<PGlite, 'query'>): Sql => ({ query: async <T>(t: string, v: unknown[]) => (await client.query<T>(t, v)).rows })
  const db: Database = { ...sql(pg), transaction: (op) => pg.transaction((tx) => op(sql(tx))) }
  let n = 0
  const service = platformService(db, { ...v1ServiceOptions(db), genId: (p) => `${p}_${String(++n).padStart(32, '0')}`, now: () => new Date('2026-09-28T12:30:00.000Z') })
  const key = await service.createKey({ name: `kerry-${mode}`, mode })
  const apiKey = await service.findKeyByLookup(parseToken(key.token)!.lookupId)
  assert.ok(apiKey)
  const created = await service.createEvidence({ apiKey, body: parseEvidenceCreate(kerryBody), rawBody: kerryBody, idempotencyKey: `kerry-public-${mode}`, requestId: `req_${mode}` })
  return { pg, db, created }
}

function internalIds(value: unknown, evidenceId: string) {
  const text = JSON.stringify(value)
  assert.ok(!text.includes(KERRY_PLACE_ID), 'internal Place ID leaked')
  assert.ok(!text.includes(evidenceId), 'platform evidence id leaked')
  assert.ok(!/"(mem|raw|req|ev|spv|par|entity|term)_[a-z0-9_]+"/.test(text), 'internal identifier leaked')
  assert.ok(!/manifest_sha256|payloadFingerprint|rings|spatialReference|EPSG|boundary_feature|source_row/.test(text), 'private provenance or geometry leaked')
}

test('KERRY-001 public read: statutory designation, 23 qualifying interests, source/licence, no internal IDs', async () => {
  const h = await kerry('live')
  try {
    assert.equal(h.created.evidence.processing_status, 'PROCESSED')
    const place = await readPublicPlace(h.db, KERRY_PLACE_ID)
    assert.deepEqual(place, { name: kerryBody.metadata.place_memory.place_label, slug: null, publicItemCount: 1 })
    const [item] = await listPublicPlaceMemory(h.db, KERRY_PLACE_ID)
    assert.equal(item.kind, 'DESIGNATION')
    assert.equal(item.evidenceClass, 'AUTHORITATIVE_STATUTORY')
    assert.equal(item.statement, 'Tralee Bay Complex SPA')
    assert.equal(item.source.publisher, 'National Parks and Wildlife Service')
    assert.equal(item.source.sourceIdentifier, KERRY_001_EXTERNAL_ID)
    assert.equal(item.source.url, NPWS_SPA_PAGE_URL)
    assert.equal(item.source.licence, 'CC BY 4.0')
    assert.equal(item.source.attribution, kerryBody.provenance.attribution)
    assert.equal(item.source.retrievedAt, new Date(kerryBody.retrieval_time).toISOString())
    assert.equal(item.source.publishedAt, null) // unknown dates preserved, not invented
    assert.equal(item.source.observedAt, null)
    assert.equal(item.time.unknown, true)
    assert.deepEqual(item.location, { disclosure: 'NAMED_ONLY', precision: item.location!.precision })
    assert.ok(item.uncertainty.includes('current_presence_not_established'))
    assert.ok(item.uncertainty.includes('designation_not_observation'))

    assert.equal(item.relationships.length, 23)
    assert.ok(item.relationships.every((r) => r.relationType === 'QUALIFYING_INTEREST' && r.framing === 'designation_feature'))
    const oystercatcher = item.relationships.find((r) => r.sourceIdentifier === 'A130')!
    assert.equal(oystercatcher.label, 'Haematopus ostralegus')
    assert.ok(oystercatcher.otherNames.includes('Oystercatcher'))
    assert.ok(item.relationships.some((r) => r.sourceIdentifier === 'IE0004188' && r.kind === 'ECOLOGICAL_FEATURE'))
    assert.deepEqual(item.interpretation, { currentPresenceSupported: false, abundanceSupported: false, trendSupported: false, conditionSupported: false, note: DESIGNATION_FEATURE_NOTE })
    internalIds({ place, item }, h.created.evidence.id)

    assert.deepEqual(await readPublicMemoryItem(h.db, KERRY_PLACE_ID, item.handle), item)
  } finally { await h.pg.close() }
})

test('KERRY-001 current-presence trap: designation answers protection questions, never present-day presence', async () => {
  const h = await kerry('live')
  try {
    const protectedQ = await searchPublicPlaceMemory(h.db, KERRY_PLACE_ID, { q: 'oystercatcher' })
    assert.equal(protectedQ.resultCount, 1)
    assert.equal(protectedQ.warning, null)
    const presence = await searchPublicPlaceMemory(h.db, KERRY_PLACE_ID, { q: 'Will I definitely see oystercatchers here today?' })
    assert.equal(presence.warning, CURRENT_PRESENCE_WARNING)
    assert.ok(presence.results.every((r) => r.interpretation.currentPresenceSupported === false))
    const context = await buildPublicAnswerContext(h.db, KERRY_PLACE_ID, 'Are Brent geese present now?')
    assert.ok(context)
    assert.equal(context.currentPresenceQuestion, true)
    assert.ok(context.cautions.includes(DESIGNATION_FEATURE_NOTE))
    assert.ok(context.passages[0].text.includes('Designation features (not current observations)'))
    assert.ok(!/\b(is present|are present|currently present|abundant|population (is|trend))\b/i.test(context.passages.map((p) => p.text).join('\n')))
    internalIds({ protectedQ, presence, context }, h.created.evidence.id)
  } finally { await h.pg.close() }
})

test('KERRY-001 test-mode transport never reaches the public read model', async () => {
  const h = await kerry('test')
  try {
    assert.equal(await readPublicPlace(h.db, KERRY_PLACE_ID), null)
    assert.deepEqual(await listPublicPlaceMemory(h.db, KERRY_PLACE_ID), [])
    assert.equal((await searchPublicPlaceMemory(h.db, KERRY_PLACE_ID, { q: 'oystercatcher' })).resultCount, 0)
  } finally { await h.pg.close() }
})
