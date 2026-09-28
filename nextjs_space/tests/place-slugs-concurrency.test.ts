// Concurrency proof for canonical Place slugs against a real PostgreSQL server
// (PGlite is single-connection and cannot race). Opt-in: set
//   PLACE_SLUG_PG_URL        a DISPOSABLE local database with all migrations applied
//   PLACE_SLUG_PRISMA_CLIENT path to a Prisma client generated from schema.prisma
// Without both, the test is skipped. Never point it at a hosted database.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import type { Database, Sql } from '../lib/workspaces/service'
import { PlaceSlugError, assignCanonicalPlaceSlug, resolvePlaceSlug } from '../lib/place/slugs'

const url = process.env.PLACE_SLUG_PG_URL
const clientPath = process.env.PLACE_SLUG_PRISMA_CLIENT
const enabled = Boolean(url && clientPath && /@(127\.0\.0\.1|localhost)[:/]/.test(url))

type RawClient = {
  $queryRawUnsafe<T>(sql: string, ...values: unknown[]): Promise<T>
  $transaction<T>(op: (tx: RawClient) => Promise<T>, options: { isolationLevel: 'Serializable' }): Promise<T>
  $disconnect(): Promise<void>
}

test('concurrent renames and cross-Place claims keep one current slug and one owner per slug', { skip: !enabled }, async () => {
  const { PrismaClient } = createRequire(`${process.cwd()}/`)(clientPath!) as { PrismaClient: new (o: object) => RawClient }
  const prisma = new PrismaClient({ datasources: { db: { url: `${url}${url!.includes('?') ? '&' : '?'}connection_limit=16` } } })
  const adapter = (c: RawClient): Sql => ({ query: <T>(s: string, v: unknown[]) => c.$queryRawUnsafe<T[]>(s, ...v) })
  const db: Database = { ...adapter(prisma), transaction: (op) => prisma.$transaction((tx) => op(adapter(tx)), { isolationLevel: 'Serializable' }) }
  const run = String(Date.now())
  const place = (n: string) => `bv_place_zz_race_${n}_${run}`
  try {
    const ids = ['a', 'b', 'c'].map(place)
    for (const id of ids) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "Asset" (id, slug, name, type, region, "regionSlug", "updatedAt") VALUES ($1,$2,$3,'place','Test','test',now()) RETURNING id`,
        id, `legacy-${id.replace(/_/g, '-')}`, `Áth Test ${id}`,
      )
    }
    const before = await prisma.$queryRawUnsafe<unknown[]>('SELECT id, slug, name FROM "Asset" WHERE id = ANY($1) ORDER BY id', ids)

    // 1) Twelve simultaneous renames of the same Place.
    const slugs = Array.from({ length: 12 }, (_, i) => `race-${run}-a-${i}`)
    const renames = await Promise.allSettled(slugs.map((s) => assignCanonicalPlaceSlug(db, ids[0], s, { maxAttempts: 5 })))
    for (const r of renames) {
      if (r.status === 'rejected') assert.ok(r.reason instanceof PlaceSlugError && r.reason.code === 'slug_conflict_retry_exhausted', String(r.reason))
    }
    const wonRenames = renames.filter((r) => r.status === 'fulfilled').length
    assert.ok(wonRenames >= 1)
    const rowsA = await prisma.$queryRawUnsafe<{ slug: string; retiredAt: Date | null }[]>(
      'SELECT slug, "retiredAt" FROM "PlaceSlug" WHERE "placeId" = $1', ids[0])
    assert.equal(rowsA.length, wonRenames, 'every committed rename left exactly one history row')
    const current = rowsA.filter((r) => r.retiredAt === null)
    assert.equal(current.length, 1, 'exactly one current slug after the race')
    for (const row of rowsA) {
      const res = await resolvePlaceSlug(db, row.slug)
      if (row.slug === current[0].slug) assert.deepEqual(res, { outcome: 'current', placeId: ids[0], slug: row.slug })
      else assert.deepEqual(res, { outcome: 'redirect', status: 308, placeId: ids[0], slug: current[0].slug, location: `/place/${current[0].slug}` })
    }

    // 2) Two Places claiming the same brand-new slug, twenty rounds.
    let bWins = 0
    for (let round = 0; round < 20; round++) {
      const slug = `race-${run}-shared-${round}`
      const [rb, rc] = await Promise.allSettled([
        assignCanonicalPlaceSlug(db, ids[1], slug, { maxAttempts: 5 }),
        assignCanonicalPlaceSlug(db, ids[2], slug, { maxAttempts: 5 }),
      ])
      const winners = [rb, rc].filter((r) => r.status === 'fulfilled')
      assert.equal(winners.length, 1, `round ${round}: exactly one Place owns the slug`)
      const loser = [rb, rc].find((r) => r.status === 'rejected') as PromiseRejectedResult
      assert.ok(loser.reason instanceof PlaceSlugError && loser.reason.code === 'slug_collision', String(loser.reason))
      const owner = rb.status === 'fulfilled' ? ids[1] : ids[2]
      if (owner === ids[1]) bWins++
      const res = await resolvePlaceSlug(db, slug)
      assert.equal(res.outcome, 'current')
      assert.equal((res as { placeId: string }).placeId, owner, 'resolution returns the owning Place, never the loser')
    }
    for (const id of ids.slice(1)) {
      const cur = await prisma.$queryRawUnsafe<{ n: number }[]>(
        'SELECT COUNT(*)::int AS n FROM "PlaceSlug" WHERE "placeId" = $1 AND "retiredAt" IS NULL', id)
      assert.ok(cur[0].n <= 1, 'never more than one current slug per Place')
    }
    const total = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM "PlaceSlug" WHERE slug LIKE $1`, `race-${run}-shared-%`)
    assert.equal(total[0].n, 20, 'one row per contested slug, no duplicates')
    // eslint-disable-next-line no-console
    console.log(`[race] renames committed=${wonRenames}/12, shared-slug wins b=${bWins} c=${20 - bWins}`)

    const after = await prisma.$queryRawUnsafe<unknown[]>('SELECT id, slug, name FROM "Asset" WHERE id = ANY($1) ORDER BY id', ids)
    assert.deepEqual(after, before, 'concurrent slug operations never touched Asset identity or names')
  } finally {
    await prisma.$disconnect()
  }
})
