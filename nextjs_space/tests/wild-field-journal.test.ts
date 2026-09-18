import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { HubError } from '../lib/wild-hubs/domain'
import {
  contributionService,
  ownerContributionService,
  contributionInput,
  moderationInput,
  categoryLabel,
  CONTRIBUTION_EVIDENCE_CLASS,
  CONTRIBUTION_CATEGORIES,
} from '../lib/wild-hubs/contributions'
import { contributionPhotoInput } from '../lib/wild-hubs/photos'
import { buildJournal } from '../lib/wild-hubs/journal'
import type { Snapshot, Plan, Campaign } from '../lib/wild-hubs/domain'
import type { Sql, Database } from '../lib/workspaces/service'

// Pure-input tests need no database.
test('contribution input: categories, coordinates, permission and dates', () => {
  // All ten broad categories are accepted, including the deliberate "unknown".
  assert.equal(CONTRIBUTION_CATEGORIES.length, 10)
  assert.ok(CONTRIBUTION_CATEGORIES.some((c) => c.value === 'unknown'))
  assert.equal(categoryLabel('unknown'), "I don't know")
  assert.equal(categoryLabel('farm-animal'), 'Farm animal')

  const ok = contributionInput({
    broadCategory: 'bird',
    whatYouThink: 'a small brown bird',
    note: 'near the feeder',
    coarseLocation: 'by the old oak',
    permissionToPublish: true,
    observedAt: '2026-05-04',
  })
  assert.equal(ok.broadCategory, 'bird')
  assert.equal(ok.permissionToPublish, true)
  assert.ok(ok.observedAt instanceof Date)

  // "I don't know" with no free text is valid — a visitor is never forced to identify.
  const idk = contributionInput({ broadCategory: 'unknown', permissionToPublish: false })
  assert.equal(idk.broadCategory, 'unknown')
  assert.equal(idk.permissionToPublish, false)

  // An unknown category is refused.
  assert.throws(() => contributionInput({ broadCategory: 'dragon', permissionToPublish: true }), HubError)
  // Coordinates in the location are refused — location is words only.
  assert.throws(
    () => contributionInput({ broadCategory: 'bird', coarseLocation: '54.2761, -5.8340', permissionToPublish: true }),
    HubError,
  )
  // Permission must be an explicit boolean.
  assert.throws(() => contributionInput({ broadCategory: 'bird' }), HubError)
  // A future observation date is refused.
  assert.throws(
    () => contributionInput({ broadCategory: 'bird', permissionToPublish: true, observedAt: '2999-01-01' }),
    HubError,
  )
})

test('moderation input and photo input validation', () => {
  assert.deepEqual(moderationInput({ action: 'publish', hideLocation: true, moderatorNote: 'note' }), {
    action: 'publish',
    hideLocation: true,
    moderatorNote: 'note',
  })
  assert.throws(() => moderationInput({ action: 'delete' }), HubError)

  // Photo input requires explicit rights + scanner consent.
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64, 1)])
  const base64 = jpeg.toString('base64')
  assert.throws(() => contributionPhotoInput({ base64, rightsConfirmed: false, scannerConsent: true }), HubError)
  assert.throws(() => contributionPhotoInput({ base64, rightsConfirmed: true, scannerConsent: false }), HubError)
  // A non-image is refused even with consent.
  assert.throws(
    () =>
      contributionPhotoInput({
        base64: Buffer.from('not an image at all').toString('base64'),
        rightsConfirmed: true,
        scannerConsent: true,
      }),
    HubError,
  )
  const good = contributionPhotoInput({ base64, rightsConfirmed: true, scannerConsent: true })
  assert.ok(Buffer.isBuffer(good.bytes))
})

