import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { Prisma } from '@prisma/client'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { prisma } from '../lib/prisma'
import { embeddingConfig, embedTexts, validVector } from '../lib/evidence-embeddings'
import { retrieveHybrid, searchReviewedEvidence } from '../lib/evidence-search'
import { indexEvidence } from '../lib/evidence-index'

// Entirely synthetic records and vectors; this checks retrieval mechanics, not
// production model quality or real Cambridge/Peterborough source coverage.
const vec = (axis: number) => Array.from({ length: 1536 }, (_, i) => i === axis ? 1 : 0)
const session = { user: { id: 'fixture-user', accessState: 'REGISTERED' }, expires: '2099-01-01' } as any
const fixtureConfig = { key: 'synthetic-key', model: 'text-embedding-3-small', space: 'fixture-space' }

test('embedding provider validates model, dimensions, ordering, finite values and bounds', async () => {
  const provider = (data: unknown, model = fixtureConfig.model) => (async (_url: any, options: any) => {
    assert.equal(options.redirect, 'error')
    assert.equal(JSON.parse(options.body).dimensions, 1536)
    return Response.json({ model, data })
  }) as typeof fetch
  assert.deepEqual(await embedTexts(['a', 'b'], fixtureConfig, provider([{ index: 1, embedding: vec(1) }, { index: 0, embedding: vec(0) }])), [vec(0), vec(1)])
  await assert.rejects(embedTexts(['a'], fixtureConfig, provider([{ index: 0, embedding: vec(0) }], 'wrong-model')))
  await assert.rejects(embedTexts(['a'], fixtureConfig, provider([{ index: 1, embedding: vec(0) }])))
  await assert.rejects(embedTexts(['a'], fixtureConfig, provider([{ index: 0, embedding: [1, 2] }])))
  await assert.rejects(embedTexts(['x'.repeat(8191)], fixtureConfig, provider([])))
  assert.throws(() => validVector(Array(1536).fill(0)))
  assert.throws(() => validVector([Infinity, ...vec(0).slice(1)]))
})

