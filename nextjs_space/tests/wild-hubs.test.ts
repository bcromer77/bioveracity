import { RELEASE_VERSION } from '../lib/venue-journal/release'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import sharp from 'sharp'
import {
  profileInput,
  generatePlan,
  parseTrends,
  trendSummary,
  activeCampaign,
  editCampaigns,
  HubError,
} from '../lib/wild-hubs/domain'
import { reviewService } from '../lib/wild-hubs/review'
import { hubService, publicHub, readablePhoto } from '../lib/wild-hubs/service'
import { photoInput, preparePhoto } from '../lib/wild-hubs/photos'
import { assertSameOrigin } from '../lib/workspaces/request-body'
import type { Sql, Database } from '../lib/workspaces/service'
const profile = {
  name: 'Fictional Harbour Hotel',
  county: 'down',
  kind: 'hotel',
  story: 'An imaginary hotel used for isolated tests.',
  website: 'https://example.com',
  interests: ['nature', 'coast'],
}
const now = new Date('2026-09-14T12:00:00Z')
const csv =
  'Category: All categories\n\nWeek,Family breaks: (Ireland)\n2025-01-05,20\n2025-07-06,80\n2025-09-07,<1\n2025-10-05,\n'
const trends = {
  csv,
  term: 'Family breaks',
  geography: 'Ireland',
  sourceUrl: 'https://trends.google.com/trends/explore?geo=IE',
}

