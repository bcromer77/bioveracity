import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { prisma } from '../lib/prisma'
import { searchEvidence } from '../lib/evidence-store'

test('real SQL enforces review, current versions, council filters and honest dates', async () => {
  const db = new PGlite()
  await db.exec(await readFile('prisma/migrations/0001_evidence_pipeline/migration.sql', 'utf8'))
  const original = prisma.$queryRaw
  // Run the application's exact parameterised search SQL against PostgreSQL WASM.
  prisma.$queryRaw = (async (q: any) => (await db.query(q.text, q.values)).rows) as any
  const insert = async (id: string, key: string, status: string, observed: string, eventDate: string | null, precision: string, authority = 'fixture-a') => {
    await db.query(`INSERT INTO "EvidenceDocument" (id,"documentKey","versionHash","observedAt",url,title,publisher,"authorityId",jurisdiction,"eventDate","eventPrecision","contentKind",sections,status,"activeReviewId") VALUES ($1,$2,$1,$3,'https://example.org/source','Fixture flood minutes','Fixture council',$4,'Fixture',$5,$6,'source_excerpt','[]',$7,$8)`, [id,key,observed,authority,eventDate,precision,status,'review-'+id])
    await db.query(`INSERT INTO "EvidenceReview" (id,"documentId",reviewer,claim,excerpt,locator,basis,"evidenceType") VALUES ($1,$2,'fixture-reviewer','Flood investigation agreed','Flood investigation agreed','Page 1','Synthetic test','council_record')`, ['review-'+id,id])
  }
  try {
    await insert('old','source-a','VERIFIED','2026-01-01', '2025-12-01','day')
    await insert('pending','source-b','PENDING_REVIEW','2026-01-02',null,'unknown')
    assert.deepEqual((await searchEvidence('flood')).map(r=>r.id), ['old'])
    await insert('corrected','source-a','PENDING_REVIEW','2026-01-03',null,'unknown')
    assert.equal((await searchEvidence('flood')).length, 0, 'new pending source hides old verified result')
    await insert('reviewed','source-c','VERIFIED','2026-01-04',null,'unknown','fixture-c')
    assert.equal((await searchEvidence('flood', 'fixture-a')).length, 0)
    assert.equal((await searchEvidence('flood', 'fixture-c')).length, 1)
    assert.equal((await searchEvidence('flood', '', '2025-01-01')).length, 0, 'unknown date cannot match date filter')
    await insert('coarse','source-d','VERIFIED','2026-01-05','2025','year')
    assert.equal((await searchEvidence('flood', '', '2025-01-01')).length, 0, 'year date cannot masquerade as day precision')
    assert.equal((await searchEvidence("'; DROP TABLE x; --")).length, 0)
    await db.query(`UPDATE "EvidenceDocument" SET status='REVOKED' WHERE id='reviewed'`)
    assert.equal((await searchEvidence('flood','fixture-c')).length, 0)
  } finally { prisma.$queryRaw = original; await db.close() }
})
