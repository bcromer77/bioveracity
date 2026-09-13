import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { prisma } from '../lib/prisma'
import { validateEvidence, validateReview } from '../lib/evidence-contract'
import { searchEvidence } from '../lib/evidence-store'

// No production connection or embedding calls. Permission/reviewer decisions
// below are explicitly synthetic, to exercise the existing search gates.
test('Rosslare packet survives the actual contract and reviewed keyword search gates', async () => {
  assert.ok(!process.env.EVIDENCE_DATABASE_URL, 'Run with isolated evidence configuration only')
  assert.notEqual(process.env.NODE_ENV, 'production')
  const packet = JSON.parse(await readFile('../data/ports/rosslare-ore-commitments.seed.json', 'utf8'))
  const records = packet.records.map(validateEvidence)
  assert.equal(records.length, 10)
  assert.equal(new Set(records.map((r: ReturnType<typeof validateEvidence>) => r.documentKey)).size, 10)
  assert.equal(packet.source_registration_draft.permittedUses, '')
  assert.equal(packet.review_candidates.some((r: Record<string, unknown>) => r.sourceChecked || r.publicationPermitted), false)
  assert.ok(records.every((r: ReturnType<typeof validateEvidence>) => r.content.event_date === null && r.content.publication_date === null))
  assert.ok(packet.commitments.every((c: { state: string }) => c.state === 'APPLICANT_COMMITMENT_IMPLEMENTATION_UNVERIFIED'))
  const repeat = packet.records.map(validateEvidence)
  assert.deepEqual(records.map((r: ReturnType<typeof validateEvidence>) => r.versionHash), repeat.map((r: ReturnType<typeof validateEvidence>) => r.versionHash))

  const db = new PGlite()
  const originalQuery = prisma.$queryRaw
  try {
    for (const migration of ['0001_evidence_pipeline', '0003_biodiversity_safeguards']) {
      await db.exec(await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8'))
    }
    // Execute the application's real parameterised SQL against an in-memory
    // PostgreSQL database. No connection to an application DB is made.
    prisma.$queryRaw = (async (q: { text: string; values: unknown[] }) =>
      (await db.query(q.text, q.values)).rows) as typeof prisma.$queryRaw
    for (const [i, record] of records.entries()) {
      const c = record.content
      const proposal = packet.review_candidates[i]
      assert.equal(proposal.representation_id, c.representation_id)
      assert.throws(() => validateReview(proposal, c.sections), 'Proposal must not authenticate itself')
      const review = validateReview({ ...proposal, sourceChecked: true, claimSupported: true, publicationPermitted: true }, c.sections)
      assert.throws(() => validateReview({ ...proposal, sourceChecked: true, claimSupported: true, publicationPermitted: true, excerpt: 'Invented supporting passage' }, c.sections))
      await db.query(`INSERT INTO "EvidenceDocument" (id,"documentKey","versionHash","observedAt",url,title,publisher,"authorityId",jurisdiction,"eventDate","eventPrecision","publicationDate","contentKind",sections,status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,'unknown',NULL,$10,$11,'PENDING_REVIEW')`,
        [String(i),record.documentKey,record.versionHash,record.observedAt,c.url,c.title,c.publisher,c.authority_id,c.jurisdiction,c.content_kind,JSON.stringify(c.sections)])
      await db.query(`INSERT INTO "EvidenceReview" (id,"documentId",reviewer,claim,excerpt,locator,basis,"evidenceType") VALUES ($1,$2,'SYNTHETIC-TEST-REVIEWER',$3,$4,$5,'Synthetic review only',$6)`,
        ['review-'+i,String(i),review.claim,review.excerpt,review.locator,review.evidenceType])
    }
    assert.equal((await searchEvidence('Rosslare')).length, 0, 'Pending records are not searchable')
    await db.exec(`UPDATE "EvidenceDocument" SET status='VERIFIED', "activeReviewId"='review-' || id`)
    assert.equal((await searchEvidence('Rosslare')).length, 0, 'A checked claim does not imply source permission')
    await db.exec(`INSERT INTO "EvidenceSourceRegister" (id,publisher,"datasetIdentifier",licence,"requiredAttribution","permittedUses") VALUES ('qa','TEST ONLY','synthetic-review','TEST ONLY - no real rights granted','Synthetic QA only','display')`)
    await db.exec(`UPDATE "EvidenceDocument" SET sensitivity='PUBLIC', "reusePermission"='PERMITTED', "sourceRegisterId"='qa'`)
    const all = await searchEvidence('Rosslare')
    assert.equal(all.length, 10)
    assert.ok(all.every(h => h.claim.includes('Applicant proposes:') && h.claim.includes('Implementation unverified.')))
    assert.ok(all.every(h => h.eventDate === null && h.eventPrecision === 'unknown' && h.url === packet.records[0].url))
    const turbidity = await searchEvidence('Rosslare turbidity')
    assert.equal(turbidity.length, 1)
    assert.match(turbidity[0].locator, /section 4\.2\.3, printed page 14, PDF page 18/)
    assert.equal((await searchEvidence('Rosslare concrete')).length, 1)
    assert.equal((await searchEvidence('Rosslare wastewater')).length, 1)
    assert.equal((await searchEvidence('Rosslare', 'another-project')).length, 0)
    assert.equal((await searchEvidence('Rosslare', '', '2025-01-01')).length, 0, 'Planned measures do not gain fabricated implementation dates')
    await db.exec(`UPDATE "EvidenceDocument" SET sensitivity='RESTRICTED' WHERE id='0'`)
    assert.equal((await searchEvidence('Rosslare turbidity')).length, 0)
    await db.exec(`UPDATE "EvidenceSourceRegister" SET "permittedUses"=''`)
    assert.equal((await searchEvidence('Rosslare')).length, 0, 'Source withdrawal removes all hits')
  } finally {
    prisma.$queryRaw = originalQuery
    await db.close()
  }
})
