import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlaceShell } from '../components/place/place-shell'
import { PGlite } from '@electric-sql/pglite'
import type { Database, Sql } from '../lib/workspaces/service'
import { placeManifestFor } from '../data/places'
import { instantiateManifestPlace } from '../lib/place-memory/instantiate-manifest'
import { placePresentation } from '../lib/place-memory/place-presentation'
import { listPublicPlaceMemory, readPublicPlace, searchPublicPlaceMemory } from '../lib/place/public-read'
import { loadPlaceShell } from '../lib/place/shell-loader'
import { searchPlaceView } from '../lib/place/shell-view'
import { resolveObservationPlace } from '../lib/place/participation'
import { observationInput, observationService, STATUS } from '../lib/listens/observations.mjs'
import { prepareMedia } from '../lib/listens/observation-media'

// PILOT-001 NE demo, CRITICAL acceptance test: the Natural England demo moment.
// BEFORE: the public Place shows Species 7. A participant saves a bird photo and a
// bird sound. AFTER: Species is still 7, the public record, search, chronology and
// PlatformEvidence are unchanged, and the participant's private history holds the
// new "Participant observation · Unverified" records, visible to nobody else.
const ID = 'bv_place_gb_ni_down_strangford_lough'
const SLUG = 'strangford-lough'
const MIGRATIONS = [
  '0000_init', '20260909_private_workspace_foundation', '20260920_observation_revisions',
  '20261001_developer_platform_v1', '20261003_kerry_place_memory_v1', '20261004_place_slug_history',
  '20261005_listening_pilot', '20261006_pilot_001_place_link', '20261007_participant_observation',
]
const MARKER = 'Sandwich tern calling over the narrows zq7'

async function harness() {
  const pg = new PGlite()
  for (const m of MIGRATIONS) await pg.exec(readFileSync(join(process.cwd(), 'prisma/migrations', m, 'migration.sql'), 'utf8'))
  const sql = (c: Pick<PGlite, 'query'>): Sql => ({ query: async <T>(t: string, v: unknown[]) => (await c.query<T>(t, v)).rows })
  const db: Database = { ...sql(pg), transaction: (op) => pg.transaction((tx) => op(sql(tx))) }
  let n = 0
  const service = { genId: (p: string) => `${p}_${String(++n).padStart(32, '0')}`, now: () => new Date('2026-09-30T16:00:00.000Z') }
  await instantiateManifestPlace(db, placeManifestFor(ID)!, { enableListening: true, service })
  // Same statement as scripts/place-instantiate.ts --enable-observation.
  await db.query('INSERT INTO "PlaceParticipation" ("placeId","observationEnabledAt","mapCentreLat","mapCentreLng") VALUES ($1,now(),$2::float8,$3::float8) ON CONFLICT ("placeId") DO UPDATE SET "observationEnabledAt"=COALESCE("PlaceParticipation"."observationEnabledAt",now()),"mapCentreLat"=$2::float8,"mapCentreLng"=$3::float8,"updatedAt"=now()', [ID, 54.47, -5.6])
  return { pg, db }
}

async function user(db: Sql, label: string) {
  const id = `pobs-${label}-${randomUUID()}`
  await db.query('INSERT INTO "User" (id,email,"emailVerified","updatedAt") VALUES ($1,$2,now(),now())', [id, `${id}@example.test`])
  return id
}

function wav(): Buffer {
  const samples = Buffer.alloc(800)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + samples.length, 4); h.write('WAVE', 8); h.write('fmt ', 12)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(8000, 24)
  h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(samples.length, 40)
  return Buffer.concat([h, samples])
}

