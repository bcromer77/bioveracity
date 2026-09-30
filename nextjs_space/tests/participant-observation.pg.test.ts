// PILOT-001 NE demo: participant observations against real PostgreSQL. Skipped unless
// LISTEN_PG_URL and LISTEN_PRISMA_CLIENT point at a disposable database (migration 20261007 applied).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { observationInput, observationService } from '../lib/listens/observations.mjs'
import { listenService } from '../lib/listens/service.mjs'
import { rightsService } from '../lib/data-rights/service'
import type { Database, Sql } from '../lib/workspaces/service'

type RawClient = {
  $queryRawUnsafe<T>(sql: string, ...values: unknown[]): Promise<T>
  $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>
  $transaction<T>(op: (tx: RawClient) => Promise<T>): Promise<T>
  $disconnect(): Promise<void>
}
type Failure = { status?: number; message?: string }
const url = process.env.LISTEN_PG_URL, clientPath = process.env.LISTEN_PRISMA_CLIENT
const skip = !url || !clientPath ? 'LISTEN_PG_URL / LISTEN_PRISMA_CLIENT not set' : false
const PLACE = `bv_place_obstest_${randomUUID().slice(0, 8)}`
let prisma: RawClient
const adapter = (client: RawClient): Sql => ({ query: <T>(sql: string, values: unknown[]) => client.$queryRawUnsafe<T[]>(sql, ...values) })
const db = (): Database => ({ ...adapter(prisma), transaction: (op) => prisma.$transaction((tx) => op(adapter(tx))) })
const count = async (sql: string, ...v: unknown[]) => Number((await prisma.$queryRawUnsafe<{ n: number }[]>(sql, ...v))[0].n)
const status = (n: number, message?: string) => (e: Failure) => e.status === n && (message === undefined || e.message === message)
const input = (extra: Record<string, unknown> = {}) => observationInput({ id: randomUUID(), kind: 'NOTE', category: 'ANIMAL', observedAt: new Date(Date.now() - 60000).toISOString(), observedAtProvenance: 'DEVICE_NOW', note: 'pobs-private-note', locationMethod: 'NONE', locationSharing: 'PRIVATE', adult: true, ...extra })
const media = () => { const original = Buffer.concat([Buffer.from('RIFF\0\0\0\0WAVEfmt '), Buffer.alloc(64)]); return { mediaType: 'SOUND', mime: 'audio/wav', original, sha256: 'x'.repeat(64), displayMime: null, display: null } }
async function user(label: string, verified = true) {
  const id = `pobs-${label}-${randomUUID()}`
  await prisma.$executeRawUnsafe('INSERT INTO "User" (id,email,"emailVerified","updatedAt") VALUES ($1,$2,$3,now())', id, `${id}@example.test`, verified ? new Date() : null)
  return id
}
const save = (owner: string, i = input(), m: ReturnType<typeof media> | null = null) => observationService(db(), owner).save({ placeId: PLACE, placeName: 'PG probe', input: i, media: m })
before(async () => {
  if (skip) return
  const { PrismaClient } = createRequire(`${process.cwd()}/`)(clientPath!) as { PrismaClient: new (o: object) => RawClient }
  prisma = new PrismaClient({ datasources: { db: { url } } })
  await prisma.$executeRawUnsafe(`INSERT INTO "Asset" (id,slug,name,type,subtype,region,"regionSlug",status,summary,jurisdiction,"updatedAt")
    VALUES ($1,$2,'PG probe','living_place','evidence_memory','R','r','active','s','GB',now())`, PLACE, PLACE.replace(/_/g, '-'))
})
after(async () => {
  if (!prisma) return
  await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id LIKE \'pobs-%\'')
  await prisma.$executeRawUnsafe('DELETE FROM "Asset" WHERE id=$1', PLACE)
  await prisma.$disconnect()
})

