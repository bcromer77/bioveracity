import { evidenceEligibility } from '@/lib/evidence-eligibility'
import type { Session } from 'next-auth'
import { Prisma } from '@prisma/client'
import { evidenceDb } from '@/lib/evidence-db'
import { requireRegistered } from '@/lib/access'
import { evidenceEnabled } from '@/lib/evidence-http'
import { embedTexts, embeddingConfig, validVector } from '@/lib/evidence-embeddings'
import { searchEvidence, validateSearchFilters, type EvidenceHit } from '@/lib/evidence-store'

export type EvidenceQuery = { q?: string; authority?: string; from?: string; to?: string; mode?: string; sort?: string }
export type SearchOutcome = {
  hits: EvidenceHit[]; mode: 'hybrid' | 'keyword' | 'browse';
  notice?: 'unavailable' | 'rate_limited' | 'index_pending';
  indexed?: number; eligible?: number;
}

// Shared server entry point for the page and API. No client-supplied role or vector.
export async function searchReviewedEvidence(session: Session | null, params: EvidenceQuery): Promise<SearchOutcome> {
  requireRegistered(session)
  if (!session?.user?.id) throw new Error('Identified account required')
  if (!evidenceEnabled()) throw new Error('Evidence search is not enabled')
  const { q = '', authority = '', from = '', to = '', mode = 'hybrid', sort = 'relevance' } = params
  validateSearchFilters(q, authority, from, to)
  if (!['hybrid', 'keyword'].includes(mode) || !['relevance', 'event'].includes(sort)) throw new Error('Invalid search mode')
  const keyword = async (notice?: SearchOutcome['notice']): Promise<SearchOutcome> => ({
    hits: chronological(await searchEvidence(q.trim(), authority, from, to), sort),
    mode: q.trim() ? 'keyword' : 'browse', notice,
  })
  if (!q.trim() || mode === 'keyword') return keyword()
  const config = embeddingConfig()
  if (!config) return keyword('unavailable')
  let vector: number[]
  try {
    // Persistent per-account quota works across app processes; no queries are stored.
    const quota = await evidenceDb().$queryRaw<{ requests: number }[]>`
      INSERT INTO "EvidenceSearchQuota" ("userId", "window", requests)
      VALUES (${session.user.id}, date_trunc('minute', CURRENT_TIMESTAMP), 1)
      ON CONFLICT ("userId") DO UPDATE SET
        "window" = EXCLUDED."window",
        requests = CASE WHEN "EvidenceSearchQuota"."window" = EXCLUDED."window" THEN "EvidenceSearchQuota".requests + 1 ELSE 1 END
      WHERE "EvidenceSearchQuota"."window" <> EXCLUDED."window" OR "EvidenceSearchQuota".requests < 20
      RETURNING requests
    `
    if (!quota.length) return keyword('rate_limited')
    vector = (await embedTexts([q.trim()], config))[0]
  } catch { return keyword('unavailable') }
  try {
    const result = await retrieveHybrid(q.trim(), authority, from, to, config.space, vector)
    return { ...result, hits: chronological(result.hits, sort), mode: result.indexed > 0 ? 'hybrid' : 'keyword',
      notice: result.indexed < result.eligible ? 'index_pending' : undefined }
  } catch { return keyword('unavailable') }
}

function chronological(hits: EvidenceHit[], sort: string) {
  // Sort only the retrieved result set, never invent precision for unknown/coarse dates.
  if (sort !== 'event') return hits
  return hits.sort((a, b) => {
    const x = a.eventPrecision === 'day' ? a.eventDate : null
    const y = b.eventPrecision === 'day' ? b.eventDate : null
    return x && y ? x.localeCompare(y) || a.id.localeCompare(b.id) : x ? -1 : y ? 1 : a.id.localeCompare(b.id)
  })
}