test('buildJournal buckets by Dublin month and keeps provenance, never a species counter', () => {
  const campaign = (month: number): Campaign => ({
    month,
    title: `Month ${month}`,
    introduction: 'Seasonal note.',
    activity: '',
    caption: '',
    planningNote: '',
  })
  const plan = { campaigns: [campaign(5)] } as unknown as Plan
  const snapshot = { plan } as unknown as Snapshot
  const journal = buildJournal(snapshot, [
    {
      id: 'c1',
      broadCategory: 'bird',
      categoryLabel: 'Bird',
      identified: true,
      whatYouThink: 'a robin',
      observedAt: '2026-05-10T09:00:00.000Z',
      createdAt: '2026-06-01T09:00:00.000Z',
      coarseLocation: 'by the oak',
    },
    {
      id: 'c2',
      broadCategory: 'unknown',
      categoryLabel: "I don't know",
      identified: false,
      whatYouThink: '',
      observedAt: null,
      createdAt: '2026-05-20T09:00:00.000Z',
      coarseLocation: '',
    },
  ])
  assert.equal(journal.months.length, 12)
  assert.equal(journal.total, 2)
  // Both settle into May (index 4): c1 by observed date, c2 by shared date.
  assert.equal(journal.months[4].entries.length, 2)
  assert.equal(journal.months[4].campaign?.title, 'Month 5')
  // Every entry carries provenance; nothing is promoted to verified evidence.
  for (const e of journal.months[4].entries) {
    assert.equal(e.provenance, 'visitor-observation')
    assert.equal(e.status, 'Community observation')
    assert.match(e.photoUrl, /\/api\/wild\/contributions\/.+\/photo/)
  }
  // An unidentified observation stays unidentified.
  const c2 = journal.months[4].entries.find((e) => e.id === 'c2')!
  assert.equal(c2.identified, false)
})