test('profiles, date precision, editorial plans and optional measured demand stay distinct', () => {
  const p = profileInput(profile),
    t = parseTrends(trends, now)
  assert.equal(t.points[2].value, null)
  assert.equal(t.points[2].lessThanOne, true)
  assert.equal(t.points[3].value, null)
  assert.equal(t.interval, 'Week')
  assert.equal(t.periodStart, '2025-01-05')
  assert.equal(t.periodEnd, '2025-10-05')
  assert.match(trendSummary(t), /80\/100 on 2025-07-06/)
  const plan = generatePlan(p, 2026, null, now)
  assert.equal(plan.campaigns.length, 12)
  assert.equal(plan.basis, 'editorial-calendar')
  assert.equal(plan.trend, null)
  assert.equal(plan.sources.length, 0)
  assert.ok(
    plan.sources.every(
      (s) => s.eventDate === null && s.publicationDate === null,
    ),
  )
  assert.equal(
    generatePlan(p, 2026, t, now).basis,
    'editorial-calendar-with-imported-trends',
  )
  assert.equal(generatePlan(p, 2026, t, now).suggestedLeadMonth, 7)
  assert.equal(
    activeCampaign(plan, new Date('2026-09-30T23:30:00Z'))?.month,
    10,
  ) // Dublin is already in October
  assert.equal(activeCampaign(plan, new Date('2027-01-01T00:00:00Z')), null)
  const noSources = generatePlan(
    profileInput({ ...profile, county: 'wexford' }),
    2026,
    null,
    now,
  )
  assert.equal(noSources.sources.length, 0)
  assert.throws(
    () => profileInput({ ...profile, website: 'javascript:alert(1)' }),
    HubError,
  )
  assert.equal(profileInput({ ...profile, kind: 'sports_club' }).kind, 'sports_club')
  assert.throws(
    () => profileInput({ ...profile, county: 'not-a-county' }),
    HubError,
  )
  assert.throws(() => generatePlan(p, 2025, null, now), HubError)
  assert.throws(
    () => parseTrends({ ...trends, csv: csv.replace('80', '101') }, now),
    HubError,
  )
  assert.throws(
    () =>
      parseTrends(
        { ...trends, csv: csv.replace('2025-07-06', '2028-07-06') },
        now,
      ),
    HubError,
  )
  assert.throws(
    () =>
      parseTrends(
        { ...trends, csv: csv.replace('2025-07-06', '2025-02-30') },
        now,
      ),
    HubError,
  )
  assert.throws(
    () => parseTrends({ ...trends, csv: csv.replace('Week,', 'Year,') }, now),
    HubError,
  )
  assert.throws(
    () => parseTrends({ ...trends, sourceUrl: 'https://example.com' }, now),
    HubError,
  )
  assert.throws(
    () => editCampaigns(plan, [...plan.campaigns].reverse()),
    HubError,
  )
})
test('photo path scans originals, rejects unsafe input and removes metadata', async () => {
  const image = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#abcdef' },
  })
    .withMetadata({ exif: { IFD0: { Artist: 'Private metadata' } } })
    .jpeg()
    .toBuffer()
  const raw = {
    base64: image.toString('base64'),
    caption: 'Synthetic landscape',
    credit: 'Test',
    rightsConfirmed: true,
    scannerConsent: true,
  }
  assert.throws(() => photoInput({ ...raw, rightsConfirmed: false }), HubError)
  assert.throws(
    () =>
      photoInput({
        ...raw,
        base64: Buffer.from('<svg></svg>').toString('base64'),
      }),
    HubError,
  )
  let scans = 0
  const cleaned = await preparePhoto(photoInput(raw), async (bytes) => {
    assert.deepEqual(bytes, image)
    scans++
  })
  assert.equal(scans, 1)
  assert.equal((await sharp(cleaned.bytes).metadata()).exif, undefined)
  assert.equal((await sharp(cleaned.bytes).metadata()).format, 'jpeg')
  await assert.rejects(
    preparePhoto(photoInput(raw), async () => {
      throw Error('Scan unavailable')
    }),
    /Scan unavailable/,
  )
})
test('write requests reject missing and cross-site origins', () => {
  assert.throws(() =>
    assertSameOrigin(
      new Request('https://bioveracity.com/api/wild/hubs', { method: 'POST' }),
    ),
  )
  assert.throws(() =>
    assertSameOrigin(
      new Request('https://bioveracity.com/api/wild/hubs', {
        headers: { origin: 'https://evil.example' },
      }),
    ),
  )
  assert.doesNotThrow(() =>
    assertSameOrigin(
      new Request('https://bioveracity.com/api/wild/hubs', {
        headers: { origin: 'https://bioveracity.com' },
      }),
    ),
  )
})
test('isolated PostgreSQL: owner onboarding through publication, edits, photos, deduplication and revocation', async () => {
  const pg = new PGlite()
  try {
    await pg.exec(
      'CREATE TABLE "User" (id TEXT PRIMARY KEY, role TEXT DEFAULT \'user\', "accessState" TEXT DEFAULT \'REGISTERED\'); INSERT INTO "User" (id) VALUES (\'alice\'),(\'bob\'),(\'reviewer\'); UPDATE "User" SET role=\'admin\' WHERE id=\'reviewer\';',
    )
    await pg.exec(
      readFileSync(
        new URL(
          '../prisma/migrations/20260914_wild_hubs/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    )
    await pg.exec(readFileSync(new URL('../prisma/migrations/20260915_wild_editorial_review/migration.sql', import.meta.url), 'utf8'))
    for (const m of ['20260923_venue_photo_journal','20260924_data_rights']) await pg.exec(readFileSync(new URL(`../prisma/migrations/${m}/migration.sql`, import.meta.url),'utf8'))
    const sql = (client: Pick<PGlite, 'query'>): Sql => ({
      query: async <T>(statement: string, values: unknown[]) =>
        (await client.query<T>(statement, values)).rows,
    })
    const db: Database = {
      ...sql(pg),
      transaction: (fn) => pg.transaction((tx) => fn(sql(tx))),
    }
    const alice = hubService(db, 'alice'),
      bob = hubService(db, 'bob')
    const denied = (p: Promise<unknown>) =>
      assert.rejects(
        p,
        (e: unknown) => e instanceof HubError && e.status === 404,
      )
    let hub = await alice.create({
      ...profile,
      ownerId: 'bob',
      requestId: randomUUID(),
    })
    assert.equal(hub.ownerId, 'alice')
    assert.equal(
      (await alice.create({ ...profile, requestId: hub.id })).id,
      hub.id,
    )
    assert.equal((await bob.list()).length, 0)
    await denied(bob.get(hub.id))
    await denied(
      bob.change(hub.id, {
        action: 'submit',
        revision: 1,
        approved: true,
        authorised: true,
        photoIds: [],
      }),
    )
    await denied(bob.reserveScan(hub.id))
    assert.equal(await publicHub(db, hub.id), null)
    await assert.rejects(
      alice.change(hub.id, {
        action: 'submit',
        revision: 1,
        approved: true,
        authorised: true,
        photoIds: [],
      }),
      /Generate/,
    )
    hub = await alice.change(hub.id, {
      action: 'trends',
      revision: hub.revision,
      trends,
    })
    hub = await alice.change(hub.id, {
      action: 'generate',
      revision: hub.revision,
      year: new Date().getUTCFullYear(),
    })
    assert.equal(hub.plan?.campaigns.length, 12)
    const data = {contactName:'Owner',contactEmail:'owner@example.test',releaseVersion:RELEASE_VERSION,releaseAccepted:true as const,venuePublications:false,bioPublications:false,
      caption: 'Only selected images go public',
      credit: 'QA',
      hash: 'test-hash',
      bytes: Buffer.from('synthetic bytes'),
    }
    hub = await alice.addPhoto(hub.id, data)
    const photoId = hub.photos[0].id
    assert.equal(await readablePhoto(db, photoId, null), null)
    assert.equal(await readablePhoto(db, photoId, 'bob'), null)
    assert.ok(await readablePhoto(db, photoId, 'alice'))
    hub = await alice.addPhoto(hub.id, data)
    assert.equal(hub.photos.length, 1)
    const other = await bob.create({
      ...profile,
      name: 'Bobs hub',
      requestId: randomUUID(),
    })
    const otherPhoto = await bob.addPhoto(other.id, { ...data, hash: 'bob' })
    await assert.rejects(
      alice.change(hub.id, {
        action: 'submit',
        revision: hub.revision,
        approved: true,
        authorised: true,
        photoIds: [otherPhoto.photos[0].id],
      }),
      /Select only/,
    )
    await assert.rejects(
      alice.change(hub.id, {
        action: 'submit',
        revision: hub.revision,
        approved: false,
        authorised: true,
        photoIds: [],
      }),
      /Confirm/,
    )
    hub = await alice.change(hub.id, {
      action: 'submit',
      revision: hub.revision,
      approved: true,
      authorised: true,
      photoIds: [photoId],
    })
    assert.equal(await publicHub(db, hub.id), null, 'owner approval cannot publish')
    await assert.rejects(alice.change(hub.id, {action:'publish',revision:hub.revision}), /editorial review/)
    const reviewer = reviewService(db, 'reviewer')
    await assert.rejects(reviewService(db, 'bob').list(), /Administrator/)
    const pending = (await reviewer.list()).reviews[0]
    assert.equal(pending.snapshot.photoIds[0], photoId)
    assert.equal((await reviewer.photo(pending.id, photoId)).caption, data.caption)
    await assert.rejects(reviewer.photo(pending.id, otherPhoto.photos[0].id), /Photo not found/)
    await assert.rejects(reviewer.decide(pending.id,{action:'approve',revision:hub.revision,confirmed:false,reason:'Test review'}), /confirm/)
    await reviewer.decide(pending.id,{action:'approve',revision:hub.revision,confirmed:true,reason:'Synthetic fixture: reviewed every entry and selected image.'})
    hub = await alice.get(hub.id)
    await assert.rejects(reviewer.decide(pending.id,{action:'approve',revision:hub.revision,confirmed:true,reason:'Duplicate'}), /already reviewed/)
    const published = await publicHub(db, hub.id)
    assert.equal(published?.profile.name, profile.name)
    assert.equal(
      (await readablePhoto(db, photoId, null))?.caption,
      data.caption,
    )
    await assert.rejects(
      alice.removePhoto(hub.id, photoId, hub.revision),
      /Publish a version/,
    )
    // Rejecting and superseding submissions leave the approved public edition intact.
    hub = await alice.change(hub.id,{action:'submit',revision:hub.revision,approved:true,authorised:true,photoIds:[photoId]})
    let next = (await reviewer.list()).reviews[0]
    await reviewer.decide(next.id,{action:'reject',revision:hub.revision,confirmed:true,reason:'Please clarify the venue story.'})
    hub = await alice.get(hub.id)
    assert.equal(hub.review?.status,'REJECTED')
    assert.equal(hub.review?.reason,'Please clarify the venue story.')
    assert.equal((await publicHub(db, hub.id))?.version,published?.version)
    hub = await alice.change(hub.id,{action:'submit',revision:hub.revision,approved:true,authorised:true,photoIds:[photoId]})
    next = (await reviewer.list()).reviews[0]
    const oldRevision = hub.revision
    hub = await alice.change(hub.id, {
      action: 'save',
      revision: hub.revision,
      profile: { ...profile, name: 'Draft only' },
    })
    assert.equal(hub.plan, null)
    assert.equal(hub.review?.status,'SUPERSEDED')
    assert.equal((await reviewer.list()).reviews.length,0)
    await assert.rejects(reviewer.decide(next.id,{action:'approve',revision:next.revision,confirmed:true,reason:'Stale'}), /changed/)
    await assert.rejects(reviewer.photo(next.id,photoId), /changed/)
    assert.equal((await publicHub(db, hub.id))?.profile.name, profile.name)
    await assert.rejects(
      alice.change(hub.id, { action: 'save', revision: oldRevision, profile }),
      /another tab/,
    )
    await assert.rejects(
      alice.change(hub.id, {
        action: 'submit',
        revision: hub.revision,
        approved: true,
        authorised: true,
        photoIds: [],
      }),
      /Generate/,
    )
    hub = await alice.change(hub.id, {
      action: 'unpublish',
      revision: hub.revision,
    })
    assert.equal(await publicHub(db, hub.id), null)
    assert.equal(await readablePhoto(db, photoId, null), null)
    hub = await alice.removePhoto(hub.id, photoId, hub.revision)
    assert.equal(hub.photos.length, 0)
    for (let i = 0; i < 6; i++) await alice.reserveScan(hub.id)
    await assert.rejects(alice.reserveScan(hub.id), /Six photo/)
    await alice.create({ ...profile, requestId: randomUUID() })
    await alice.create({ ...profile, requestId: randomUUID() })
    await assert.rejects(
      alice.create({ ...profile, requestId: randomUUID() }),
      /Three hubs/,
    )
    // Current database role controls review access, not a remembered session role.
    await pg.exec('UPDATE "User" SET role=\'user\' WHERE id=\'reviewer\'')
    await assert.rejects(reviewer.list(), /Administrator/)
    await pg.exec('UPDATE "User" SET role=\'admin\' WHERE id=\'alice\'')
    hub = await alice.change(hub.id,{action:'generate',revision:hub.revision,year:new Date().getUTCFullYear()})
    hub = await alice.change(hub.id,{action:'submit',revision:hub.revision,approved:true,authorised:true,photoIds:[]})
    assert.equal((await reviewService(db,'alice').list()).reviews.length,0)
    await assert.rejects(reviewService(db,'alice').decide(hub.review!.id,{action:'approve',revision:hub.revision,confirmed:true,reason:'Self approval'}), /Another administrator/)
    const audit = await pg.query<{ action: string; hash: string | null }>(
      'SELECT "action","hash" FROM "WildHubPublication" ORDER BY "createdAt"',
    )
    assert.deepEqual(
      audit.rows.map((r) => r.action),
      ['PUBLISH', 'UNPUBLISH'],
    )
    assert.match(audit.rows[0].hash!, /^[a-f0-9]{64}$/)
  } finally {
    await pg.close()
  }
})
