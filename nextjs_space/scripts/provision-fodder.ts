/**
 * Idempotent production provisioning for "Fodder in the Woods" (Co. Down).
 *
 * PURPOSE
 *   Give Laura a FINISHED, published Fodder page to take ownership of — never an
 *   empty CMS. This is the tested Fodder content, prepared so it can be created
 *   once, safely, directly against the production database as a controlled
 *   runbook step. It is NOT run automatically and NOT part of the deployed app.
 *
 * SAFE TO RE-RUN
 *   Every write is an upsert keyed on a stable id. Nothing is ever deleted.
 *   Re-running refreshes the owner-supplied content and re-attaches ownership;
 *   it never removes real visitor observations and never duplicates rows.
 *
 * LAURA'S ACCOUNT
 *   Her user is ensured by email with NO password (she signs in with Google).
 *   If her account already exists it is left untouched (update: {}). We only
 *   ever set the hub's ownerId to her user — we never modify her account.
 *
 * TOGGLES (env)
 *   FODDER_OWNER_EMAIL   default laura@fodderni.com
 *   FODDER_OWNER_NAME    default Laura
 *   FODDER_PUBLISH       default on; set 0 to provision as an unpublished draft
 *   FODDER_SEED_SAMPLE_CONTRIBUTIONS
 *                        default on; set 0 to start with an EMPTY visitor
 *                        journal (only Laura's own content, no sample sightings)
 *
 * RUN (from nextjs_space, against the intended DATABASE_URL)
 *   yarn tsx scripts/provision-fodder.ts
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const prisma = new PrismaClient()

const HUB_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const OWNER_EMAIL = process.env.FODDER_OWNER_EMAIL || 'laura@fodderni.com'
const OWNER_NAME = process.env.FODDER_OWNER_NAME || 'Laura'
const PUBLISH = process.env.FODDER_PUBLISH !== '0'
const SEED_SAMPLE = process.env.FODDER_SEED_SAMPLE_CONTRIBUTIONS !== '0'
const ASSETS = join(process.cwd(), 'scripts', 'fodder-assets')

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
const img = (name: string) => readFileSync(join(ASSETS, name))

// Stable ids so re-running upserts the SAME rows rather than duplicating them.
const PHOTO = {
  pano: '0f1e2d3c-4b5a-4690-8172-a1b2c3d4e5f6',
  g1: '1a2b3c4d-5e6f-4701-8213-b2c3d4e5f6a7',
  g2: '2b3c4d5e-6f70-4812-8324-c3d4e5f6a7b8',
  g3: '3c4d5e6f-7081-4923-8435-d4e5f6a7b8c9',
  g4: '4d5e6f70-8192-4a34-8546-e5f6a7b8c9d0',
}
const CONTRIB = {
  garlic: 'c1000000-0000-4000-8000-000000000001',
  treecreeper: 'c1000000-0000-4000-8000-000000000002',
  unknown: 'c1000000-0000-4000-8000-000000000003',
  bracket: 'c1000000-0000-4000-8000-000000000004',
  marten: 'c1000000-0000-4000-8000-000000000005',
  ramsons: 'c1000000-0000-4000-8000-000000000006',
}

const profile = {
  name: 'Fodder in the Woods',
  county: 'down',
  kind: 'attraction',
  story:
    'Tucked into Finnebrogue Woods in County Down, Fodder in the Woods is a place to slow down and notice. Old oak and hazel, a quiet stream, and light that changes with the season. We keep a living field journal here — a record of what visitors have paused to notice through the year, kept with care and never dressed up as more than it is.',
  website: 'https://www.fodderni.com',
  interests: ['nature', 'food'],
}

const plan = {
  year: 2026,
  generatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  basis: 'editorial-calendar',
  campaigns: [
    { month: 3, title: 'The woods wake up', introduction: 'Wild garlic carpets the stream bank and the first warblers return.', activity: 'Walk the lower path early and listen for birdsong before the day warms.', caption: 'First green of the year along the stream.', planningNote: '' },
    { month: 5, title: 'Long light, full canopy', introduction: 'The canopy closes over and the woodland floor settles into shade.', activity: 'Look for movement in the dead wood — beetles, fungi, small mammals.', caption: 'The canopy closes for summer.', planningNote: '' },
    { month: 9, title: 'The turning', introduction: 'Berries ripen and the first leaves colour at the wood edge.', activity: 'Sit a while by the old oak and watch what comes and goes.', caption: 'Autumn arrives at the wood edge.', planningNote: '' },
    { month: 11, title: 'Bare branches, clear views', introduction: 'With the leaves down, the shape of the wood returns.', activity: 'Follow the stream and notice the tracks left in soft ground.', caption: 'The wood laid bare for winter.', planningNote: '' },
  ],
  sources: [],
  trend: null,
  suggestedLeadMonth: 9,
}

type PhotoSeed = {
  id: string
  file: string
  caption: string
  kind: 'panorama' | 'photo'
  meta: unknown | null
}
const photoSeeds: PhotoSeed[] = [
  { id: PHOTO.pano, file: 'teepees_farmshop.jpg', caption: 'A view across the clearing at Fodder in the Woods', kind: 'panorama', meta: { points: [ { x: 34, y: 55, kind: 'look-closer', label: 'The teepees' }, { x: 12, y: 58, kind: 'seen-something', label: 'The farm shop' } ] } },
  { id: PHOTO.g1, file: 'dusk_teepees.jpg', caption: 'The clearing at dusk, lanterns lit', kind: 'photo', meta: null },
  { id: PHOTO.g2, file: 'farmshop_sign.jpg', caption: 'The farm shop, tucked in the trees', kind: 'photo', meta: null },
  { id: PHOTO.g3, file: 'interior_dining.jpg', caption: 'Long tables under canvas', kind: 'photo', meta: null },
  { id: PHOTO.g4, file: 'lantern_winter.jpg', caption: 'A lantern against the winter woods', kind: 'photo', meta: null },
]

const d = (m: number, day: number) => new Date(Date.UTC(2026, m - 1, day, 10, 0, 0))
type ContribSeed = {
  id: string
  file: string
  broadCategory: string
  whatYouThink: string
  note: string
  observedAt: Date
  coarseLocation: string
  permissionToPublish: boolean
  publicationStatus: 'PUBLISHED' | 'PENDING'
  sensitiveHidden?: boolean
}
// Categories use the canonical CONTRIBUTION_CATEGORIES values (bird, mammal,
// plant, fungi, unknown, …) so each entry shows its correct plain-language label.
const contribSeeds: ContribSeed[] = [
  { id: CONTRIB.garlic, file: 'photo_A.jpg', broadCategory: 'plant', whatYouThink: 'Wild garlic just coming through', note: '', observedAt: d(3, 14), coarseLocation: 'Along the stream bank', permissionToPublish: true, publicationStatus: 'PUBLISHED' },
  { id: CONTRIB.treecreeper, file: 'photo_B.jpg', broadCategory: 'bird', whatYouThink: 'A treecreeper working up the oak', note: '', observedAt: d(5, 2), coarseLocation: 'Near the old oak', permissionToPublish: true, publicationStatus: 'PUBLISHED', sensitiveHidden: true },
  { id: CONTRIB.unknown, file: 'photo_C.jpg', broadCategory: 'unknown', whatYouThink: 'Not sure — something small crossed the path', note: '', observedAt: d(9, 17), coarseLocation: 'Lower path', permissionToPublish: true, publicationStatus: 'PUBLISHED' },
  { id: CONTRIB.bracket, file: 'photo_D.jpg', broadCategory: 'fungi', whatYouThink: 'A cluster of bracket fungus on a fallen trunk', note: 'Saw it on the morning walk', observedAt: d(11, 3), coarseLocation: 'By the dead wood', permissionToPublish: true, publicationStatus: 'PENDING' },
  { id: CONTRIB.marten, file: 'photo_A.jpg', broadCategory: 'mammal', whatYouThink: 'Think I saw a pine marten at dusk', note: '', observedAt: d(9, 22), coarseLocation: 'Wood edge', permissionToPublish: true, publicationStatus: 'PENDING' },
  { id: CONTRIB.ramsons, file: 'photo_B.jpg', broadCategory: 'plant', whatYouThink: 'Ramsons in flower', note: '', observedAt: d(5, 9), coarseLocation: 'The stream bank', permissionToPublish: false, publicationStatus: 'PENDING' },
]

async function main() {
  console.log(`\n── Provision Fodder in the Woods ──`)
  console.log(`   owner   : ${OWNER_EMAIL} (${OWNER_NAME}) — no password (Google sign-in)`)
  console.log(`   publish : ${PUBLISH ? 'yes' : 'no (draft only)'}`)
  console.log(`   journal : ${SEED_SAMPLE ? 'seed sample observations' : 'empty (owner content only)'}`)

  // 1) Ensure owner. No password is ever set. An existing account is untouched.
  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {},
    create: { email: OWNER_EMAIL, name: OWNER_NAME, role: 'user' },
    select: { id: true, email: true },
  })
  console.log(`   ✓ owner user ensured (${owner.email})`)

  // 2) Ensure the hub and attach ownership. Never clobber published/contribCount here.
  await prisma.wildHub.upsert({
    where: { id: HUB_ID },
    update: { ownerId: owner.id, profile, plan },
    create: { id: HUB_ID, ownerId: owner.id, profile, plan, revision: 2 },
  })
  console.log(`   ✓ hub ensured and ownership attached to ${owner.email}`)

  // 3) Upsert owner photos (panorama + gallery) by stable id.
  for (const p of photoSeeds) {
    const bytes = img(p.file)
    await prisma.wildHubPhoto.upsert({
      where: { id: p.id },
      update: { caption: p.caption, credit: 'Fodder in the Woods', hash: sha(bytes), bytes, kind: p.kind, meta: p.meta as any },
      create: { id: p.id, hubId: HUB_ID, caption: p.caption, credit: 'Fodder in the Woods', hash: sha(bytes), bytes, kind: p.kind, meta: p.meta as any },
    })
  }
  console.log(`   ✓ ${photoSeeds.length} owner photos upserted`)

  // 4) Sample visitor observations (optional). Every one is a community
  //    observation; publication status is preset only to show a finished,
  //    living journal. evidenceClass is fixed — publication never changes it.
  if (SEED_SAMPLE) {
    for (const c of contribSeeds) {
      const bytes = img(c.file)
      const common = {
        hubId: HUB_ID,
        photoBytes: bytes,
        photoHash: `${sha(bytes)}-${c.id.slice(0, 8)}`,
        broadCategory: c.broadCategory,
        whatYouThink: c.whatYouThink,
        note: c.note,
        observedAt: c.observedAt,
        coarseLocation: c.coarseLocation,
        permissionToPublish: c.permissionToPublish,
        publicationStatus: c.publicationStatus,
        sensitiveHidden: c.sensitiveHidden ?? false,
        evidenceClass: 'community-observation',
      }
      await prisma.wildContribution.upsert({
        where: { id: c.id },
        update: common,
        create: { id: c.id, ...common },
      })
    }
    console.log(`   ✓ ${contribSeeds.length} sample observations upserted`)
  } else {
    console.log(`   – sample observations skipped (empty journal)`)
  }

  // 5) Publish (write the public snapshot) unless provisioning a draft.
  if (PUBLISH) {
    const published = {
      profile,
      plan,
      photoIds: photoSeeds.map((p) => p.id),
      approvedAt: new Date().toISOString(),
      version: 1,
    }
    await prisma.wildHub.update({ where: { id: HUB_ID }, data: { published } })
    console.log(`   ✓ published (public snapshot written)`)
  } else {
    console.log(`   – not published (draft only)`)
  }

  // 6) Recompute contribCount from the actual rows.
  const n = await prisma.wildContribution.count({ where: { hubId: HUB_ID } })
  await prisma.wildHub.update({ where: { id: HUB_ID }, data: { contribCount: n } })

  console.log(`\n✅ Fodder provisioned. hub=${HUB_ID} owner=${owner.email} contributions=${n} published=${PUBLISH}\n`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