// Full lifecycle against an isolated PostgreSQL engine.
test('isolated PostgreSQL: contribute, moderate, publish, isolate — evidence class never changes', async () => {
  const pg = new PGlite()
  try {
    await pg.exec(
      "CREATE TABLE \"User\" (id TEXT PRIMARY KEY, role TEXT DEFAULT 'user', \"accessState\" TEXT DEFAULT 'REGISTERED'); INSERT INTO \"User\" (id) VALUES ('alice'),('bob');",
    )
    await pg.exec(readFileSync(new URL('../prisma/migrations/20260914_wild_hubs/migration.sql', import.meta.url), 'utf8'))
    await pg.exec(readFileSync(new URL('../prisma/migrations/20260915_wild_editorial_review/migration.sql', import.meta.url), 'utf8'))
    await pg.exec(readFileSync(new URL('../prisma/migrations/20260918_wild_field_journal/migration.sql', import.meta.url), 'utf8'))

    const sql = (client: Pick<PGlite, 'query'>): Sql => ({
      query: async <T>(statement: string, values: unknown[]) => (await client.query<T>(statement, values)).rows as T[],
    })
    const db: Database = { ...sql(pg), transaction: (fn) => pg.transaction((tx) => fn(sql(tx))) }

    // Two published hubs (alice's + bob's) and one unpublished (alice's).
    const profile = JSON.stringify({ name: 'Fictional Woods', county: 'down', kind: 'other' })
    const published = JSON.stringify({ version: 1 })
    const aliceHub = randomUUID()
    const bobHub = randomUUID()
    const draftHub = randomUUID()
    await pg.query('INSERT INTO "WildHub" ("id","ownerId","profile","published") VALUES ($1,$2,$3::jsonb,$4::jsonb)', [aliceHub, 'alice', profile, published])
    await pg.query('INSERT INTO "WildHub" ("id","ownerId","profile","published") VALUES ($1,$2,$3::jsonb,$4::jsonb)', [bobHub, 'bob', profile, published])
    await pg.query('INSERT INTO "WildHub" ("id","ownerId","profile") VALUES ($1,$2,$3::jsonb)', [draftHub, 'alice', profile])

    const pub = contributionService(db)
    const alice = ownerContributionService(db, 'alice')
    const bob = ownerContributionService(db, 'bob')
    const prepared = (tag: string) => ({ bytes: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from(tag)]), hash: tag })

    // A visitor with permission to publish.
    const withPerm = contributionInput({ broadCategory: 'bird', whatYouThink: 'a robin', coarseLocation: 'by the oak', permissionToPublish: true, note: 'private note' })
    const s1 = await pub.submit(aliceHub, prepared('a'), withPerm)
    assert.equal(s1.status, 'PENDING')

    // Nothing is public until the owner acts.
    assert.equal((await pub.publicList(aliceHub)).length, 0)
    assert.equal(await pub.publicPhoto(s1.id), null, 'a PENDING photo is never public')

    // The owner sees it, PENDING, as a community observation.
    let owned = await alice.list(aliceHub)
    assert.equal(owned.length, 1)
    assert.equal(owned[0].publicationStatus, 'PENDING')
    assert.equal(owned[0].evidenceClass, CONTRIBUTION_EVIDENCE_CLASS)
    const before = owned[0].evidenceClass

    // Publish it.
    const decision = await alice.moderate(aliceHub, s1.id, { action: 'publish', hideLocation: false, moderatorNote: 'lovely' })
    // CENTRAL INVARIANT: publishing does not change the evidence class.
    assert.equal(decision.evidenceClass, before)
    assert.equal(decision.publicationStatus, 'PUBLISHED')

    const publicRows = await pub.publicList(aliceHub)
    assert.equal(publicRows.length, 1)
    assert.equal(publicRows[0].id, s1.id)
    assert.equal(publicRows[0].coarseLocation, 'by the oak')
    // The private note is never present in the public shape.
    assert.equal((publicRows[0] as Record<string, unknown>).note, undefined)
    // The published photo is now servable.
    assert.ok((await pub.publicPhoto(s1.id)) instanceof Uint8Array)
    // Owner still sees full detail including the private note.
    owned = await alice.list(aliceHub)
    const ownedRow = owned.find((r) => r.id === s1.id)!
    assert.equal(ownedRow.note, 'private note')
    assert.equal(ownedRow.evidenceClass, CONTRIBUTION_EVIDENCE_CLASS)

    // A second contribution, published with a sensitive location hidden.
    const s2 = await pub.submit(aliceHub, prepared('b'), contributionInput({ broadCategory: 'bird', whatYouThink: 'a nesting pair', coarseLocation: 'the heronry by the weir', permissionToPublish: true }))
    await alice.moderate(aliceHub, s2.id, { action: 'publish', hideLocation: true, moderatorNote: '' })
    const afterHide = (await pub.publicList(aliceHub)).find((r) => r.id === s2.id)!
    assert.equal(afterHide.coarseLocation, '', 'a sensitive location is never publicly exposed')

    // A third contribution, rejected — never public.
    const s3 = await pub.submit(aliceHub, prepared('c'), contributionInput({ broadCategory: 'mammal', whatYouThink: 'a fox', permissionToPublish: true }))
    await alice.moderate(aliceHub, s3.id, { action: 'reject', hideLocation: false, moderatorNote: 'blurry' })
    assert.ok(!(await pub.publicList(aliceHub)).some((r) => r.id === s3.id))
    assert.equal(await pub.publicPhoto(s3.id), null)

    // A contribution WITHOUT permission to publish cannot be published (409).
    const s4 = await pub.submit(aliceHub, prepared('d'), contributionInput({ broadCategory: 'plant', permissionToPublish: false }))
    await assert.rejects(
      alice.moderate(aliceHub, s4.id, { action: 'publish', hideLocation: false, moderatorNote: '' }),
      (e: unknown) => e instanceof HubError && e.status === 409,
    )
    // But it can be kept private (rejected) without error.
    await alice.moderate(aliceHub, s4.id, { action: 'reject', hideLocation: false, moderatorNote: '' })

    // Owner isolation: bob cannot see, moderate, or view photos of alice's hub.
    const denied = (p: Promise<unknown>) => assert.rejects(p, (e: unknown) => e instanceof HubError && e.status === 404)
    await denied(bob.list(aliceHub))
    await denied(bob.moderate(aliceHub, s1.id, { action: 'reject', hideLocation: false, moderatorNote: '' }))
    await denied(bob.photo(aliceHub, s1.id))

    // A hub that is not published cannot be contributed to (404, indistinguishable).
    await denied(pub.submit(draftHub, prepared('e'), withPerm) as Promise<unknown>)
    // A non-existent hub is equally a 404.
    await denied(pub.submit(randomUUID(), prepared('f'), withPerm) as Promise<unknown>)

    // Rate limit: at most 30 contributions to a hub within an hour.
    for (let i = 0; i < 30; i++) await pub.submit(bobHub, prepared('r' + i), withPerm)
    await assert.rejects(
      pub.submit(bobHub, prepared('over'), withPerm),
      (e: unknown) => e instanceof HubError && e.status === 429,
    )
  } finally {
    await pg.close()
  }
})
