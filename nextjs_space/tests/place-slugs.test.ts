import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { Database, Sql } from '../lib/workspaces/service'
import {
  PLACE_SLUG_MAX_LENGTH,
  PlaceSlugError,
  assertPlaceSlug,
  assignCanonicalPlaceSlug,
  isPlaceSlug,
  placeRoutePath,
  resolvePlaceSlug,
} from '../lib/place/slugs'

// Synthetic identities only (PR A generic-literal rule).
const ALPHA = 'bv_place_zz_alpha'
const BETA = 'bv_place_zz_beta'
const NON_PLACE = 'asset_zz_not_a_place'
const ALPHA_NAME = 'Baile Átha Cliath Test — Ó Súilleabháin'
const BETA_NAME = 'Loch Éirne Test'

const MIGRATIONS = [
  '0000_init', '20260909_private_workspace_foundation', '20260920_observation_revisions',
  '20261001_developer_platform_v1', '20261003_kerry_place_memory_v1', '20261004_place_slug_history',
]

let clock = Date.parse('2026-10-04T09:00:00.000Z')
const tick = () => new Date((clock += 1000))

async function harness() {
  const pg = new PGlite()
  for (const m of MIGRATIONS) await pg.exec(readFileSync(join(process.cwd(), 'prisma/migrations', m, 'migration.sql'), 'utf8'))
  const sql = (client: Pick<PGlite, 'query'>): Sql => ({
    query: async <T>(text: string, values: unknown[]) => (await client.query<T>(text, values)).rows,
  })
  const db: Database = { ...sql(pg), transaction: (op) => pg.transaction((tx) => op(sql(tx))) }
  for (const [id, slug, name] of [[ALPHA, 'legacy-alpha', ALPHA_NAME], [BETA, 'legacy-beta', BETA_NAME], [NON_PLACE, 'legacy-np', 'Not a Place']]) {
    await pg.query(
      `INSERT INTO "Asset" (id, slug, name, type, region, "regionSlug", "updatedAt") VALUES ($1,$2,$3,'place','Test','test',now())`,
      [id, slug, name],
    )
  }
  const assets = async () => (await pg.query<{ id: string; slug: string; name: string }>(
    'SELECT id, slug, name FROM "Asset" ORDER BY id')).rows
  const slugRows = async () => (await pg.query<{ slug: string; placeId: string; retiredAt: Date | null }>(
    'SELECT slug, "placeId", "retiredAt" FROM "PlaceSlug" ORDER BY slug')).rows
  return { pg, db, assets, slugRows }
}

const assign = (db: Database, placeId: unknown, slug: unknown) => assignCanonicalPlaceSlug(db, placeId, slug, { now: tick })

async function rejectsCode(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof PlaceSlugError && e.code === code)
}

async function rejectsSql(pg: PGlite, text: string, values: unknown[], pattern: RegExp) {
  await assert.rejects(pg.query(text, values), (e: unknown) => pattern.test(String((e as Error).message)))
}

// ---------------------------------------------------------------- validation

test('slug validation is strict lower-case ASCII with bounded length', () => {
  for (const ok of ['a', 'river-free-slug-0', 'loch-eirne', 'x1-2-3', 'a'.repeat(PLACE_SLUG_MAX_LENGTH)]) {
    assert.equal(isPlaceSlug(ok), true, ok)
    assert.equal(assertPlaceSlug(ok), ok)
  }
  for (const bad of [
    '', 'A', 'Loch-Eirne', 'loch éirne', 'loch-éirne', 'baile-átha-cliath', ' loch', 'loch ', 'loch eirne',
    '-loch', 'loch-', 'loch--eirne', 'loch_eirne', 'loch.eirne', 'loch/eirne', '../loch', 'loch%20eirne',
    'ｌｏｃｈ', 'loch\n', 'a'.repeat(PLACE_SLUG_MAX_LENGTH + 1), 'bv_place_zz_alpha',
    null, undefined, 42, {}, ['loch'],
  ] as unknown[]) {
    assert.equal(isPlaceSlug(bad), false, JSON.stringify(bad))
    assert.throws(() => assertPlaceSlug(bad), (e: unknown) => e instanceof PlaceSlugError && e.code === 'malformed_slug')
  }
})

