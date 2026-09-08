import { evidenceEligibility } from '@/lib/evidence-eligibility'
import { Prisma } from '@prisma/client'
import { evidenceDb } from '@/lib/evidence-db'
import { embedTexts, embeddingConfig } from '@/lib/evidence-embeddings'

// Repeated bounded runs automatically pick up newly reviewed claims and corrections.
// No raw research text, reviewer identity or unapproved claim is sent to the provider.
export async function indexEvidence(limit = 16) {
  const config = embeddingConfig()
  if (!config) throw new Error('Vector indexing is not configured')
  if (!Number.isInteger(limit) || limit < 1 || limit > 16) throw new Error('Batch limit must be 1–16')
  return evidenceDb().$transaction(async tx => {
    const locks = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('bioveracity-evidence-index')) AS locked`
    if (!locks[0]?.locked) return { indexed: 0, busy: true }
    const rows = await tx.$queryRaw<{ id: string; claim: string; excerpt: string }[]>(Prisma.sql`
      WITH current_documents AS (
        SELECT DISTINCT ON ("documentKey") * FROM "EvidenceDocument"
        ORDER BY "documentKey", "observedAt" DESC, id DESC
      )
      SELECT r.id, r.claim, r.excerpt FROM current_documents d
      JOIN "EvidenceReview" r ON r.id = d."activeReviewId" AND r."documentId" = d.id
      LEFT JOIN "EvidenceEmbedding" e ON e."reviewId" = r.id AND e.space = ${config.space}
      WHERE ${evidenceEligibility('embedding')} AND e."reviewId" IS NULL
      ORDER BY r."createdAt", r.id LIMIT ${limit}
    `)
    if (!rows.length) return { indexed: 0, busy: false }
    const vectors = await embedTexts(rows.map(r => `${r.claim}\n${r.excerpt}`), config)
    for (let i = 0; i < rows.length; i++) {
      // Immutable review identity prevents an in-flight embedding from attaching to
      // a corrected claim. Search rechecks current version/status on every request.
      await tx.$executeRaw`INSERT INTO "EvidenceEmbedding" ("reviewId", space, embedding)
        VALUES (${rows[i].id}, ${config.space}, ${JSON.stringify(vectors[i])}::vector)
        ON CONFLICT ("reviewId", space) DO NOTHING`
    }
    return { indexed: rows.length, busy: false }
  }, { timeout: 25000, maxWait: 5000 })
}
