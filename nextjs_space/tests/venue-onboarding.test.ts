import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { venueOnboardingService } from '../lib/wild-hubs/onboarding'
import { parseVenueCsv, VENUE_CSV_HEADER } from '../lib/wild-hubs/onboarding-input'
import { hubService, publicHub } from '../lib/wild-hubs/service'
import { reviewService } from '../lib/wild-hubs/review'
import type { Database, Sql } from '../lib/workspaces/service'

const profile = { name: 'Fictional woodland cafe', county: 'down', kind: 'food', story: 'A fictional place used for isolated release tests.', website: '', interests: ['nature'] }
const place = (n: number) => ({ reference: `venue-${n}`, email: `owner${n}@example.invalid`, profile: { ...profile, name: `Fictional venue ${n}` } })
async function fixture(run: (db: Database, pg: PGlite) => Promise<void>) {
  const pg = new PGlite()
  try {
    await pg.exec('CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT, role TEXT DEFAULT \'user\', "accessState" TEXT DEFAULT \'REGISTERED\');')
    await pg.query('INSERT INTO "User" (id,email,role) VALUES ($1,$2,$3),($4,$5,$6)', ['admin', 'admin@example.invalid', 'admin', 'reviewer', 'reviewer@example.invalid', 'admin'])
    for (let n = 0; n < 51; n++) await pg.query('INSERT INTO "User" (id,email) VALUES ($1,$2)', [`owner${n}`, `owner${n}@example.invalid`])
    for (const migration of ['20260914_wild_hubs', '20260915_wild_editorial_review', '20260921_venue_launch']) {
      await pg.exec(readFileSync(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'))
    }
    const sql = (client: Pick<PGlite, 'query'>): Sql => ({ query: async <T>(s: string, values: unknown[]) => (await client.query<T>(s, values)).rows })
    const db: Database = { ...sql(pg), transaction: fn => pg.transaction(tx => fn(sql(tx))) }
    await run(db, pg)
  } finally { await pg.close() }
}
const tokenFrom = (result: { path?: string }) => new URLSearchParams(result.path!.split('#')[1]).get('token')!

test('50 prepared places: retry, owner handoff, isolation, editorial review and public publication', async () => {
  await fixture(async (db, pg) => {
    const admin = venueOnboardingService(db, 'admin')
    const places = Array.from({ length: 50 }, (_, n) => place(n))
    const first = await admin.prepare({ places, authorised: true })
    assert.deepEqual(await admin.prepare({ places, authorised: true }), first)
    assert.equal((await admin.list()).total, 50)
    assert.equal((await pg.query('SELECT * FROM "WildHub"')).rows.length, 0, 'preparation creates no hub or account')
    await assert.rejects(venueOnboardingService(db, 'owner0').list(), /Administrator/)
    await assert.rejects(venueOnboardingService(db, 'owner0').prepare({ places: [place(50)], authorised: true }), /Administrator/)
    await assert.rejects(admin.prepare({ places: [...places, place(50)], authorised: true }), /50/)
    for (let n = 0; n < 50; n++) {
      const row = (await admin.list()).places.find(row => row.reference === `venue-${n}`)!
      const link = await admin.change(row.id, { action: 'issue', revision: row.revision })
      const token = tokenFrom(link)
      assert.ok(!(await pg.query<{ tokenHash: string }>('SELECT "tokenHash" FROM "WildVenueSetup" WHERE id=$1', [row.id])).rows[0].tokenHash.includes(token))
      assert.equal('tokenHash' in (await admin.list()).places[0], false)
      await assert.rejects(venueOnboardingService(db, 'owner50').claim({ token, confirmed: true }), /email address/)
      const owner = venueOnboardingService(db, `owner${n}`)
      const claimed = await owner.claim({ token, confirmed: true })
      assert.deepEqual(await owner.claim({ token, confirmed: true }), claimed, 'response-loss retry must not create another hub')
      assert.match(claimed.destination, /^\/wild\/studio\?hub=/)
      const service = hubService(db, `owner${n}`)
      const hub = await service.get(claimed.hubId!)
      assert.equal(hub.plan?.campaigns.length, 12)
      assert.equal(hub.published, null)
      await assert.rejects(hubService(db, 'owner50').get(hub.id), /not found/)
      await assert.rejects(service.change(hub.id, { action: 'publish', revision: hub.revision }), /editorial review/)
      const submitted = await service.change(hub.id, { action: 'submit', revision: hub.revision, approved: true, authorised: true, photoIds: [] })
      await reviewService(db, 'reviewer').decide(submitted.review!.id, { action: 'approve', confirmed: true, revision: submitted.revision, reason: 'Reviewed fictional test fixture.' })
      assert.equal((await publicHub(db, hub.id))?.profile.name, `Fictional venue ${n}`)
      await assert.rejects(admin.change(row.id, { action: 'issue', revision: row.revision }), /already belongs/)
    }
    const dashboard = await admin.list()
    assert.equal(dashboard.places.length, 50)
    assert.ok(dashboard.places.every(p => p.status === 'Published' && p.publicPath))
    assert.equal((await pg.query('SELECT * FROM "WildHub"')).rows.length, 50)
    assert.equal((await pg.query('SELECT * FROM "WildVenueSetupEvent"')).rows.length, 150)
    const hubId = dashboard.places[0].hubId!
    const ownerId = dashboard.places[0].acceptedBy!
    const hub = await hubService(db, ownerId).get(hubId)
    await hubService(db, ownerId).change(hubId, { action: 'unpublish', revision: hub.revision })
    assert.equal(await publicHub(db, hubId), null)
  })
})

test('expired, replaced, revoked and edited setup links cannot grant a place', async () => {
  await fixture(async (db, pg) => {
    const admin = venueOnboardingService(db, 'admin')
    const { ids: [id] } = await admin.prepare({ places: [place(0)], authorised: true })
    const one = tokenFrom(await admin.change(id, { action: 'issue', revision: 1 }))
    const two = tokenFrom(await admin.change(id, { action: 'issue', revision: 2 }))
    const owner = venueOnboardingService(db, 'owner0')
    await assert.rejects(owner.claim({ token: one, confirmed: true }), /expired or been revoked/)
    await assert.rejects(admin.change(id, { action: 'revoke', revision: 1 }), /changed/)
    await pg.query('UPDATE "WildVenueSetup" SET "expiresAt"=now()-interval \'1 second\' WHERE id=$1', [id])
    await assert.rejects(owner.claim({ token: two, confirmed: true }), /expired/)
    const three = tokenFrom(await admin.change(id, { action: 'issue', revision: 3 }))
    await admin.change(id, { action: 'revoke', revision: 4 })
    await assert.rejects(owner.claim({ token: three, confirmed: true }), /revoked/)
    await admin.change(id, { action: 'edit', revision: 5, ...place(1), authorised: true })
    const four = tokenFrom(await admin.change(id, { action: 'issue', revision: 6 }))
    await assert.rejects(owner.claim({ token: four, confirmed: true }), /email address/)
    await assert.rejects(venueOnboardingService(db, 'owner1').claim({ token: four, confirmed: false }), /Confirm/)
    const result = await venueOnboardingService(db, 'owner1').claim({ token: four, confirmed: true })
    assert.ok(result.hubId)
    assert.equal((await pg.query('SELECT * FROM "WildHub"')).rows.length, 1)
  })
})

test('batch conflict rolls back new rows and stale admin permissions are denied', async () => {
  await fixture(async (db, pg) => {
    const admin = venueOnboardingService(db, 'admin')
    await admin.prepare({ places: [place(1)], authorised: true })
    await assert.rejects(admin.prepare({ places: [place(0), { ...place(1), email: 'other@example.invalid' }], authorised: true }), /different details/)
    assert.equal((await admin.list()).total, 1)
    await pg.query('UPDATE "User" SET role=\'user\' WHERE id=\'admin\'')
    await assert.rejects(admin.list(), /Administrator/)
    await assert.rejects(admin.prepare({ places: [place(2)], authorised: true }), /Administrator/)
  })
})

test('CSV handles escaped quotes, commas, newlines and rejects malformed or excessive input', () => {
  const good = `${VENUE_CSV_HEADER}\r\nvenue-a, OWNER@example.invalid ,Cafe,County Down,food,"A place, with ""trees""\nand paths.",\r\n`
  const [row] = parseVenueCsv(good)
  assert.equal(row.profile.story, 'A place, with "trees"\nand paths.')
  assert.equal(row.email, 'owner@example.invalid')
  assert.equal(row.profile.county, 'down')
  assert.throws(() => parseVenueCsv(`${VENUE_CSV_HEADER}\na,b,c,d,e,"unfinished`), /quoted/)
  assert.throws(() => parseVenueCsv('email,name\na,b'), /headings/)
  assert.throws(() => parseVenueCsv(`${VENUE_CSV_HEADER}\n${'a,b,c,d,e,f,g\n'.repeat(51)}`), /50/)
  assert.throws(() => parseVenueCsv('x'.repeat(180001)), /180 KB/)
})

test('handoff preserves the three-place limit and refuses an existing matching venue', async () => {
  await fixture(async (db, pg) => {
    const admin = venueOnboardingService(db, 'admin')
    const owner = venueOnboardingService(db, 'owner0')
    const { ids: [id] } = await admin.prepare({ places: [place(0)], authorised: true })
    const token = tokenFrom(await admin.change(id, { action: 'issue', revision: 1 }))
    await pg.query('INSERT INTO "WildHub" (id,"ownerId",profile) VALUES ($1,$2,$3::jsonb)', ['existing', 'owner0', JSON.stringify(place(0).profile)])
    await assert.rejects(owner.claim({ token, confirmed: true }), /already has a place/)
    await pg.query('INSERT INTO "WildHub" (id,"ownerId",profile) VALUES ($1,$3,$4::jsonb),($2,$3,$4::jsonb)', ['other-1', 'other-2', 'owner0', JSON.stringify(profile)])
    await assert.rejects(owner.claim({ token, confirmed: true }), /three places/)
    const rows = await pg.query<{ acceptedAt: unknown }>('SELECT "acceptedAt" FROM "WildVenueSetup" WHERE id=$1', [id])
    assert.equal(rows.rows[0].acceptedAt, null)
    assert.equal((await pg.query('SELECT * FROM "WildHub"')).rows.length, 3)
  })
})