test('placeRoutePath builds /place/{slug} only from valid slugs', () => {
  assert.equal(placeRoutePath('loch-eirne'), '/place/loch-eirne')
  assert.throws(() => placeRoutePath('Loch-Eirne'), PlaceSlugError)
  assert.throws(() => placeRoutePath('//evil.example'), PlaceSlugError)
})

test('malformed slugs resolve to not_found without touching the database', async () => {
  const refusing: Sql = { query: async () => { throw new Error('database must not be queried') } }
  for (const bad of ['', 'UPPER', 'é', 'a'.repeat(81), null, 7] as unknown[]) {
    assert.deepEqual(await resolvePlaceSlug(refusing, bad), { outcome: 'not_found', reason: 'malformed_slug' })
  }
})

test('malformed input to assign is rejected before any transaction', async () => {
  const refusing: Database = {
    query: async () => { throw new Error('no query') },
    transaction: async () => { throw new Error('no transaction') },
  }
  await rejectsCode(assign(refusing, 'not-a-place-id', 'ok'), 'malformed_place_id')
  await rejectsCode(assign(refusing, NON_PLACE, 'ok'), 'malformed_place_id')
  await rejectsCode(assign(refusing, ALPHA.toUpperCase(), 'ok'), 'malformed_place_id')
  await rejectsCode(assign(refusing, null, 'ok'), 'malformed_place_id')
  await rejectsCode(assign(refusing, ['bv_place_zz_alpha'], 'ok'), 'malformed_place_id')
  await rejectsCode(assign(refusing, ALPHA, 'Not-Ok'), 'malformed_slug')
  await rejectsCode(assign(refusing, ALPHA, 'loch-éirne'), 'malformed_slug')
})

// ------------------------------------------------------ history & resolution

test('assign, rename chain, 308 redirects and reinstatement', async () => {
  const h = await harness()
  const before = await h.assets()

  assert.deepEqual(await resolvePlaceSlug(h.db, 'alpha-one'), { outcome: 'not_found', reason: 'unknown_slug' })

  const first = await assign(h.db, ALPHA, 'alpha-one')
  assert.deepEqual(first, { placeId: ALPHA, slug: 'alpha-one', changed: true, retired: [], reinstated: false })
  assert.deepEqual(await resolvePlaceSlug(h.db, 'alpha-one'), { outcome: 'current', placeId: ALPHA, slug: 'alpha-one' })

  // Idempotent re-assign of the current slug.
  assert.deepEqual(await assign(h.db, ALPHA, 'alpha-one'), { placeId: ALPHA, slug: 'alpha-one', changed: false, retired: [], reinstated: false })

  const second = await assign(h.db, ALPHA, 'alpha-two')
  assert.deepEqual(second.retired, ['alpha-one'])
  assert.deepEqual(await resolvePlaceSlug(h.db, 'alpha-one'), {
    outcome: 'redirect', status: 308, placeId: ALPHA, slug: 'alpha-two', location: '/place/alpha-two',
  })

  await assign(h.db, ALPHA, 'alpha-three')
  for (const old of ['alpha-one', 'alpha-two']) {
    assert.deepEqual(await resolvePlaceSlug(h.db, old), {
      outcome: 'redirect', status: 308, placeId: ALPHA, slug: 'alpha-three', location: '/place/alpha-three',
    }, `${old} must redirect straight to the current slug (no chains)`)
  }

  const back = await assign(h.db, ALPHA, 'alpha-one')
  assert.equal(back.reinstated, true)
  assert.deepEqual(back.retired, ['alpha-three'])
  assert.deepEqual(await resolvePlaceSlug(h.db, 'alpha-one'), { outcome: 'current', placeId: ALPHA, slug: 'alpha-one' })
  assert.equal((await resolvePlaceSlug(h.db, 'alpha-three') as { location: string }).location, '/place/alpha-one')

  const rows = await h.slugRows()
  assert.equal(rows.length, 3, 'history is append-only; reinstatement reuses the row')
  assert.equal(rows.filter((r) => r.retiredAt === null).length, 1, 'exactly one current slug')

  // Negative identity: no slug operation changed any Asset id, legacy slug or display name.
  assert.deepEqual(await h.assets(), before)
  assert.equal((await h.assets()).find((a) => a.id === ALPHA)!.name, ALPHA_NAME, 'diacritics preserved; name never derived from slug')
})

