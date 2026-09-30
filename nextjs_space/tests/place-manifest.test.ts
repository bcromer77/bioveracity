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
import { PLACE_MANIFESTS, placeManifestFor } from '../data/places'
import { validatePlaceManifest } from '../lib/place-memory/place-manifest'
import { parseManifestPlaceEvidence } from '../lib/place-memory/manifest-place'
import { instantiateManifestPlace } from '../lib/place-memory/instantiate-manifest'
import { placePresentation } from '../lib/place-memory/place-presentation'
import { listPublicPlaceMemory, readPublicPlace, searchPublicPlaceMemory } from '../lib/place/public-read'
import { resolveListeningPlace, placeListenPath } from '../lib/place/participation'
import { assignCanonicalPlaceSlug } from '../lib/place/slugs'
import { KERRY_PLACE_ID } from '../lib/place-memory/kerry-001'

// PILOT-001: a Place instantiated purely from its reviewed manifest, through the
// real V1 evidence service and projector registry, into isolated PGlite.
const ID = 'bv_place_gb_ni_down_strangford_lough'
const raw = JSON.parse(readFileSync(join(process.cwd(), 'data/places/strangford-lough.manifest.json'), 'utf8'))
const manifest = placeManifestFor(ID)!
const STATEMENTS = [
  'Strangford Lough Special Area of Conservation (SAC)',
  'Strangford Lough Special Protection Area (SPA)',
  'Strangford Lough on the east coast of Northern Ireland is an outstanding example of a large, enclosed fjardic sea lough.',
  'Strangford Lough is a large (150 km2) marine inlet on the east coast of County Down, of which about 50 km2 lies between high water mark mean tide (HWMMT) and low water mark mean tide (LWMMT).',
  'The Lough supports an impressive range of marine habitats and communities with over 2,000 recorded species. It is important for marine invertebrates, algae and saltmarsh plants, for wintering and breeding wetland birds, and for marine mammals.',
]
const URLS = new Set([
  'https://sac.jncc.gov.uk/site/UK0016618',
  'https://jncc.gov.uk/jncc-assets/SPA-N2K/UK9020111.pdf',
  'https://www.daera-ni.gov.uk/protected-areas/strangford-lough-sac',
])

async function harness() {
  const pg = new PGlite()
  for (const m of [
    '0000_init', '20260909_private_workspace_foundation', '20260920_observation_revisions',
    '20261001_developer_platform_v1', '20261003_kerry_place_memory_v1', '20261004_place_slug_history',
    '20261005_listening_pilot', '20261006_pilot_001_place_link',
  ]) await pg.exec(readFileSync(join(process.cwd(), 'prisma/migrations', m, 'migration.sql'), 'utf8'))
  const sql = (c: Pick<PGlite, 'query'>): Sql => ({ query: async <T>(t: string, v: unknown[]) => (await c.query<T>(t, v)).rows })
  const db: Database = { ...sql(pg), transaction: (op) => pg.transaction((tx) => op(sql(tx))) }
  let n = 0
  const service = { genId: (p: string) => `${p}_${String(++n).padStart(32, '0')}`, now: () => new Date('2026-09-30T16:00:00.000Z') }
  return { pg, db, service }
}

test('manifest registry: exactly one reviewed Place; strict validation rejects weakened evidence', () => {
  assert.deepEqual(PLACE_MANIFESTS.map((m) => [m.place.id, m.place.slug]), [[ID, 'strangford-lough']])
  assert.equal(manifest.sources.length, 3)
  assert.ok(manifest.sources.every((s) => s.licence === 'Open Government Licence v3.0' && URLS.has(s.url)))
  assert.deepEqual(manifest.items.map((i) => i.statement), STATEMENTS)
  const bad = (mut: (m: any) => void, re: RegExp) => { const m = structuredClone(raw); mut(m); assert.throws(() => validatePlaceManifest(m), re) }
  bad((m) => { m.items[2].uncertainty = [] }, /observation_time_unknown/)
  bad((m) => { m.items[0].uncertainty = ['observation_time_unknown'] }, /uncertainty.designation/)
  bad((m) => { m.sources[0].url = 'http://sac.jncc.gov.uk/site/UK0016618' }, /sources.0.url/)
  bad((m) => { m.items[2].source_ref = 'unknown_source' }, /source_ref/)
  bad((m) => { m.items[2].entities = m.items[0].entities }, /designation_only/)
  bad((m) => { m.sources[1].ref = m.sources[0].ref }, /ref_unique/)
  bad((m) => { m.place.id = 'strangford' }, /place.id/)
  bad((m) => { m.sources[0].sha256 = 'abc' }, /sha256/)
  assert.equal(placePresentation(ID)?.displayTitle ?? placePresentation(ID) ? true : false, true)
})

