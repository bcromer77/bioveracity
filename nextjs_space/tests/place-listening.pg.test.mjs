// PILOT-001: Place-linked listening against real PostgreSQL. Skipped unless LISTEN_PG_URL and
// LISTEN_PRISMA_CLIENT point at a disposable database (with migration 20261006 applied).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { listenService } from '../lib/listens/service.mjs'
const url = process.env.LISTEN_PG_URL, clientPath = process.env.LISTEN_PRISMA_CLIENT
const skip = !url || !clientPath ? 'LISTEN_PG_URL / LISTEN_PRISMA_CLIENT not set' : false
const PLACE = `bv_place_pgtest_${randomUUID().slice(0, 8)}`, PLACE2 = `${PLACE}_b`
let prisma
const adapter = client => ({ query: (sql, values) => client.$queryRawUnsafe(sql, ...values) })
const service = owner => listenService({ ...adapter(prisma), transaction: op => prisma.$transaction(tx => op(adapter(tx))) }, owner)
const ago = ms => new Date(Date.now() - ms).toISOString()
const visit = (plotId, extra = {}) => ({ id: randomUUID(), plotId, observedAt: ago(3600000), completed: true, adult: true, wind: 'calm', weather: 'dry', birds: 'heard', note: '', ...extra })
const count = async (sql, ...v) => Number((await prisma.$queryRawUnsafe(sql, ...v))[0].n)
async function user(label, verified = true) {
  const id = `plisten-${label}-${randomUUID()}`
  await prisma.$executeRawUnsafe('INSERT INTO "User" (id,email,"emailVerified","updatedAt") VALUES ($1,$2,$3,now())', id, `${id}@example.test`, verified ? new Date() : null)
  return id
}
async function asset(id) {
  await prisma.$executeRawUnsafe(`INSERT INTO "Asset" (id,slug,name,type,subtype,region,"regionSlug",status,summary,jurisdiction,"updatedAt")
    VALUES ($1,$2,'PG probe','living_place','evidence_memory','R','r','active','s','GB',now())`, id, id.replace(/_/g, '-'))
}
before(async () => {
  if (skip) return
  const { PrismaClient } = createRequire(import.meta.url)(clientPath)
  prisma = new PrismaClient({ datasources: { db: { url } } })
  await asset(PLACE); await asset(PLACE2)
})
after(async () => {
  if (!prisma) return
  await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id LIKE \'plisten-%\'')
  await prisma.$executeRawUnsafe('DELETE FROM "Asset" WHERE id IN ($1,$2)', PLACE, PLACE2)
  await prisma.$disconnect()
})

test('concurrent first listens create exactly one history per owner x Place', { skip }, async () => {
  const owner = await user('race'), s = service(owner)
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => s.listenAtPlace({ placeId: PLACE, name: 'PG probe', id: randomUUID() })))
  assert.ok(results.every(r => r.status === 'fulfilled'), results.map(r => r.reason?.message).join('; '))
  assert.equal(new Set(results.map(r => r.value.id)).size, 1)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE "ownerId"=$1 AND "placeId"=$2', owner, PLACE), 1)
  const [row] = await prisma.$queryRawUnsafe('SELECT county,"placeId" FROM "ListeningPlot" WHERE "ownerId"=$1', owner)
  assert.equal(row.county, null); assert.equal(row.placeId, PLACE)
})

test('Place histories are isolated by owner and by Place, and excluded from the standalone home and quota', { skip }, async () => {
  const a = await user('a'), b = await user('b'), sa = service(a), sb = service(b)
  const { id } = await sa.listenAtPlace({ placeId: PLACE, name: 'PG probe', id: randomUUID() })
  await sa.saveVisit(visit(id, { note: 'private-marker' }))
  assert.deepEqual(await sb.homeForPlace(PLACE), { plots: [], visits: [] })
  await assert.rejects(sb.saveVisit(visit(id)), e => e.status === 404)
  await assert.rejects(sb.deletePlot(id), e => e.status === 404)
  assert.deepEqual(await sa.homeForPlace(PLACE2), { plots: [], visits: [] })
  assert.deepEqual(await sa.home(), { plots: [], visits: [] })
  for (let i = 0; i < 3; i++) await sa.createPlot({ id: randomUUID(), name: `S${i}`, county: 'Down' })
  await assert.rejects(sa.createPlot({ id: randomUUID(), name: 'S3', county: 'Down' }), e => e.status === 409)
  const again = await sa.listenAtPlace({ placeId: PLACE2, name: 'PG probe', id: randomUUID() })
  assert.ok(again.id)
  const home = await sa.homeForPlace(PLACE)
  assert.equal(home.plots.length, 1); assert.equal(home.visits.length, 1); assert.equal(home.visits[0].payload.note, 'private-marker')
  assert.equal((await sa.home()).plots.length, 3)
})

test('unverified participant cannot start a Place history', { skip }, async () => {
  const u = await user('unverified', false)
  await assert.rejects(service(u).listenAtPlace({ placeId: PLACE, name: 'PG probe', id: randomUUID() }), e => e.status === 403)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE "ownerId"=$1', u), 0)
})

test('52-visit limit and repeat visits hold for Place histories', { skip }, async () => {
  const owner = await user('busy'), s = service(owner)
  const { id } = await s.listenAtPlace({ placeId: PLACE, name: 'PG probe', id: randomUUID() })
  for (let i = 0; i < 50; i++) await s.saveVisit(visit(id, { observedAt: ago(60000 * (i + 2)) }))
  const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => s.saveVisit(visit(id, { observedAt: ago(60000 * (i + 100)) }))))
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningVisit" WHERE "plotId"=$1', id), 52)
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 2)
})

test('RESTRICT: a Place with listening history cannot be deleted; the scope CHECK holds', { skip }, async () => {
  const owner = await user('restrict')
  await service(owner).listenAtPlace({ placeId: PLACE2, name: 'PG probe', id: randomUUID() })
  await assert.rejects(prisma.$executeRawUnsafe('DELETE FROM "Asset" WHERE id=$1', PLACE2), /ListeningPlot_placeId_fkey|23001|foreign key/i)
  await assert.rejects(prisma.$executeRawUnsafe('INSERT INTO "ListeningPlot" (id,"ownerId",name,county,"placeId","payloadHash") VALUES ($1,$2,$3,NULL,NULL,$4)', randomUUID(), owner, 'neither', 'h'), /ListeningPlot_scope_check|23514|check constraint/i)
})

test('deleting the account removes Place histories and visits', { skip }, async () => {
  const owner = await user('gone'), s = service(owner)
  const { id } = await s.listenAtPlace({ placeId: PLACE, name: 'PG probe', id: randomUUID() })
  await s.saveVisit(visit(id))
  await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id=$1', owner)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE id=$1', id), 0)
  assert.equal(await count('SELECT COUNT(*)::int AS n FROM "ListeningVisit" WHERE "plotId"=$1', id), 0)
})
