import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { Database, Sql } from '../lib/workspaces/service'
import { parseEvidenceCreate } from '../lib/v1/contract'
import { parseToken } from '../lib/v1/keys'
import { platformService } from '../lib/v1/service'
import { v1ServiceOptions } from '../lib/v1/processor'
import type { EvidencePublic } from '../lib/v1/service'
import {
  KERRY_001_EXTERNAL_ID,
  KERRY_PLACE_ID,
  NPWS_SPA_PAGE_URL,
} from '../lib/place-memory/kerry-001'
import {
  PRODUCTION_PLACE_MEMORY_PROJECTOR_IDS,
  PRODUCTION_PLACE_MEMORY_PROJECTORS,
} from '../lib/place-memory/production-registry'
import {
  createPlaceMemoryProjectorRegistry,
  registerPlaceMemoryProjector,
  type PlaceMemoryProjectorAdapter,
} from '../lib/place-memory/registry'
import { searchPlaceMemory } from '../lib/place-memory/retrieval'
import { tracePlaceMemoryProvenance } from '../lib/place-memory/provenance'
import { validateQrObservationDraft } from '../lib/place-memory/qr-contract'

// The exact proposed, never-submitted cargo is the test input. This prevents a
// reduced fixture from passing while the reviewed 742 KB source geometry fails.
const kerryCargoBytes = readFileSync(join(process.cwd(), 'docs/kerry-001.proposed.json'))
const kerryBody = JSON.parse(kerryCargoBytes.toString('utf8'))

type MemoryHarness = Awaited<ReturnType<typeof memoryHarness>>

async function memoryHarness() {
  const pg = new PGlite()
  for (const migration of [
    '0000_init', '20260909_private_workspace_foundation', '20260920_observation_revisions',
    '20261001_developer_platform_v1', '20261003_kerry_place_memory_v1',
  ]) await pg.exec(readFileSync(join(process.cwd(), 'prisma/migrations', migration, 'migration.sql'), 'utf8'))
  const sql = (client: Pick<PGlite, 'query'>): Sql => ({
    query: async <T>(text: string, values: unknown[]) => (await client.query<T>(text, values)).rows,
  })
  const db: Database = { ...sql(pg), transaction: (operation) => pg.transaction((tx) => operation(sql(tx))) }
  let counter = 0
  const service = platformService(db, {
    ...v1ServiceOptions(db),
    genId: (prefix) => `${prefix}_${String(++counter).padStart(32, '0')}`,
    now: () => new Date('2026-09-28T12:30:00.000Z'),
  })
  async function submit(mode: 'test' | 'live', idempotencyKey: string) {
    const key = await service.createKey({ name: `${mode}-kerry`, mode })
    const parsed = parseToken(key.token)!
    const apiKey = await service.findKeyByLookup(parsed.lookupId)
    assert.ok(apiKey)
    return service.createEvidence({
      apiKey, body: parseEvidenceCreate(kerryBody), rawBody: kerryBody,
      idempotencyKey, requestId: `req_${mode}_kerry_001`,
    })
  }
  return { pg, db, service, submit }
}