test('instantiation from data: 5 items public, exact statements, source URLs, OGL, no invented time, designation not presence', async () => {
  const h = await harness()
  try {
    const out = await instantiateManifestPlace(h.db, manifest, { enableListening: true, service: h.service })
    assert.deepEqual(out.results.map((r) => r.status), Array(5).fill('PROCESSED'))
    assert.deepEqual(await readPublicPlace(h.db, ID), { name: 'Strangford Lough', slug: 'strangford-lough', publicItemCount: 5 })
    const items = await listPublicPlaceMemory(h.db, ID)
    assert.deepEqual(items.map((i) => i.statement).sort(), [...STATEMENTS].sort())
    for (const i of items) {
      assert.ok(URLS.has(i.source.url!), i.source.url!)
      assert.equal(i.source.licence, 'Open Government Licence v3.0')
      assert.equal(i.source.observedAt, null)
      assert.equal(i.source.publishedAt, null)
      assert.equal(i.time.unknown, true)
      assert.equal(i.interpretation.currentPresenceSupported, false)
      assert.equal(i.interpretation.abundanceSupported, false)
      assert.equal(i.interpretation.trendSupported, false)
      assert.equal(i.interpretation.conditionSupported, false)
    }
    const sac = items.find((i) => i.statement.includes('(SAC)'))!
    const spa = items.find((i) => i.statement.includes('(SPA)'))!
    assert.deepEqual(sac.relationships.map((r) => r.sourceIdentifier).sort(), ['1140', '1150', '1160', '1170', '1365'])
    assert.deepEqual(spa.relationships.map((r) => r.sourceIdentifier).sort(), ['A143', 'A162', 'A191', 'A193', 'A194', 'A674', 'WATR'])
    assert.ok([...sac.relationships, ...spa.relationships].every((r) => r.framing === 'designation_feature'))
    const text = JSON.stringify(items)
    assert.ok(!text.includes(ID) && !/manifest_sha256/.test(text), 'internal identifiers leaked')
    // idempotent re-instantiation creates nothing new
    const again = await instantiateManifestPlace(h.db, manifest, { enableListening: true, service: h.service })
    assert.equal(again.results.length, 5)
    assert.equal((await readPublicPlace(h.db, ID))!.publicItemCount, 5)
    const [ev] = await h.db.query<{ n: number; k: number }>('SELECT COUNT(*)::int AS n, COUNT(DISTINCT "apiKeyId")::int AS k FROM "PlatformEvidence"', [])
    assert.deepEqual(ev, { n: 5, k: 1 }, 're-instantiation must not duplicate evidence or keys')
  } finally { await h.pg.close() }
})

test('evidence isolation: Strangford and Kerry never share items; private listening data never reaches public reads', async () => {
  const h = await harness()
  try {
    await instantiateManifestPlace(h.db, manifest, { enableListening: true, service: h.service })
    const kerryBody = JSON.parse(readFileSync(join(process.cwd(), 'docs/kerry-001.proposed.json'), 'utf8'))
    const svc = platformService(h.db, { ...v1ServiceOptions(h.db), ...h.service })
    const key = await svc.createKey({ name: 'kerry', mode: 'live' })
    const apiKey = (await svc.findKeyByLookup(parseToken(key.token)!.lookupId))!
    await svc.createEvidence({ apiKey, body: parseEvidenceCreate(kerryBody), rawBody: kerryBody, idempotencyKey: 'k', requestId: 'r' })
    const s = JSON.stringify(await listPublicPlaceMemory(h.db, ID))
    const k = JSON.stringify(await listPublicPlaceMemory(h.db, KERRY_PLACE_ID))
    assert.ok(!/Tralee|NPWS/i.test(s)); assert.ok(!/Strangford|JNCC|DAERA/i.test(k))

    await h.pg.exec(`INSERT INTO "User" (id,email,"updatedAt") VALUES ('u1','u1@example.test',now());
      INSERT INTO "ListeningPlot" (id,"ownerId",name,county,"placeId","payloadHash") VALUES ('p1','u1','Strangford Lough',NULL,'${ID}','h');
      INSERT INTO "ListeningVisit" (id,"plotId","observedAt",payload,"payloadHash") VALUES ('v1','p1',now(),'{"heard":["PRIVATE-OBS-MARKER"],"notHeard":["curlew"]}','x');`)
    const after = JSON.stringify([await readPublicPlace(h.db, ID), await listPublicPlaceMemory(h.db, ID),
      await searchPublicPlaceMemory(h.db, ID, { q: 'PRIVATE-OBS-MARKER' }), await searchPublicPlaceMemory(h.db, ID, { q: 'curlew' })])
    assert.ok(!after.includes('PRIVATE-OBS-MARKER') && !after.includes('Participant observation'))
    assert.equal((await readPublicPlace(h.db, ID))!.publicItemCount, 5)
    // RESTRICT: a Place with listening history cannot be deleted out from under it
    // (isolated on a bare Asset so no Place Memory FK can be what rejects the delete)
    await h.pg.exec(`INSERT INTO "Asset" (id,slug,name,type,subtype,region,"regionSlug",status,summary,jurisdiction,"updatedAt")
      VALUES ('bv_place_restrict_probe','restrict-probe','Probe','living_place','evidence_memory','R','r','active','s','GB',now());
      INSERT INTO "ListeningPlot" (id,"ownerId",name,county,"placeId","payloadHash") VALUES ('p2','u1','Probe',NULL,'bv_place_restrict_probe','h');`)
    await assert.rejects(h.db.query('DELETE FROM "Asset" WHERE id=$1', ['bv_place_restrict_probe']), /ListeningPlot_placeId_fkey/)
    await h.db.query('DELETE FROM "ListeningPlot" WHERE id=$1', ['p2'])
    await h.db.query('DELETE FROM "Asset" WHERE id=$1', ['bv_place_restrict_probe'])
    // one history per owner per Place
    await assert.rejects(h.db.query(`INSERT INTO "ListeningPlot" (id,"ownerId",name,county,"placeId","payloadHash") VALUES ('p3','u1','dup',NULL,$1,'h')`, [ID]), /ListeningPlot_ownerId_placeId_key/)
    await assert.rejects(h.db.query(`INSERT INTO "ListeningPlot" (id,"ownerId",name,county,"placeId","payloadHash") VALUES ('p4','u1','neither',NULL,NULL,'h')`, []), /ListeningPlot_scope_check/)
  } finally { await h.pg.close() }
})

