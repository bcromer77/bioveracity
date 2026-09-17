import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { profileInput, generatePlan, HubError } from '../lib/wild-hubs/domain'
import { buildEdition } from '../lib/wild-hubs/edition'
import { previewEdition } from '../lib/wild-hubs/preview'
import { hubService, publicHub } from '../lib/wild-hubs/service'
import { reviewService } from '../lib/wild-hubs/review'
import type { Sql, Database } from '../lib/workspaces/service'

// A clearly fictional place used only for isolated tests. It is never a real or
// prospective BioVeracity partner.
const base = {
  name: 'Fictional Harbour Hotel',
  county: 'down',
  kind: 'hotel',
  story: 'An imaginary hotel used for isolated preview tests.',
  website: 'https://example.com',
  interests: ['nature', 'coast'],
}
const withPlace = {
  ...base,
  locality: 'Near Strangford Lough',
  invitation: 'Come and slow down by the water.',
  visitUrl: 'https://example.com/visit',
  visitPrompt: 'Check the tide times before you set out.',
  natureStory: 'Otters and terns work the shoreline at dusk.',
  recommendations: [
    { name: 'The old quay walk', note: 'A short, level stroll to the water.' },
    { name: 'Village bakery', note: '' },
    { name: '', note: '' },
  ],
}
const now = new Date('2026-06-15T12:00:00Z')

test('optional place fields persist and validate additively in the profile', () => {
  const p = profileInput(withPlace)
  assert.equal(p.locality, 'Near Strangford Lough')
  assert.equal(p.invitation, 'Come and slow down by the water.')
  assert.equal(p.visitUrl, 'https://example.com/visit')
  assert.equal(p.visitPrompt, 'Check the tide times before you set out.')
  assert.equal(p.natureStory, 'Otters and terns work the shoreline at dusk.')
  // Blank recommendation rows are dropped; two meaningful ones remain.
  assert.equal(p.recommendations?.length, 2)
  assert.deepEqual(p.recommendations?.[1], { name: 'Village bakery', note: '' })
  // A place with none of the optional fields still works and normalises to blanks.
  const bare = profileInput(base)
  assert.equal(bare.locality, '')
  assert.equal(bare.visitUrl, '')
  assert.deepEqual(bare.recommendations, [])
  // The visit link must be a public HTTPS address, like the main website.
  assert.throws(() => profileInput({ ...withPlace, visitUrl: 'javascript:alert(1)' }), HubError)
  // At most three nearby recommendations.
  assert.throws(
    () =>
      profileInput({
        ...withPlace,
        recommendations: [
          { name: 'One', note: '' },
          { name: 'Two', note: '' },
          { name: 'Three', note: '' },
          { name: 'Four', note: '' },
        ],
      }),
    HubError,
  )
})

test('the preview and the published page are built from the same renderer and never drift', () => {
  const profile = profileInput(withPlace)
  const plan = generatePlan(profile, 2026, null, now)
  const photos = [
    { id: 'a', caption: 'The harbour at dawn', credit: 'Staff', src: '/api/wild/photos/a' },
    { id: 'b', caption: 'The terrace', credit: 'Staff', src: '/api/wild/photos/b' },
  ]
  const shared = { profile, plan, photos, countyBrand: 'Wild Down', now }
  const preview = buildEdition({ kind: 'preview', provenanceLabel: 'Private preview label.', ...shared })
  const published = buildEdition({ kind: 'published', provenanceLabel: 'Published label.', reviewedLabel: 'Reviewed on 1 June 2026.', ...shared })
  // The preview announces itself and the published page does not.
  assert.equal(preview.kind, 'preview')
  assert.equal(published.kind, 'published')
  // The active seasonal campaign is deterministic for the fixed date.
  assert.equal(preview.campaign?.monthName, 'June')
  // Everything a visitor actually sees is identical between the two.
  const visible = (v: ReturnType<typeof buildEdition>) => ({
    ...v,
    kind: null,
    provenanceLabel: null,
    reviewedLabel: null,
  })
  assert.deepEqual(visible(preview), visible(published))
})