/** Everything the public can see or that could count as institutional evidence. */
async function publicSnapshot(db: Sql) {
  const shell = await loadPlaceShell(db, SLUG, placePresentation)
  assert.equal(shell.outcome, 'ok')
  const view = (shell as Extract<typeof shell, { outcome: 'ok' }>).view
  const tables = ['PlatformEvidence', 'PlatformRawEvidence', 'PlaceMemoryItem', 'PlaceMemorySourceLink', 'PlaceMemoryEntity', 'PlaceMemoryItemEntity', 'PlaceMemoryRelation', 'PlaceMemorySearchDocument', 'PlaceMemoryTerm', 'Asset']
  const counts: Record<string, number> = {}
  for (const t of tables) counts[t] = (await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "${t}"`, []))[0].n
  const searches: Record<string, unknown> = {}
  for (const q of ['bird', 'tern', 'Sandwich tern', 'zq7', 'narrows']) {
    searches[`view:${q}`] = searchPlaceView(view, q)
    searches[`memory:${q}`] = await searchPublicPlaceMemory(db, ID, { q })
  }
  return {
    categories: view.categories.map((c) => [c.id, c.count, c.status]),
    species: view.species.map((s) => JSON.stringify(s)),
    timeline: JSON.stringify(view.timeline),
    publicItemCount: view.publicItemCount,
    place: await readPublicPlace(db, ID),
    items: JSON.stringify(await listPublicPlaceMemory(db, ID)),
    counts,
    searches: JSON.stringify(searches),
  }
}

test('NE demo moment: a participant bird photo and sound never change the public Place, search, chronology or PlatformEvidence', async () => {
  const { pg, db } = await harness()
  try {
    const before = await publicSnapshot(db)
    const species = before.categories.find((c) => c[0] === 'species')!
    assert.equal(species[1], 7, 'BEFORE: Species 7')

    const resolved = await resolveObservationPlace(db, SLUG)
    assert.equal(resolved.outcome, 'ok')
    const place = (resolved as Extract<typeof resolved, { outcome: 'ok' }>).place
    assert.equal(place.placeId, ID)
    const participant = await user(db, 'ne')
    const svc = observationService(db, participant)
    const now = new Date()
    const base = { category: 'ANIMAL', observedAt: now.toISOString(), observedAtProvenance: 'DEVICE_NOW', participantIdentification: MARKER, participantConfidence: 'FAIRLY_SURE', adult: true }

    const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 30, g: 90, b: 120 } } }).jpeg().withExif({ IFD0: { Artist: 'participant-private-exif' } }).toBuffer()
    assert.ok(jpeg.includes(Buffer.from('participant-private-exif')), 'fixture carries EXIF')
    const photo = await prepareMedia('PHOTO', jpeg)
    assert.ok(!photo.display!.includes(Buffer.from('participant-private-exif')), 'display copy is metadata-stripped')
    const p = observationInput({ ...base, id: randomUUID(), kind: 'PHOTO', note: `Photo: ${MARKER}`, locationMethod: 'DEVICE', lat: 54.4712345, lng: -5.6012345, accuracyM: 8, locationSharing: 'EXACT' }, now)
    assert.deepEqual(await svc.save({ placeId: place.placeId, placeName: place.name, input: p, media: photo }), { id: p.id, replayed: false })

    const sound = await prepareMedia('SOUND', wav())
    const s = observationInput({ ...base, id: randomUUID(), kind: 'SOUND', note: `Sound: ${MARKER}`, durationMs: 12000, locationMethod: 'MAP_APPROXIMATE', lat: 54.47, lng: -5.6, locationSharing: 'APPROXIMATE' }, now)
    assert.deepEqual(await svc.save({ placeId: place.placeId, placeName: place.name, input: s, media: sound }), { id: s.id, replayed: false })

    const after = await publicSnapshot(db)
    assert.deepEqual(after, before, 'AFTER: the public record is byte-for-byte unchanged')
    assert.equal(after.categories.find((c) => c[0] === 'species')![1], 7, 'AFTER: Species remains 7')
    for (const text of [after.items, after.timeline, after.searches, after.species.join()]) {
      // Search queries are echoed back, so look for the unqueried part of the participant's words.
      assert.ok(!text.includes('calling over') && !text.includes(participant), 'participant text never reaches public reads')
    }

    const mine = await svc.listForPlace(ID)
    assert.equal(mine.length, 2)
    assert.deepEqual(mine.map((o: { status: string }) => o.status), [STATUS, STATUS])
    assert.deepEqual(new Set(mine.map((o: { kind: string }) => o.kind)), new Set(['PHOTO', 'SOUND']))
    const snd = mine.find((o: { kind: string }) => o.kind === 'SOUND')
    assert.equal(snd.durationMs, 12000); assert.equal(snd.locationSharing, 'APPROXIMATE'); assert.equal(snd.mediaType, 'SOUND')
    const pht = mine.find((o: { kind: string }) => o.kind === 'PHOTO')
    assert.equal(pht.capturedLat, 54.4712345, 'captured precision kept privately'); assert.equal(pht.capturedAccuracyM, 8)
    assert.ok(new Date(pht.receivedAt).getTime() >= new Date(pht.observedAt).getTime() - 1000, 'received time recorded separately')
    const [counted] = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM "PlatformEvidence" e WHERE row_to_json(e)::text LIKE $1', ['%zq7%'])
    assert.equal(counted.n, 0)

    const other = observationService(db, await user(db, 'other'))
    assert.deepEqual(await other.listForPlace(ID), [], 'no cross-user leakage')
    await assert.rejects(other.media(p.id, 'display'), (e: { status: number }) => e.status === 404)
    await assert.rejects(other.remove(p.id), (e: { status: number }) => e.status === 404)
    const own = await svc.media(p.id, 'original')
    assert.ok(Buffer.from(own.bytes).equals(jpeg), 'original kept byte-for-byte for its owner')
  } finally { await pg.close() }
})

test('Place page: the notice invitation replaces the inert + only when observation is enabled for that Place', async () => {
  const { pg, db } = await harness()
  try {
    const shell = await loadPlaceShell(db, SLUG, placePresentation)
    const view = (shell as Extract<typeof shell, { outcome: 'ok' }>).view
    const nav = (html: string) => html.match(/<nav aria-label="Place navigation"[\s\S]*?<\/nav>/)![0]
    const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const off = renderToStaticMarkup(createElement(PlaceShell, { view }))
    assert.ok(/data-place-contribute="inert"/.test(nav(off)) && text(off).includes('Not open yet'))
    assert.ok(!off.includes('data-contribute="notice"') && !off.includes('/notice'))
    const on = renderToStaticMarkup(createElement(PlaceShell, { view, notice: { href: `/place/${SLUG}/notice` } }))
    assert.ok(/<a[^>]*href="\/place\/strangford-lough\/notice"[^>]*data-place-contribute="notice"|<a[^>]*data-place-contribute="notice"[^>]*href="\/place\/strangford-lough\/notice"/.test(nav(on)), 'mobile + links to the notice flow')
    assert.ok(!/data-place-contribute="inert"/.test(on))
    const card = on.match(/<article[^>]*data-contribute="notice"[\s\S]*?<\/article>/)![0]
    for (const s of ['Notice this place', 'What have you seen, heard or noticed?', 'Make an observation']) assert.ok(text(card).includes(s), s)
    assert.ok(/Unverified/i.test(text(card)))
    // Counts shown on the page are identical with and without the invitation.
    const counts = (html: string) => [...html.matchAll(/data-category="([a-z]+)"[\s\S]*?(\d+)/g)].map((m) => `${m[1]}:${m[2]}`).join()
    assert.equal(counts(on), counts(off))
  } finally { await pg.close() }
})

test('no participant-observation table is read by any public Place read module', () => {
  const dirs = ['lib/place', 'lib/place-memory', 'components/place', 'app/place/[slug]/page.tsx', 'app/p']
  const files: string[] = []
  const walk = (p: string) => {
    const full = join(process.cwd(), p)
    try { for (const e of readdirSync(full, { withFileTypes: true })) walk(join(p, e.name)) } catch { if (/\.(ts|tsx|mjs)$/.test(p)) files.push(p) }
  }
  dirs.forEach(walk)
  assert.ok(files.length > 10)
  for (const f of files) assert.ok(!/ParticipantObservation/.test(readFileSync(join(process.cwd(), f), 'utf8')), `${f} must not read participant observations`)
})
