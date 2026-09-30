// Real PostgreSQL boundary test for the listening pilot. Skipped unless LISTEN_PG_URL and
// LISTEN_PRISMA_CLIENT point at a disposable database and a generated Prisma client.
// Uses the same adapter and default interactive-transaction settings as app/api/listen/route.ts.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { listenService } from '../lib/listens/service.mjs'
const url = process.env.LISTEN_PG_URL, clientPath = process.env.LISTEN_PRISMA_CLIENT
const skip = !url || !clientPath ? 'LISTEN_PG_URL / LISTEN_PRISMA_CLIENT not set' : false
let prisma
const adapter = client => ({ query: (sql, values) => client.$queryRawUnsafe(sql, ...values) })
const service = owner => listenService({ ...adapter(prisma), transaction: op => prisma.$transaction(tx => op(adapter(tx))) }, owner)
const ago = ms => new Date(Date.now() - ms).toISOString()
const visit = (plotId, extra = {}) => ({ id: randomUUID(), plotId, observedAt: ago(3600000), completed: true, adult: true, wind: 'calm', weather: 'dry', birds: 'heard', note: '', ...extra })
const users = {}
async function user(label, verified = true) {
  const id = `listen-${label}-${randomUUID()}`
  await prisma.$executeRawUnsafe('INSERT INTO "User" (id,email,"emailVerified","updatedAt") VALUES ($1,$2,$3,now())', id, `${id}@example.test`, verified ? new Date() : null)
  users[label] = id
  return id
}
const count = async (sql, ...v) => Number((await prisma.$queryRawUnsafe(sql, ...v))[0].n)
before(async () => {
  if (skip) return
  const { PrismaClient } = createRequire(import.meta.url)(clientPath)
  prisma = new PrismaClient({ datasources: { db: { url } } })
  await user('alice'); await user('bob'); await user('unverified', false)
})
after(async () => { if (prisma) { await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id LIKE \'listen-%\''); await prisma.$disconnect() } })

test('owner isolation holds at the database for read, add, delete and export', { skip }, async () => {
  const alice = service(users.alice), bob = service(users.bob)
  const plot = randomUUID()
  await alice.createPlot({ id: plot, name: 'Alice bench', county: 'Kerry' })
  await alice.saveVisit(visit(plot, { note: 'robin\nwren' }))
  const bobHome = await bob.home()
  assert.deepEqual(bobHome, { plots: [], visits: [] })
  await assert.rejects(bob.saveVisit(visit(plot)), e => e.status === 404)
  await assert.rejects(bob.deletePlot(plot), e => e.status === 404)
  // Hostile identifier substitution: Bob reuses Alice's plot id and a visit id she holds.
  await assert.rejects(bob.createPlot({ id: plot, name: 'Alice bench', county: 'Kerry' }), e => e.status === 409 && !/alice/i.test(e.message))
  const [held] = await prisma.$queryRawUnsafe('SELECT id FROM "ListeningVisit" WHERE "plotId"=$1', plot)
  const bobPlot = randomUUID()
  await bob.createPlot({ id: bobPlot, name: 'Bob gate', county: 'Down' })
  await assert.rejects(bob.saveVisit({ ...visit(bobPlot), id: held.id }), e => e.status === 409)
  const aliceHome = await alice.home()
  assert.equal(aliceHome.plots.length, 1); assert.equal(aliceHome.visits.length, 1)
  assert.equal(aliceHome.visits[0].payload.note, 'robin\nwren')
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE "ownerId"=$1', users.bob), 1)
})

test('evidence fields are stored separately: source offset, UTC observation, receipt time, method and effort', { skip }, async () => {
  const alice = service(users.alice), plot = (await alice.home()).plots[0].id
  const local = new Date(Date.now() - 7200000), source = local.toISOString().slice(0, 19) + 'Z'
  const offsetSource = new Date(local.getTime() + 3600000).toISOString().slice(0, 19) + '+01:00'
  const v = visit(plot, { observedAt: offsetSource, birds: 'not_heard', wind: 'breezy', weather: 'rain' })
  const before = Date.now()
  await alice.saveVisit(v)
  const [row] = await prisma.$queryRawUnsafe('SELECT "observedAt","receivedAt",payload FROM "ListeningVisit" WHERE id=$1', v.id)
  assert.equal(row.observedAt.toISOString().slice(0, 19) + 'Z', source)
  assert.equal(row.payload.sourceTime, offsetSource)
  assert.equal(row.payload.method, 'LISTEN_5_MIN_V1'); assert.equal(row.payload.durationSeconds, 300)
  assert.deepEqual([row.payload.birds, row.payload.wind, row.payload.weather], ['not_heard', 'breezy', 'rain'])
  assert.ok(row.receivedAt.getTime() >= before - 5000, 'receipt time is server time, independent of observation time')
  assert.ok(!('adult' in row.payload) && !('completed' in row.payload) && !('score' in row.payload))
})