test('global collision protection covers current and retired slugs of other Places', async () => {
  const h = await harness()
  await assign(h.db, ALPHA, 'shared-name')
  await rejectsCode(assign(h.db, BETA, 'shared-name'), 'slug_collision')

  await assign(h.db, ALPHA, 'alpha-new')
  // 'shared-name' is now retired for ALPHA and must stay reserved to ALPHA.
  await rejectsCode(assign(h.db, BETA, 'shared-name'), 'slug_collision')
  const r = await resolvePlaceSlug(h.db, 'shared-name')
  assert.equal(r.outcome, 'redirect')
  assert.equal((r as { placeId: string }).placeId, ALPHA, 'a retired slug is never substituted to another Place')

  await assign(h.db, BETA, 'beta-one')
  await rejectsCode(assign(h.db, ALPHA, 'beta-one'), 'slug_collision')
  assert.deepEqual(await resolvePlaceSlug(h.db, 'beta-one'), { outcome: 'current', placeId: BETA, slug: 'beta-one' })
  assert.deepEqual(await resolvePlaceSlug(h.db, 'alpha-new'), { outcome: 'current', placeId: ALPHA, slug: 'alpha-new' })

  // Failed collisions left no partial writes.
  const rows = await h.slugRows()
  assert.deepEqual(rows.map((x) => [x.slug, x.placeId, x.retiredAt === null]), [
    ['alpha-new', ALPHA, true], ['beta-one', BETA, true], ['shared-name', ALPHA, false],
  ])
})

test('unknown Place, non-Place asset and missing current slug are structured outcomes', async () => {
  const h = await harness()
  await rejectsCode(assign(h.db, 'bv_place_zz_missing', 'ghost'), 'place_not_found')
  assert.equal((await h.slugRows()).length, 0, 'no row written for a missing Place')
  assert.deepEqual(await resolvePlaceSlug(h.db, 'ghost'), { outcome: 'not_found', reason: 'unknown_slug' })

  // A Place whose history has no current slug (only reachable by direct SQL)
  // resolves to not_found rather than guessing a target.
  await assign(h.db, BETA, 'beta-orphaned')
  await h.pg.query('UPDATE "PlaceSlug" SET "retiredAt" = "createdAt" + interval \'1 second\' WHERE slug = $1', ['beta-orphaned'])
  assert.deepEqual(await resolvePlaceSlug(h.db, 'beta-orphaned'), { outcome: 'not_found', reason: 'no_current_slug' })

  // The database itself refuses a slug for a non-Place asset id.
  await rejectsSql(h.pg, 'INSERT INTO "PlaceSlug" (slug, "placeId") VALUES ($1, $2)', ['np-slug', NON_PLACE], /PlaceSlug_placeId_format_check/)
})

test('rename that would collide leaves the current slug intact (transaction rolls back)', async () => {
  const h = await harness()
  await assign(h.db, ALPHA, 'alpha-keep')
  await assign(h.db, BETA, 'beta-taken')
  await rejectsCode(assign(h.db, ALPHA, 'beta-taken'), 'slug_collision')
  assert.deepEqual(await resolvePlaceSlug(h.db, 'alpha-keep'), { outcome: 'current', placeId: ALPHA, slug: 'alpha-keep' })
})

// --------------------------------------------------- database-level guards