// Internal retrieval primitive. One statement chooses current eligible claims,
// ranks both channels, fuses the rankings, and reports actual indexed coverage.
export async function retrieveHybrid(q: string, authority: string, from: string, to: string, space: string, queryVector: number[]) {
  validateSearchFilters(q, authority, from, to)
  const vector = JSON.stringify(validVector(queryVector))
  const rows = await evidenceDb().$queryRaw<{ hits: any[]; indexed: number; eligible: number }[]>(Prisma.sql`
    WITH current_documents AS (
      SELECT DISTINCT ON ("documentKey") * FROM "EvidenceDocument"
      ORDER BY "documentKey", "observedAt" DESC, id DESC
    ), eligible AS MATERIALIZED (
      SELECT d.id, d.title, d.url, d.publisher, d."authorityId", d.jurisdiction,
        d."eventDate", d."eventPrecision", d."publicationDate", d."observedAt" AT TIME ZONE 'UTC' AS "observedAt",
        s.licence, s."requiredAttribution" AS attribution,
        d.sensitivity, d."reusePermission", d."catalogueOnly", d."incomingSensitivity", d."sourceRegisterId", d.status,
        r.id AS "reviewId", r.claim, r.excerpt, r.locator, r."evidenceType", r."createdAt" AT TIME ZONE 'UTC' AS "checkedAt"
      FROM current_documents d JOIN "EvidenceReview" r ON r.id = d."activeReviewId" AND r."documentId" = d.id
      JOIN "EvidenceSourceRegister" s ON s.id = d."sourceRegisterId"
      WHERE ${evidenceEligibility('display')}
        AND (${authority} = '' OR d."authorityId" = ${authority})
        AND (${from} = '' OR (d."eventPrecision" = 'day' AND d."eventDate" >= ${from}))
        AND (${to} = '' OR (d."eventPrecision" = 'day' AND d."eventDate" <= ${to}))
    ), lexical AS (
      SELECT id, row_number() OVER (ORDER BY ts_rank(to_tsvector('english', title || ' ' || publisher || ' ' || claim || ' ' || excerpt), websearch_to_tsquery('english', ${q})) DESC, id) AS rank
      FROM eligible WHERE to_tsvector('english', title || ' ' || publisher || ' ' || claim || ' ' || excerpt) @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank LIMIT 100
    ), semantic AS (
      SELECT d.id, row_number() OVER (ORDER BY e.embedding <=> ${vector}::vector, d.id) AS rank
      FROM eligible d JOIN "EvidenceEmbedding" e ON e."reviewId" = d."reviewId" AND e.space = ${space}
      WHERE ${evidenceEligibility('embedding')}
      ORDER BY rank LIMIT 100
    ), fused AS (
      SELECT COALESCE(l.id, s.id) AS id,
        COALESCE(1.0 / (60 + l.rank), 0) + COALESCE(1.0 / (60 + s.rank), 0) AS score,
        CASE WHEN l.id IS NOT NULL AND s.id IS NOT NULL THEN 'both' WHEN l.id IS NOT NULL THEN 'keyword' ELSE 'meaning' END AS "matchType"
      FROM lexical l FULL OUTER JOIN semantic s ON l.id = s.id
    ), results AS (
      SELECT d.*, f."matchType", f.score FROM fused f JOIN eligible d ON d.id = f.id
      ORDER BY f.score DESC, d.id LIMIT 30
    )
    SELECT COALESCE((SELECT jsonb_agg(to_jsonb(r) - 'reviewId' - 'score' - 'sensitivity' - 'reusePermission' - 'catalogueOnly' - 'incomingSensitivity' - 'sourceRegisterId' - 'status' ORDER BY r.score DESC, r.id) FROM results r), '[]'::jsonb) AS hits,
      (SELECT count(*)::integer FROM eligible) AS eligible,
      (SELECT count(*)::integer FROM eligible d JOIN "EvidenceEmbedding" e ON e."reviewId" = d."reviewId" AND e.space = ${space} WHERE ${evidenceEligibility('embedding')}) AS indexed
  `)
  const result = rows[0]
  return { ...result, hits: result.hits.map(h => ({ ...h, observedAt: new Date(h.observedAt), checkedAt: new Date(h.checkedAt) })) as EvidenceHit[] }
}