test('save, replay and conflict: a retry never saves twice; another owner cannot reuse or probe an id', { skip }, async () => {
  const a = await user('a'), b = await user('b')
  const i = input({ kind: 'SOUND', note: '', durationMs: 3000 })
  assert.deepEqual(await save(a, i, media()), { id: i.id, replayed: false })
  assert.deepEqual(await save(a, i, media()), { id: i.id, replayed: true })
  await assert.rejects(save(a, { ...i, note: 'changed' }, media()), status(409))
  await assert.rejects(save(b, i, media()), status(409, 'This observation identifier was already used'))
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ParticipantObservation" WHERE id=$1', i.id), 1)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE "ownerId"=$1 AND "placeId"=$2', a, PLACE), 1)
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => save(a, input())))
  assert.ok(results.every((r) => r.status === 'fulfilled'), results.map((r) => (r.status === 'rejected' ? String(r.reason?.message) : '')).join('; '))
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE "ownerId"=$1', a), 1, 'one Place history per owner')
})

test('ownership isolation: lists, media and deletion are owner-only', { skip }, async () => {
  const a = await user('iso-a'), b = await user('iso-b')
  const i = input({ kind: 'SOUND', note: '', durationMs: 1000 })
  await save(a, i, media())
  const sb = observationService(db(), b)
  assert.deepEqual(await sb.listForPlace(PLACE), [])
  assert.deepEqual(await sb.listAll(), [])
  await assert.rejects(sb.media(i.id, 'original'), status(404))
  await assert.rejects(sb.remove(i.id), status(404))
  assert.equal((await observationService(db(), a).listForPlace(PLACE)).length, 1)
  assert.equal((await observationService(db(), a).media(i.id, 'original')).mime, 'audio/wav')
  assert.deepEqual(await observationService(db(), a).remove(i.id), { deleted: true })
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ParticipantObservationMedia" WHERE "observationId"=$1', i.id), 0, 'media deleted with the observation')
})

test('unverified participants cannot save', { skip }, async () => {
  const u = await user('unverified', false)
  await assert.rejects(save(u), status(403))
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE "ownerId"=$1', u), 0)
})

test('database pins status, location coherence and Place RESTRICT', { skip }, async () => {
  const a = await user('check'), i = input()
  await save(a, i)
  await assert.rejects(prisma.$executeRawUnsafe(`UPDATE "ParticipantObservation" SET status='VERIFIED' WHERE id=$1`, i.id), /check/i)
  await assert.rejects(prisma.$executeRawUnsafe(`UPDATE "ParticipantObservation" SET "locationSharing"='EXACT' WHERE id=$1`, i.id), /check/i)
  await assert.rejects(prisma.$executeRawUnsafe(`UPDATE "ParticipantObservation" SET "locationMethod"='DEVICE',"capturedLat"=54,"capturedLng"=-5 WHERE id=$1`, i.id), /check/i)
  await assert.rejects(prisma.$executeRawUnsafe(`UPDATE "ParticipantObservation" SET "locationMethod"='MAP_APPROXIMATE',"capturedLat"=54 WHERE id=$1`, i.id), /check/i)
  await assert.rejects(prisma.$executeRawUnsafe(`UPDATE "ParticipantObservation" SET note=NULL WHERE id=$1`, i.id), /check/i, 'a NOTE needs its note')
  await assert.rejects(prisma.$executeRawUnsafe('DELETE FROM "Asset" WHERE id=$1', PLACE), /foreign key|violates/i)
})

test('export includes observations; deleting the Place history or the account cascades', { skip }, async () => {
  const a = await user('rights')
  const i = input({ kind: 'SOUND', note: '', durationMs: 2000 })
  await save(a, i, media())
  const overview = await rightsService(db(), a).overview()
  const exported = overview.listening.observations as Array<Record<string, unknown>>
  assert.equal(exported.length, 1)
  assert.equal(exported[0].id, i.id)
  assert.equal(exported[0].status, 'Participant observation · Unverified')
  assert.ok(!('original' in exported[0]), 'export carries metadata, not raw bytes')
  const [plot] = await prisma.$queryRawUnsafe<{ id: string }[]>('SELECT id FROM "ListeningPlot" WHERE "ownerId"=$1', a)
  await listenService(db(), a).deletePlot(plot.id)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ParticipantObservation" WHERE id=$1', i.id), 0)
  const b = await user('rights-b'), j = input()
  await save(b, j)
  await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id=$1', b)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ParticipantObservation" WHERE id=$1', j.id), 0)
})