test('database constraints enforce format, one-current-slug and append-only history', async () => {
  const h = await harness()
  await assign(h.db, ALPHA, 'alpha-a')
  await assign(h.db, ALPHA, 'alpha-b')

  await rejectsSql(h.pg, 'INSERT INTO "PlaceSlug" (slug, "placeId") VALUES ($1, $2)', ['Upper', BETA], /PlaceSlug_slug_format_check/)
  await rejectsSql(h.pg, 'INSERT INTO "PlaceSlug" (slug, "placeId") VALUES ($1, $2)', ['a'.repeat(81), BETA], /PlaceSlug_slug_format_check/)
  await rejectsSql(h.pg, 'INSERT INTO "PlaceSlug" (slug, "placeId") VALUES ($1, $2)', ['loch-éirne', BETA], /PlaceSlug_slug_format_check/)
  await rejectsSql(h.pg, 'INSERT INTO "PlaceSlug" (slug, "placeId") VALUES ($1, $2)', ['alpha-c', ALPHA], /PlaceSlug_one_current_per_place/)
  await rejectsSql(h.pg, 'INSERT INTO "PlaceSlug" (slug, "placeId") VALUES ($1, $2)', ['alpha-a', BETA], /PlaceSlug_pkey/)
  await rejectsSql(h.pg, 'INSERT INTO "PlaceSlug" (slug, "placeId") VALUES ($1, $2)', ['orphan', 'bv_place_zz_missing'], /PlaceSlug_placeId_fkey/)

  await rejectsSql(h.pg, 'DELETE FROM "PlaceSlug" WHERE slug = $1', ['alpha-a'], /place_slug_history_immutable/)
  await rejectsSql(h.pg, 'UPDATE "PlaceSlug" SET slug = $1 WHERE slug = $2', ['alpha-z', 'alpha-a'], /place_slug_history_immutable/)
  await rejectsSql(h.pg, 'UPDATE "PlaceSlug" SET "placeId" = $1 WHERE slug = $2', [BETA, 'alpha-a'], /place_slug_history_immutable/)
  await rejectsSql(h.pg, 'UPDATE "PlaceSlug" SET "createdAt" = now() - interval \'1 day\' WHERE slug = $1', ['alpha-a'], /place_slug_history_immutable/)

  // Identity cannot be moved or deleted underneath its locators.
  await rejectsSql(h.pg, 'UPDATE "Asset" SET id = $1 WHERE id = $2', ['bv_place_zz_renamed', ALPHA], /PlaceSlug_placeId_fkey/)
  await rejectsSql(h.pg, 'DELETE FROM "Asset" WHERE id = $1', [ALPHA], /PlaceSlug_placeId_fkey/)

  const rows = await h.slugRows()
  assert.deepEqual(rows.map((r) => [r.slug, r.placeId, r.retiredAt === null]), [['alpha-a', ALPHA, false], ['alpha-b', ALPHA, true]])
})

// ---------------------------------------------------- structural isolation

test('nothing is keyed by slug: no table references PlaceSlug and the migration is additive', () => {
  const root = join(process.cwd(), 'prisma/migrations')
  for (const dir of readdirSync(root)) {
    if (dir === '20261004_place_slug_history') continue
    let text = ''
    try { text = readFileSync(join(root, dir, 'migration.sql'), 'utf8') } catch { continue }
    assert.doesNotMatch(text, /"PlaceSlug"/, `${dir} must not reference PlaceSlug`)
  }
  const migration = readFileSync(join(root, '20261004_place_slug_history', 'migration.sql'), 'utf8')
  const code = migration.replace(/--.*$/gm, '')
  assert.doesNotMatch(code, /\bDROP\b|\bTRUNCATE\b|\bINSERT\b|\bDELETE\s+FROM\b|\bUPDATE\s+"/i, 'no destructive SQL, no backfill')
  for (const m of code.matchAll(/ALTER\s+TABLE\s+"([A-Za-z]+)"/g)) assert.equal(m[1], 'PlaceSlug', 'only the new table is altered')
  assert.equal([...code.matchAll(/CREATE\s+TABLE\s+"([A-Za-z]+)"/g)].map((m) => m[1]).join(), 'PlaceSlug')

  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
  const users = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)]
    .filter(([, name, body]) => name !== 'PlaceSlug' && /\bPlaceSlug\b/.test(body))
    .map(([, name]) => name)
  assert.deepEqual(users, ['Asset'], 'only the Asset back-relation may name PlaceSlug')
  assert.match(schema, /placeSlugs\s+PlaceSlug\[\]/)
})

test('slug module never writes Asset rows or derives identity from a slug', () => {
  const src = readFileSync(join(process.cwd(), 'lib/place/slugs.ts'), 'utf8')
  assert.doesNotMatch(src, /(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"Asset"/i)
  assert.doesNotMatch(src, /\bprisma\b|\$queryRaw|\$executeRaw/)
  assert.doesNotMatch(src, /toLowerCase|normalize\(|trim\(|replace\(/, 'no slug folding or transliteration')
  assert.doesNotMatch(src, /bv_place_\$\{|'bv_place_'\s*\+/, 'Place IDs are never constructed from slugs')
})