test('unverified participant cannot create a place even with a valid session id', { skip }, async () => {
  await assert.rejects(service(users.unverified).createPlot({ id: randomUUID(), name: 'x', county: 'Cork' }), e => e.status === 403)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE "ownerId"=$1', users.unverified), 0)
})

test('concurrent place creation cannot exceed three places', { skip }, async () => {
  const owner = await user('quota'), s = service(owner)
  const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => s.createPlot({ id: randomUUID(), name: `Place ${i}`, county: 'Cork' })))
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE "ownerId"=$1', owner), 3)
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 3)
  assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.status === 409), results.filter(r => r.status === 'rejected').map(r => r.reason.message).join('; '))
})

test('concurrent identical retries create one record; conflicting reuse is rejected', { skip }, async () => {
  const owner = await user('retry'), s = service(owner), plot = randomUUID()
  const place = { id: plot, name: 'Retry bench', county: 'Mayo' }
  const places = await Promise.allSettled(Array.from({ length: 5 }, () => s.createPlot(place)))
  assert.ok(places.every(r => r.status === 'fulfilled'), places.map(r => r.reason?.message).join('; '))
  const v = visit(plot)
  const visits = await Promise.allSettled(Array.from({ length: 5 }, () => s.saveVisit(v)))
  assert.ok(visits.every(r => r.status === 'fulfilled'), visits.map(r => r.reason?.message).join('; '))
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningVisit" WHERE id=$1', v.id), 1)
  await assert.rejects(s.saveVisit({ ...v, birds: 'unsure' }), e => e.status === 409)
  await assert.rejects(s.createPlot({ ...place, name: 'Changed' }), e => e.status === 409)
})

test('concurrent visits cannot exceed 52 per place', { skip }, async () => {
  const owner = await user('visits'), s = service(owner), plot = randomUUID()
  await s.createPlot({ id: plot, name: 'Busy bench', county: 'Galway' })
  for (let i = 0; i < 48; i++) await s.saveVisit(visit(plot, { observedAt: ago(60000 * (i + 2)) }))
  const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => s.saveVisit(visit(plot, { observedAt: ago(60000 * (i + 100)) }))))
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningVisit" WHERE "plotId"=$1', plot), 52)
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 4)
  assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.status === 409), results.filter(r => r.status === 'rejected').map(r => r.reason.message).join('; '))
})

test('cross-owner identifier race at INSERT resolves to one owner and a 409, not a 500', { skip }, async () => {
  const a = await user('raceA'), b = await user('raceB'), shared = randomUUID()
  const results = await Promise.allSettled([service(a).createPlot({ id: shared, name: 'Mine', county: 'Cork' }), service(b).createPlot({ id: shared, name: 'Mine', county: 'Cork' })])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const rejected = results.find(r => r.status === 'rejected')
  assert.equal(rejected.reason.status, 409, rejected.reason.message)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE id=$1', shared), 1)
})

test('deleting a place removes its visits; deleting the account removes places and visits', { skip }, async () => {
  const owner = await user('delete'), s = service(owner), keep = randomUUID(), drop = randomUUID()
  await s.createPlot({ id: keep, name: 'Keep', county: 'Clare' }); await s.createPlot({ id: drop, name: 'Drop', county: 'Clare' })
  await s.saveVisit(visit(keep)); await s.saveVisit(visit(drop)); await s.saveVisit(visit(drop))
  assert.deepEqual(await s.deletePlot(drop), { deleted: true })
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningVisit" WHERE "plotId"=$1', drop), 0)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningVisit" WHERE "plotId"=$1', keep), 1)
  await assert.rejects(s.deletePlot(drop), e => e.status === 404)
  await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id=$1', owner)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE id=$1', keep), 0)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningVisit" WHERE "plotId"=$1', keep), 0)
})