test('test-mode instantiation never reaches the public read model; tampered evidence is rejected', async () => {
  const h = await harness()
  try {
    const out = await instantiateManifestPlace(h.db, manifest, { mode: 'test', service: h.service })
    assert.equal(out.slug, null)
    assert.equal(await readPublicPlace(h.db, ID), null)
    assert.deepEqual(await listPublicPlaceMemory(h.db, ID), [])
    const rows = await h.db.query<{ id: string; apiKeyId: string; mode: string }>(`SELECT id,"apiKeyId",mode FROM "PlatformEvidence" ORDER BY id`, [])
    assert.equal(rows.length, 5)
    assert.ok(rows.every((r) => r.mode === 'test'))
    const svc = platformService(h.db, { ...v1ServiceOptions(h.db), ...h.service })
    const base = await svc.getEvidence({ id: rows[0].apiKeyId, mode: rows[0].mode } as any, rows[0].id)
    assert.ok(base && base.metadata, 'stored evidence must be readable for tamper checks')
    assert.ok(parseManifestPlaceEvidence(base))
    assert.throws(() => parseManifestPlaceEvidence({ ...base, source_data: { ...(base.source_data as any), statement: 'Seals are abundant here.' } }), /statement/)
    assert.throws(() => parseManifestPlaceEvidence({ ...base, observation_time: '2026-01-01T00:00:00Z' }), /invented_time/)
    assert.throws(() => parseManifestPlaceEvidence({ ...base, source_url: 'https://example.com/' }), /source_url/)
    assert.throws(() => parseManifestPlaceEvidence({ ...base, provenance: { ...(base.provenance as any), licence: 'CC-BY-4.0' } }), /rights/)
  } finally { await h.pg.close() }
})

test('participation: server resolves slug to immutable Place ID; disabled, unknown and retired slugs are safe', async () => {
  const h = await harness()
  try {
    await instantiateManifestPlace(h.db, manifest, { service: h.service })
    assert.deepEqual(await resolveListeningPlace(h.db, 'strangford-lough'), { outcome: 'not_found' })
    await h.db.query(`INSERT INTO "PlaceParticipation" ("placeId","listeningEnabledAt") VALUES ($1,now())`, [ID])
    const ok = await resolveListeningPlace(h.db, 'strangford-lough') as any
    assert.equal(ok.outcome, 'ok'); assert.equal(ok.place.placeId, ID); assert.equal(ok.place.slug, 'strangford-lough')
    for (const bad of ['unknown-place', ID, '../strangford-lough', 'STRANGFORD-LOUGH', '', null, 42]) {
      assert.equal((await resolveListeningPlace(h.db, bad)).outcome, 'not_found', String(bad))
    }
    await assignCanonicalPlaceSlug(h.db, ID, 'strangford-lough-renamed')
    const moved = await resolveListeningPlace(h.db, 'strangford-lough') as any
    assert.equal(moved.outcome, 'redirect'); assert.equal(moved.location, placeListenPath('strangford-lough-renamed')); assert.equal(moved.place.placeId, ID)
    const current = await resolveListeningPlace(h.db, 'strangford-lough-renamed') as any
    assert.equal(current.place.placeId, ID)
    await h.db.query(`UPDATE "PlaceParticipation" SET "listeningEnabledAt"=NULL WHERE "placeId"=$1`, [ID])
    assert.equal((await resolveListeningPlace(h.db, 'strangford-lough-renamed')).outcome, 'not_found')
  } finally { await h.pg.close() }
})