async function harness() {
  const pg = new PGlite()
  await pg.exec(
    'CREATE TABLE "User" (id TEXT PRIMARY KEY, role TEXT DEFAULT \'user\', "accessState" TEXT DEFAULT \'REGISTERED\'); INSERT INTO "User" (id) VALUES (\'alice\'),(\'bob\'),(\'reviewer\'); UPDATE "User" SET role=\'admin\' WHERE id=\'reviewer\';',
  )
  await pg.exec(readFileSync(new URL('../prisma/migrations/20260914_wild_hubs/migration.sql', import.meta.url), 'utf8'))
  await pg.exec(readFileSync(new URL('../prisma/migrations/20260915_wild_editorial_review/migration.sql', import.meta.url), 'utf8'))
  const sql = (client: Pick<PGlite, 'query'>): Sql => ({
    query: async <T>(statement: string, values: unknown[]) => (await client.query<T>(statement, values)).rows,
  })
  const db: Database = { ...sql(pg), transaction: (fn) => pg.transaction((tx) => fn(sql(tx))) }
  return { pg, db, sql: sql(pg) }
}

test('only the owner or an administrator can load the private preview', async () => {
  const { pg, db, sql } = await harness()
  try {
    const alice = hubService(db, 'alice')
    const hub = await alice.create({ ...withPlace, requestId: randomUUID() })
    // The owner sees their draft, with the optional place fields carried through.
    const owned = await previewEdition(sql, 'alice', hub.id)
    assert.equal(owned?.kind, 'preview')
    assert.equal(owned?.placeName, withPlace.name)
    assert.equal(owned?.locality, 'Near Strangford Lough')
    assert.equal(owned?.invitation, 'Come and slow down by the water.')
    assert.equal(owned?.countyBrand, 'Wild County Down')
    assert.equal(owned?.recommendations.length, 2)
    // An administrator who is not the owner may see it too (to help before review).
    assert.equal((await previewEdition(sql, 'reviewer', hub.id))?.kind, 'preview')
    // Nobody else can: a signed-in stranger, an anonymous visitor, an unknown or
    // malformed id all return null so the route can simply 404.
    assert.equal(await previewEdition(sql, 'bob', hub.id), null)
    assert.equal(await previewEdition(sql, null, hub.id), null)
    assert.equal(await previewEdition(sql, 'alice', randomUUID()), null)
    assert.equal(await previewEdition(sql, 'alice', 'not-a-uuid'), null)
  } finally {
    await pg.close()
  }
})

test('optional fields reach the published edition and it stays immutable until a new version is approved', async () => {
  const { pg, db } = await harness()
  try {
    const alice = hubService(db, 'alice')
    let hub = await alice.create({ ...withPlace, requestId: randomUUID() })
    hub = await alice.change(hub.id, { action: 'generate', revision: hub.revision, year: now.getUTCFullYear() })
    hub = await alice.addPhoto(hub.id, { caption: 'The harbour', credit: 'QA', hash: 'h1', bytes: Buffer.from('bytes') })
    const photoId = hub.photos[0].id
    hub = await alice.change(hub.id, { action: 'submit', revision: hub.revision, approved: true, authorised: true, photoIds: [photoId] })
    const reviewer = reviewService(db, 'reviewer')
    const pending = (await reviewer.list()).reviews[0]
    await reviewer.decide(pending.id, { action: 'approve', revision: hub.revision, confirmed: true, reason: 'Synthetic fixture: reviewed the whole submission.' })
    const published = await publicHub(db, hub.id)
    // The optional place fields the partner entered are present in what visitors see.
    assert.equal(published?.profile.locality, 'Near Strangford Lough')
    assert.equal(published?.profile.invitation, 'Come and slow down by the water.')
    assert.equal(published?.profile.recommendations?.length, 2)
    const publishedVersion = published?.version
    // Editing the draft supersedes the pending state but does not touch the live page.
    hub = await alice.get(hub.id)
    hub = await alice.change(hub.id, { action: 'save', revision: hub.revision, profile: { ...withPlace, invitation: 'A totally different invitation.' } })
    const still = await publicHub(db, hub.id)
    assert.equal(still?.version, publishedVersion)
    assert.equal(still?.profile.invitation, 'Come and slow down by the water.')
  } finally {
    await pg.close()
  }
})