test('registered search, indexing, hybrid SQL and correction lifecycle against PostgreSQL + pgvector', async () => {
  const db = new PGlite({ extensions: { vector } })
  await db.exec(await readFile('prisma/migrations/0001_evidence_pipeline/migration.sql', 'utf8'))
  await db.exec(await readFile('prisma/migrations/0002_evidence_vectors/migration.sql', 'utf8'))
  const original = { query: prisma.$queryRaw, transaction: prisma.$transaction, fetch: global.fetch }
  const env = { enabled: process.env.BIOVERACITY_EVIDENCE_ENABLED, vectors: process.env.BIOVERACITY_VECTOR_ENABLED, key: process.env.OPENAI_API_KEY, model: process.env.BIOVERACITY_EMBEDDING_MODEL }
  process.env.BIOVERACITY_EVIDENCE_ENABLED = 'true'
  process.env.BIOVERACITY_VECTOR_ENABLED = 'true'
  process.env.OPENAI_API_KEY = 'synthetic-test-key'
  process.env.BIOVERACITY_EMBEDDING_MODEL = 'text-embedding-3-small'
  const space = embeddingConfig()!.space
  let calls = 0, sqlCalls = 0, inputs: string[] = []
  global.fetch = (async (_url: any, options: any) => {
    calls++
    const body = JSON.parse(options.body)
    inputs.push(...body.input)
    return Response.json({ model: body.model, data: body.input.map((_: string, index: number) => ({ index, embedding: vec(0) })) })
  }) as typeof fetch
  const query = async (sql: any, ...args: any[]) => {
    sqlCalls++
    const q = sql.text ? sql : Prisma.sql(sql, ...args)
    return (await db.query(q.text, q.values)).rows
  }
  prisma.$queryRaw = query as any
  prisma.$transaction = (async (fn: any) => db.transaction(async tx => {
    const run = async (sql: any, ...args: any[]) => {
      const q = sql.text ? sql : Prisma.sql(sql, ...args)
      return (await tx.query(q.text, q.values)).rows
    }
    return fn({ $queryRaw: run, $executeRaw: run })
  })) as any
  const insert = async (id: string, claim: string, status = 'VERIFIED', key = id, observed = '2026-01-01', authority = 'fixture-a', date: string | null = '2025-12-01', precision = 'day') => {
    await db.query(`INSERT INTO "EvidenceDocument" (id,"documentKey","versionHash","observedAt",url,title,publisher,"authorityId",jurisdiction,"eventDate","eventPrecision","contentKind",sections,status,"activeReviewId") VALUES ($1,$2,$1,$3,'https://example.org/fixture','Synthetic minutes','Synthetic council',$4,'Fixture',$5,$6,'source_excerpt','[]',$7,$8)`, [id,key,observed,authority,date,precision,status,'r-'+id])
    await db.query(`INSERT INTO "EvidenceReview" (id,"documentId",reviewer,claim,excerpt,locator,basis,"evidenceType") VALUES ($1,$2,'PRIVATE-REVIEWER',$3,$3,'Page 1','PRIVATE-REVIEW-NOTES','council_record')`, ['r-'+id,id,claim])
  }
  const embed = (id: string, values = vec(0), modelSpace = space) => db.query(`INSERT INTO "EvidenceEmbedding" ("reviewId",space,embedding) VALUES ($1,$2,$3::vector)`, ['r-'+id,modelSpace,JSON.stringify(values)])
  try {
    await assert.rejects(searchReviewedEvidence(null, { q: 'water' }))
    await assert.rejects(searchReviewedEvidence({ user: {} } as any, { q: 'water' }))
    assert.equal(sqlCalls, 0, 'anonymous requests cannot reach the database')
    assert.equal(calls, 0, 'anonymous requests cannot spend embedding credits')
    await insert('semantic', 'River levels overtopped the banks')
    await insert('lexical', 'Flooding response was discussed')
    await insert('pending', 'PRIVATE pending source', 'PENDING_REVIEW')
    await embed('semantic')
    let result = await searchReviewedEvidence(session, { q: 'flooding' })
    assert.equal(result.mode, 'hybrid')
    assert.equal(result.notice, 'index_pending')
    assert.equal(result.indexed, 1)
    assert.equal(result.eligible, 2)
    assert.equal(result.hits.find(h => h.id === 'semantic')?.matchType, 'meaning', 'retrieves a passage without a keyword match')
    assert.equal(result.hits.find(h => h.id === 'semantic')?.observedAt.toISOString(), '2026-01-01T00:00:00.000Z', 'retrieval timestamps preserve UTC across server timezones')
    assert.equal(result.hits.find(h => h.id === 'lexical')?.matchType, 'keyword')
    assert.ok(!JSON.stringify(result).includes('PRIVATE'))
    assert.ok(!JSON.stringify(result).includes('reviewId'))
    assert.equal((await indexEvidence()).indexed, 1, 'indexes only missing reviewed claim')
    assert.equal((await indexEvidence()).indexed, 0, 'repeat job is idempotent')
    assert.ok(inputs.some(i => i.includes('Flooding response')))
    assert.ok(inputs.every(i => !i.includes('PRIVATE')), 'private source/reviewer notes never sent to provider')
    result = await searchReviewedEvidence(session, { q: 'flooding' })
    assert.equal(result.hits[0].id, 'lexical', 'both channels outrank a single-channel hit')
    assert.equal(result.hits[0].matchType, 'both')

    await insert('updated', 'Unreviewed correction', 'PENDING_REVIEW', 'semantic', '2026-01-02')
    result = await searchReviewedEvidence(session, { q: 'flooding' })
    assert.ok(!result.hits.some(h => h.id === 'semantic'), 'new unreviewed version hides old vector')
    await db.query(`UPDATE "EvidenceDocument" SET status = 'REVOKED', "activeReviewId" = NULL WHERE id = 'lexical'`)
    assert.equal((await searchReviewedEvidence(session, { q: 'flooding' })).hits.length, 0)

    await insert('unknown', 'Reservoir release', 'VERIFIED', 'unknown', '2026-01-03', 'fixture-b', null, 'unknown')
    await insert('coarse', 'Annual water record', 'VERIFIED', 'coarse', '2026-01-03', 'fixture-b', '2025', 'year')
    await embed('unknown'); await embed('coarse')
    assert.equal((await retrieveHybrid('water', 'fixture-a', '', '', space, vec(0))).hits.length, 0)
    assert.equal((await retrieveHybrid('water', 'fixture-b', '2025-01-01', '', space, vec(0))).hits.length, 0)
    assert.equal((await retrieveHybrid('nonesuch', '', '', '', 'other-model-space', vec(0))).hits.length, 0)
    await assert.rejects(searchReviewedEvidence(session, { q: 'water', from: '2026-02-30' }))

    // New review of the same document cannot borrow its predecessor's embedding.
    await db.query(`INSERT INTO "EvidenceReview" (id,"documentId",reviewer,claim,excerpt,locator,basis,"evidenceType") VALUES ('r-new','unknown','private','Amended release statement','Amended release statement','Page 2','private','council_record')`)
    await db.query(`UPDATE "EvidenceDocument" SET "activeReviewId"='r-new' WHERE id='unknown'`)
    assert.ok(!(await retrieveHybrid('nonesuch', '', '', '', space, vec(0))).hits.some(h => h.id === 'unknown'))
    assert.equal((await indexEvidence()).indexed, 1)
    assert.ok((await retrieveHybrid('nonesuch', '', '', '', space, vec(0))).hits.some(h => h.id === 'unknown'))

    global.fetch = (async () => { calls++; throw new Error('synthetic provider failure') }) as typeof fetch
    result = await searchReviewedEvidence(session, { q: 'release' })
    assert.equal(result.mode, 'keyword')
    assert.equal(result.notice, 'unavailable')
    assert.equal(result.hits[0].id, 'unknown')
    await db.query(`UPDATE "EvidenceSearchQuota" SET requests=20, "window"=date_trunc('minute', CURRENT_TIMESTAMP)`)
    const before = calls
    result = await searchReviewedEvidence(session, { q: 'release' })
    assert.equal(result.notice, 'rate_limited')
    assert.equal(calls, before, 'quota blocks provider spend')
    result = await searchReviewedEvidence(session, { q: 'release', mode: 'keyword' })
    assert.equal(result.notice, undefined)
    assert.equal(calls, before, 'explicit keywords never call provider')
    process.env.BIOVERACITY_VECTOR_ENABLED = 'false'
    assert.equal((await searchReviewedEvidence(session, { q: 'release' })).notice, 'unavailable')
    assert.equal(calls, before)
    await insert('early', 'Early release decision', 'VERIFIED', 'early', '2026-01-04', 'fixture-b', '2025-01-01')
    await insert('later', 'Later release decision', 'VERIFIED', 'later', '2026-01-05', 'fixture-b', '2025-09-01')
    result = await searchReviewedEvidence(session, { q: 'release', mode: 'keyword', sort: 'event' })
    assert.deepEqual(result.hits.map(h => h.id), ['early', 'later', 'unknown'])
    process.env.BIOVERACITY_VECTOR_ENABLED = 'true'
    await assert.rejects(indexEvidence(), 'provider failure is a failed job, not successful zero indexing')
    assert.equal((await db.query<{ n: number }>(`SELECT count(*)::integer AS n FROM "EvidenceEmbedding" WHERE "reviewId" IN ('r-early','r-later')`)).rows[0].n, 0, 'failed job does not leave partial vectors')
    process.env.BIOVERACITY_EVIDENCE_ENABLED = 'false'
    await assert.rejects(searchReviewedEvidence(session, { q: 'release' }))
  } finally {
    prisma.$queryRaw = original.query; prisma.$transaction = original.transaction; global.fetch = original.fetch
    for (const [key, value] of Object.entries({ BIOVERACITY_EVIDENCE_ENABLED: env.enabled, BIOVERACITY_VECTOR_ENABLED: env.vectors, OPENAI_API_KEY: env.key, BIOVERACITY_EMBEDDING_MODEL: env.model })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value
    }
    await db.close()
  }
})
