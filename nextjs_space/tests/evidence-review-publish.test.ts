import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { validateReview } from '../lib/evidence-contract'
import { reviewOutcomeMessage } from '../lib/evidence-review-message'
import { prisma } from '../lib/prisma'
import { searchEvidence } from '../lib/evidence-store'

const sections = [{ locator: 'Page 2', text: 'The council agreed to investigate flooding.' }]
const baseReview = {
  sourceChecked: true, claimSupported: true, publicationPermitted: true,
  claim: 'The council agreed to investigate flooding.', excerpt: sections[0].text,
  locator: 'Page 2', basis: 'Checked the stated decision against page 2.', evidenceType: 'council_record',
}

// Regression for the review-to-publish defect: the review form used to send only
// sourceChecked/claimSupported/publicationPermitted and NEVER the publish decision
// fields, so every reviewed record stayed UNKNOWN and was silently excluded from
// search while the UI claimed it was “now searchable”.
test('a review WITHOUT publish fields cannot make a record public/searchable', () => {
  const r = validateReview(baseReview, sections)
  assert.equal(r.publish, false, 'publish must default OFF when the field is absent')
  assert.equal(r.requestedSensitivity, 'UNKNOWN')
  assert.equal(r.requestedReuse, 'UNKNOWN')
})

test('an explicit publish decision requests the PUBLIC/PERMITTED searchable combination', () => {
  const r = validateReview({ ...baseReview, publish: true, publishSensitivity: 'PUBLIC', publishReuse: 'PERMITTED' }, sections)
  assert.equal(r.publish, true)
  assert.equal(r.requestedSensitivity, 'PUBLIC')
  assert.equal(r.requestedReuse, 'PERMITTED')
})

// Regression for the false success message: a 200 response must never claim the
// claim is searchable unless the record was actually published.
test('outcome message never claims searchable unless actually published', () => {
  const published = reviewOutcomeMessage({ published: true, publishRequested: true, publishBlockedReason: null })
  assert.match(published, /eligible for registered search/)

  const notRequested = reviewOutcomeMessage({ published: false, publishRequested: false, publishBlockedReason: 'not-requested' })
  assert.match(notRequested, /not published to search/i)
  assert.doesNotMatch(notRequested, /now (eligible|searchable)/i)

  const blocked = reviewOutcomeMessage({ published: false, publishRequested: true, publishBlockedReason: 'catalogue-only' })
  assert.match(blocked, /NOT published to search/)
  assert.match(blocked, /catalogue reference only/)
  assert.doesNotMatch(blocked, /is now eligible for registered search/)

  const unknownReason = reviewOutcomeMessage({ published: false, publishRequested: true, publishBlockedReason: 'something-new' })
  assert.match(unknownReason, /NOT published to search/)
})

// End-to-end eligibility consequence against the real search SQL: a VERIFIED
// record left UNKNOWN (the state a review-without-publish produces) is excluded;
// only the PUBLIC/PERMITTED + licensed-register combination is returned.
test('verified-but-unpublished records are excluded from search; only published appear', async () => {
  // searchEvidence() reads through evidenceDb(), which uses the dedicated client
  // only when EVIDENCE_DATABASE_URL is set. Force the shared-client fallback so the
  // prisma.$queryRaw monkeypatch below routes to PGlite regardless of how the test
  // is invoked (e.g. with .env sourced). Restored in finally.
  const savedEvidenceUrl = process.env.EVIDENCE_DATABASE_URL
  delete process.env.EVIDENCE_DATABASE_URL
  const db = new PGlite()
  await db.exec(await readFile('prisma/migrations/0001_evidence_pipeline/migration.sql', 'utf8'))
  await db.exec(await readFile('prisma/migrations/0003_biodiversity_safeguards/migration.sql', 'utf8'))
  await db.exec(`INSERT INTO "EvidenceSourceRegister" (id,publisher,"datasetIdentifier",licence,"requiredAttribution","permittedUses") VALUES ('fixture-source','Fixture','synthetic','CC0','Synthetic fixture only','display,embedding')`)
  const original = prisma.$queryRaw
  prisma.$queryRaw = (async (q: any) => (await db.query(q.text, q.values)).rows) as any
  const insertVerified = async (id: string, key: string) => {
    await db.query(`INSERT INTO "EvidenceDocument" (id,"documentKey","versionHash","observedAt",url,title,publisher,"authorityId",jurisdiction,"eventDate","eventPrecision","contentKind",sections,status,"activeReviewId") VALUES ($1,$2,$1,'2026-01-01','https://example.org/source','Fixture flood minutes','Fixture council','fixture-a','Fixture',null,'unknown','source_excerpt','[]','VERIFIED',$3)`, [id, key, 'review-' + id])
    await db.query(`INSERT INTO "EvidenceReview" (id,"documentId",reviewer,claim,excerpt,locator,basis,"evidenceType") VALUES ($1,$2,'fixture-reviewer','Flood investigation agreed','Flood investigation agreed','Page 1','Synthetic test','council_record')`, ['review-' + id, id])
  }
  try {
    // Verified but left UNKNOWN (no publish decision applied) => not searchable.
    await insertVerified('unpublished', 'source-a')
    assert.equal((await searchEvidence('flood')).length, 0, 'verified-but-unpublished record must not appear in search')

    // Apply the publish transition (PUBLIC/PERMITTED + licensed register) => searchable.
    await db.query(`UPDATE "EvidenceDocument" SET sensitivity='PUBLIC', "reusePermission"='PERMITTED', "sourceRegisterId"='fixture-source' WHERE id='unpublished'`)
    assert.deepEqual((await searchEvidence('flood')).map(r => r.id), ['unpublished'], 'published record must appear in search')

    // Catalogue-only can never be searchable even if flags were set.
    await insertVerified('catalogue', 'source-b')
    await db.query(`UPDATE "EvidenceDocument" SET sensitivity='PUBLIC', "reusePermission"='PERMITTED', "sourceRegisterId"='fixture-source', "catalogueOnly"=true WHERE id='catalogue'`)
    assert.equal((await searchEvidence('flood')).some(r => r.id === 'catalogue'), false, 'catalogue-only record must never be searchable')
  } finally {
    prisma.$queryRaw = original
    await db.close()
    if (savedEvidenceUrl === undefined) delete process.env.EVIDENCE_DATABASE_URL
    else process.env.EVIDENCE_DATABASE_URL = savedEvidenceUrl
  }
})