async function scalar(h: MemoryHarness, table: string) {
  assert.match(table, /^[A-Za-z]+$/)
  return Number((await h.db.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM "${table}"`, []))[0].count)
}

test('KERRY-001: live raw evidence projects one logical Place, independent source geometry and 23 qualifying interests', async () => {
  const h = await memoryHarness()
  try {
    assert.equal(createHash('sha256').update(kerryCargoBytes).digest('hex'), '3ed8d59ec262a13bf4d163f65d2194579cbd6354044afd9b95443616a444ccd6')
    const created = await h.submit('live', 'kerry-001-controlled')
    assert.equal(created.replayed, false)
    assert.equal(created.evidence.processing_status, 'PROCESSED')
    assert.equal(created.evidence.observation_time, null)
    assert.equal(created.evidence.publication_time, null)
    assert.equal(await scalar(h, 'PlatformRawEvidence'), 1)
    assert.equal(await scalar(h, 'PlatformEvidence'), 1)
    assert.equal(await scalar(h, 'PlaceSpatialVersion'), 1)
    assert.equal(await scalar(h, 'PlaceMemoryItem'), 1)
    assert.equal(await scalar(h, 'PlaceMemoryEntity'), 23)
    assert.equal(await scalar(h, 'PlaceMemoryItemEntity'), 23)
    assert.equal(await scalar(h, 'PlaceMemorySourceLink'), 1)
    assert.equal(await scalar(h, 'PlaceMemorySearchDocument'), 1)

    const [place] = await h.db.query<any>('SELECT id,slug,type,latitude,longitude FROM "Asset" WHERE id=$1', [KERRY_PLACE_ID])
    assert.deepEqual(place, { id: KERRY_PLACE_ID, slug: 'tralee-bay', type: 'living_place', latitude: null, longitude: null })
    const [area] = await h.db.query<any>('SELECT id,"officialIdentifier",geometry FROM "Area" WHERE id=$1', ['geo_npws_spa_004188'])
    assert.equal(area.officialIdentifier, '004188')
    assert.equal(area.geometry, null) // no synthetic master polygon
    const [version] = await h.db.query<any>('SELECT crs,"sourceScale",geometry,"contentHash" FROM "PlaceSpatialVersion"', [])
    assert.equal(version.crs, 'EPSG:2157')
    assert.equal(version.sourceScale, '1:5000')
    assert.deepEqual(version.geometry, kerryBody.geography.boundary_feature.geometry)
    assert.match(version.contentHash, /^[a-f0-9]{64}$/)
    const [item] = await h.db.query<any>('SELECT "eventStart","eventEnd","timePrecision",uncertainty FROM "PlaceMemoryItem"', [])
    assert.equal(item.eventStart, null)
    assert.equal(item.eventEnd, null)
    assert.equal(item.timePrecision, 'unknown')
    assert.equal(item.uncertainty.current_presence_not_established, true)

    const key = (await h.db.query<any>('SELECT * FROM "PlatformApiKey" WHERE mode=$1', ['live']))[0]
    const replay = await h.service.createEvidence({
      apiKey: key, body: parseEvidenceCreate(kerryBody), rawBody: kerryBody,
      idempotencyKey: 'kerry-001-controlled', requestId: 'req_replay',
    })
    assert.equal(replay.replayed, true)
    assert.equal(await scalar(h, 'PlatformRawEvidence'), 1)
    assert.equal(await scalar(h, 'PlaceMemoryItem'), 1)
  } finally { await h.pg.close() }
})

test('KERRY-001: test credentials preserve transport isolation and cannot populate public Place Memory', async () => {
  const h = await memoryHarness()
  try {
    const created = await h.submit('test', 'kerry-001-test-only')
    assert.equal(created.evidence.processing_status, 'PROCESSED')
    assert.equal(created.evidence.mode, 'test')
    assert.equal(await scalar(h, 'PlatformRawEvidence'), 1)
    assert.equal(await scalar(h, 'PlatformEvidence'), 1)
    assert.equal(await scalar(h, 'PlaceMemoryItem'), 0)
    assert.equal(await scalar(h, 'PlaceSpatialVersion'), 0)
  } finally { await h.pg.close() }
})

test('Kerry judgement set: five audiences retrieve designation evidence without converting it into current presence', async () => {
  const h = await memoryHarness()
  try {
    await h.submit('live', 'kerry-001-judgement')
    const questions = [
      ['scientific', 'What are the qualifying interests for SPA 004188?'],
      ['council', 'Which birds is Tralee Bay protected for?'],
      ['public', 'What important birds are associated with Tralee Bay?'],
      ['child', 'Are there black and white birds with orange beaks here?'],
      ['incorrect-assumption', 'Which of these birds can I definitely see here today?'],
    ] as const
    const results: Record<string, unknown> = {}
    for (const [audience, q] of questions) {
      const result = await searchPlaceMemory(h.db, { kind: 'public' }, { placeId: KERRY_PLACE_ID, q })
      assert.equal(result.hits.length, 1, `${audience} query should retrieve the designation`)
      assert.equal(result.hits[0].kind, 'DESIGNATION')
      assert.equal(result.hits[0].evidenceClass, 'AUTHORITATIVE_STATUTORY')
      assert.equal(result.hits[0].currentPresenceSupported, false)
      if (audience === 'child') {
        assert.ok(result.hits[0].entities.some((entity) => entity.externalId === 'A130'))
        assert.ok(result.hits[0].entities.some((entity) => entity.matchedTerms.includes('black and white bird with a long orange beak')))
        assert.equal(result.hits[0].matchType, 'concept')
      }
      if (audience === 'incorrect-assumption') {
        assert.match(result.warning ?? '', /not proof.*present|not proof.*today/i)
        assert.match(result.hits[0].matchReason, /cannot establish/)
      }
      results[audience] = {
        hits: result.hits.map((hit) => hit.id), matchType: result.hits[0].matchType,
        matchedEntities: result.hits[0].entities.map((entity) => entity.externalId), warning: result.warning,
      }
    }
    const deterministic = await searchPlaceMemory(h.db, { kind: 'public' }, {
      placeId: KERRY_PLACE_ID, sourceExternalId: KERRY_001_EXTERNAL_ID,
      evidenceClasses: ['AUTHORITATIVE_STATUTORY'], entityIds: ['entity_npws_spa_bird_a130'],
      publisher: 'National Parks and Wildlife Service',
    })
    assert.equal(deterministic.hits.length, 1)
    console.log('KERRY_JUDGEMENT_SET ' + JSON.stringify(results))
  } finally { await h.pg.close() }
})

test('public/private gate runs before lexical or semantic retrieval and cannot disclose private existence', async () => {
    const h = await memoryHarness()
  try {
    const created = await h.submit('live', 'kerry-001-security')
    const ev = created.evidence.id
    const testCreated = await h.submit('test', 'kerry-001-security-test-mode')
    await h.db.query('INSERT INTO "User" (id,email,role,"accessState","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP),($5,$6,$7,$8,CURRENT_TIMESTAMP),($9,$10,$11,$12,CURRENT_TIMESTAMP)',
      ['member', 'member@example.test', 'user', 'REGISTERED', 'outsider', 'outsider@example.test', 'user', 'REGISTERED', 'admin', 'admin@example.test', 'admin', 'ADMIN'])
    await h.db.query('INSERT INTO "PrivateWorkspace" (id,name) VALUES ($1,$2)', ['ws_private', 'Private place evidence'])
    await h.db.query('INSERT INTO "PrivateWorkspaceMember" ("workspaceId","userId",role) VALUES ($1,$2,$3)', ['ws_private', 'member', 'VIEWER'])
    const rows = [
      ['mem_11111111111111111111111111111111', 'private-only', 'WORKSPACE_PRIVATE', 'NOT_CLEARED', 'ws_private', 'private kingfisher survey secret', ev],
      ['mem_22222222222222222222222222222222', 'restricted-only', 'RESTRICTED', 'NOT_CLEARED', null, 'restricted curlew nest secret', ev],
      ['mem_33333333333333333333333333333333', 'test-mode-private', 'WORKSPACE_PRIVATE', 'CLEARED_FOR_INGEST', 'ws_private', 'test transport secret', testCreated.evidence.id],
    ] as const
    for (const [id, itemKey, visibility, rights, workspace, content, platformEvidenceId] of rows) {
      await h.db.query(
        `INSERT INTO "PlaceMemoryItem" (id,"itemKey","placeId","platformEvidenceId","workspaceId",kind,"evidenceClass",visibility,"rightsState","originalStatement","sourceIndependenceKey","timePrecision","locationDisclosure",uncertainty,status)
         VALUES ($1,$2,$3,$4,$5,'OBSERVATION','PROFESSIONAL_OBSERVATION',$6,$7,$8,$9,'unknown','HIDDEN','{}'::jsonb,'ACTIVE')`,
        [id, itemKey, KERRY_PLACE_ID, platformEvidenceId, workspace, visibility, rights, content, itemKey],
      )
      await h.db.query('INSERT INTO "PlaceMemorySearchDocument" ("itemId",content,"representationVersion") VALUES ($1,$2,$3)', [id, content, 'security-test'])
    }

    const publicLexical = await searchPlaceMemory(h.db, { kind: 'public' }, { placeId: KERRY_PLACE_ID, q: 'private kingfisher survey secret' })
    assert.equal(publicLexical.hits.length, 0)
    const outsider = await searchPlaceMemory(h.db, { kind: 'user', userId: 'outsider' }, { placeId: KERRY_PLACE_ID, q: 'private kingfisher survey secret' })
    assert.equal(outsider.hits.length, 0)
    const member = await searchPlaceMemory(h.db, { kind: 'user', userId: 'member' }, { placeId: KERRY_PLACE_ID, q: 'private kingfisher survey secret' })
    assert.deepEqual(member.hits.map((hit) => hit.id), [rows[0][0]])
    const normalRestricted = await searchPlaceMemory(h.db, { kind: 'user', userId: 'member' }, { placeId: KERRY_PLACE_ID, q: 'restricted curlew nest secret' })
    assert.equal(normalRestricted.hits.length, 0)
    const testModePrivate = await searchPlaceMemory(h.db, { kind: 'user', userId: 'member' }, { placeId: KERRY_PLACE_ID, q: 'test transport secret' })
    assert.equal(testModePrivate.hits.length, 0)
    const adminRestricted = await searchPlaceMemory(h.db, { kind: 'user', userId: 'admin' }, { placeId: KERRY_PLACE_ID, q: 'restricted curlew nest secret' })
    assert.deepEqual(adminRestricted.hits.map((hit) => hit.id), [rows[1][0]])

    let semanticInput = ''
    const semantic = await searchPlaceMemory(h.db, { kind: 'public' }, { placeId: KERRY_PLACE_ID, q: 'ecological evidence' }, {
      async rerank(_query, candidates) {
        semanticInput = candidates.map((candidate) => candidate.content).join('\n')
        return candidates.map((candidate) => candidate.itemId)
      },
    })
    assert.ok(semantic.hits.length >= 1)
    assert.doesNotMatch(semanticInput, /private kingfisher|restricted curlew/)
    assert.equal(await tracePlaceMemoryProvenance(h.db, { kind: 'public' }, rows[0][0]), null)
  } finally { await h.pg.close() }
})

test('provenance traverses memory → source relationship → evidence → raw → publisher without exposing raw body', async () => {
  const h = await memoryHarness()
  try {
    await h.submit('live', 'kerry-001-provenance')
    const [item] = await h.db.query<{ id: string }>('SELECT id FROM "PlaceMemoryItem"', [])
    const trace = await tracePlaceMemoryProvenance(h.db, { kind: 'public' }, item.id)
    assert.ok(trace)
    assert.equal(trace.placeId, KERRY_PLACE_ID)
    assert.equal(trace.entities.length, 23)
    assert.equal(trace.sources.length, 1)
    assert.equal(trace.sources[0].publisher, 'National Parks and Wildlife Service')
    assert.equal(trace.sources[0].sourceExternalId, KERRY_001_EXTERNAL_ID)
    assert.equal(trace.sources[0].sourceUrl, NPWS_SPA_PAGE_URL)
    assert.equal(trace.sources[0].licence, 'CC BY 4.0')
    assert.equal(trace.sources[0].rightsClass, 'CLEARED_FOR_INGEST')
    assert.match(trace.sources[0].rawFingerprint, /^[a-f0-9]{64}$/)
    assert.equal(JSON.stringify(trace).includes('rawBody'), false)
  } finally { await h.pg.close() }
})

test('QR readiness preserves original claim separately from interpretation and fails closed on sensitive location', () => {
  const draft = validateQrObservationDraft({
    placeId: KERRY_PLACE_ID, originalLanguage: 'en', originalText: 'Black and white bird near the shore',
    observedAt: '2026-09-28', observedPrecision: 'day',
    location: { geometry: null, crs: null, spatialUncertaintyMeters: null, precision: 'NAMED_SITE' },
    media: [{ reference: 'media://pending/1', sha256: 'a'.repeat(64), mimeType: 'image/jpeg' }],
    attribution: { state: 'ANONYMOUS', publicLabel: null },
    claimedObservation: { text: 'Black and white bird near the shore' },
    machineInterpretation: { model: 'isolated-test', version: '1', candidates: [{ taxon: 'Haematopus ostralegus', confidence: 0.4 }] },
    verificationState: 'UNREVIEWED', licence: null,
    consent: { venuePublication: false, widerReuse: false, recordedAt: '2026-09-28T12:00:00Z' },
    sensitiveLocation: true, locationDisclosure: 'HIDDEN',
  })
  assert.equal(draft.claimedObservation.text, draft.originalText)
  assert.notDeepEqual(draft.machineInterpretation, draft.claimedObservation)
  assert.equal(draft.verificationState, 'UNREVIEWED')
  assert.throws(() => validateQrObservationDraft({ ...draft, locationDisclosure: 'EXACT' }), /Sensitive location/)
  assert.throws(() => validateQrObservationDraft({ ...draft, observedAt: '2026-02-30' }), /calendar/)
  assert.throws(() => validateQrObservationDraft({ ...draft, claimedObservation: { text: 'Confirmed oystercatcher' } }), /verbatim/)
})

test('QR readiness migration enforces origin, attribution, media shape and sensitive-location constraints', async () => {
  const h = await memoryHarness()
  try {
    const insert = `INSERT INTO "ObservationEventRecord"
      (id,"canonicalEventId",method,"observedPrecision","observedBasis","receivedAt","coverageState","coverageNote",
       origin,"mediaReferences","observerAttributionState","sensitiveLocation","locationDisclosure")
      VALUES ($1,$2,'community_observation','unknown','reported',CURRENT_TIMESTAMP,'OBSERVED','bounded test',$3,$4::jsonb,$5,$6,$7)`
    await h.db.query(insert, ['qr_ok', 'qr:ok', 'QR', '[]', 'ANONYMOUS', true, 'HIDDEN'])
    await assert.rejects(h.db.query(insert, ['qr_bad_origin', 'qr:bad-origin', 'UNKNOWN', '[]', null, false, 'NAMED_ONLY']))
    await assert.rejects(h.db.query(insert, ['qr_bad_attribution', 'qr:bad-attribution', 'QR', '[]', 'PUBLIC_PROFILE', false, 'NAMED_ONLY']))
    await assert.rejects(h.db.query(insert, ['qr_bad_media', 'qr:bad-media', 'QR', '{}', null, false, 'NAMED_ONLY']))
    await assert.rejects(h.db.query(insert, ['qr_sensitive_exact', 'qr:sensitive-exact', 'QR', '[]', 'ANONYMOUS', true, 'EXACT']))
    assert.equal((await h.db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM "ObservationEventRecord"', []))[0].count, 1)
  } finally { await h.pg.close() }
})

test('frozen public V1 route surface remains exactly four routes and no Place Memory submission route exists', () => {
  const root = join(process.cwd(), 'app/api/v1')
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name).slice(root.length + 1)])
  assert.deepEqual(walk(root).sort(), ['evidence/[id]/route.ts', 'evidence/route.ts', 'health/route.ts', 'requests/[id]/route.ts'])
})

test('typed projector registry keeps production KERRY-only while a hypothetical adapter needs registration only', async () => {
  assert.deepEqual(PRODUCTION_PLACE_MEMORY_PROJECTOR_IDS, ['KERRY-001'])
  assert.equal(PRODUCTION_PLACE_MEMORY_PROJECTORS.length, 1)
  assert.doesNotMatch(readFileSync('lib/place-memory/registry.ts', 'utf8'), /KERRY|NPWS/)

  type HypotheticalRecord = Readonly<{ evidenceId: string; marker: 'HYPOTHETICAL-002' }>
  let projected: HypotheticalRecord | null = null
  const hypotheticalAdapter = {
    id: 'HYPOTHETICAL-002',
    adapt(evidence) {
      const metadata = evidence.metadata as { place_memory?: { train?: unknown } } | null
      return metadata?.place_memory?.train === 'HYPOTHETICAL-002'
        ? { evidenceId: evidence.id, marker: 'HYPOTHETICAL-002' as const }
        : null
    },
    async project(_db, record) {
      projected = record
      return { projected: true, projectorId: record.marker, evidenceId: record.evidenceId }
    },
  } satisfies PlaceMemoryProjectorAdapter<HypotheticalRecord>
  const hypothetical = registerPlaceMemoryProjector(hypotheticalAdapter)
  const unusedDb = {} as Database
  const evidence: EvidencePublic = {
    id: 'ev_hypothetical_002', object: 'evidence', mode: 'live', contract_version: 'v1',
    raw_evidence_id: 'raw_hypothetical_002', provider: 'hypothetical', source_external_id: 'record-002',
    evidence_type: 'bounded_test', publisher: 'Hypothetical Publisher', source_url: null, geography: null,
    observation_time: null, observation_precision: null, publication_time: null, retrieval_time: null,
    source_data: null, metadata: { place_memory: { train: 'HYPOTHETICAL-002' } }, provenance: null,
    processing_status: 'PROCESSING', request_id: 'req_hypothetical_002', created_at: '2026-09-28T12:00:00.000Z',
  }

  const production = createPlaceMemoryProjectorRegistry(unusedDb, PRODUCTION_PLACE_MEMORY_PROJECTORS)
  assert.deepEqual(await production(evidence), { projected: false, reason: 'unregistered' })

  const extended = createPlaceMemoryProjectorRegistry(unusedDb, [
    ...PRODUCTION_PLACE_MEMORY_PROJECTORS,
    hypothetical,
  ])
  assert.deepEqual(await extended(evidence), {
    projected: true, projectorId: 'HYPOTHETICAL-002', evidenceId: 'ev_hypothetical_002',
  })
  assert.deepEqual(projected, { evidenceId: 'ev_hypothetical_002', marker: 'HYPOTHETICAL-002' })
  assert.deepEqual(PRODUCTION_PLACE_MEMORY_PROJECTOR_IDS, ['KERRY-001'])
  assert.throws(
    () => createPlaceMemoryProjectorRegistry(unusedDb, [hypothetical, hypothetical]),
    /place_memory_registry_invalid:duplicate_id:HYPOTHETICAL-002/,
  )
})
