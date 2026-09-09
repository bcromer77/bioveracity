import { evidenceEligibility } from '../lib/evidence-eligibility'
import 'dotenv/config'
import { indexEvidence } from '../lib/evidence-index'
import { embeddingConfig } from '../lib/evidence-embeddings'
import { evidenceDb, disconnectEvidenceDb } from '../lib/evidence-db'

// ── Configuration semantics ──────────────────────────────────────────
// 1. BIOVERACITY_VECTOR_ENABLED !== 'true'  → intentionally disabled → clean skip (exit 0)
// 2. BIOVERACITY_VECTOR_ENABLED === 'true' but OPENAI_API_KEY missing / model invalid
//    → configuration error → fail (exit 1)
// 3. Fully configured → run multi-batch indexing within runtime + spend limits.

const MAX_RUNTIME_MS = parseInt(process.env.INDEX_MAX_RUNTIME_MS || '50000', 10) // 50 s default (fits hourly cron)
const MAX_CLAIMS    = parseInt(process.env.INDEX_MAX_CLAIMS   || '200', 10)     // spend ceiling per run
const BATCH_SIZE    = 16                                                          // per-batch cap (embed API limit)

async function backlogCount(space: string): Promise<number> {
  const rows = await evidenceDb().$queryRaw<{ count: number }[]>`
    WITH current_documents AS (
      SELECT DISTINCT ON ("documentKey") * FROM "EvidenceDocument"
      ORDER BY "documentKey", "observedAt" DESC, id DESC
    )
    SELECT count(*)::integer AS count
    FROM current_documents d
    JOIN "EvidenceReview" r ON r.id = d."activeReviewId" AND r."documentId" = d.id
    LEFT JOIN "EvidenceEmbedding" e ON e."reviewId" = r.id AND e.space = ${space}
    WHERE ${evidenceEligibility('embedding')} AND e."reviewId" IS NULL
  `
  return rows[0]?.count ?? 0
}

async function main() {
  const vectorEnabled = process.env.BIOVERACITY_VECTOR_ENABLED === 'true'

  // ── Intentionally disabled: clean skip ──
  if (!vectorEnabled) {
    console.log(JSON.stringify({ indexed: 0, skipped: true, reason: 'vector-indexing-disabled' }))
    return
  }

  // ── Enabled but misconfigured: fail ──
  const config = embeddingConfig()
  if (!config) {
    const hasKey = !!process.env.OPENAI_API_KEY
    const model = process.env.BIOVERACITY_EMBEDDING_MODEL || 'text-embedding-3-small'
    console.error(JSON.stringify({
      error: 'vector-config-invalid',
      reason: !hasKey
        ? 'OPENAI_API_KEY is missing while BIOVERACITY_VECTOR_ENABLED=true'
        : `Unsupported embedding model: ${model}`,
    }))
    process.exitCode = 1
    return
  }

  // ── Multi-batch indexing with runtime + spend limits ──
  const started = Date.now()
  let totalIndexed = 0
  let batchNumber = 0
  let lastBusy = false
  let consecutiveErrors = 0
  const MAX_CONSECUTIVE_ERRORS = 3

  while (totalIndexed < MAX_CLAIMS) {
    const elapsed = Date.now() - started
    if (elapsed >= MAX_RUNTIME_MS) {
      console.log(JSON.stringify({ event: 'runtime-limit', elapsed, totalIndexed, batchNumber }))
      break
    }

    const remaining = MAX_CLAIMS - totalIndexed
    const batchLimit = Math.min(BATCH_SIZE, remaining)

    try {
      batchNumber++
      const result = await indexEvidence(batchLimit)

      if (result.busy) {
        lastBusy = true
        console.log(JSON.stringify({ event: 'busy', batchNumber }))
        break // Another worker holds the advisory lock
      }

      consecutiveErrors = 0
      totalIndexed += result.indexed

      if (result.indexed === 0) {
        // Backlog drained — nothing left to index
        break
      }

      console.log(JSON.stringify({ event: 'batch', batchNumber, indexed: result.indexed, totalIndexed }))
    } catch (err) {
      consecutiveErrors++
      console.error(JSON.stringify({
        event: 'batch-error', batchNumber, consecutiveErrors,
        message: err instanceof Error ? err.message : 'unknown',
      }))
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(JSON.stringify({ event: 'abort', reason: 'consecutive-errors', consecutiveErrors, totalIndexed }))
        process.exitCode = 1
        break
      }
      // Brief pause before retry (2 s exponential)
      await new Promise(r => setTimeout(r, 2000 * consecutiveErrors))
    }
  }

  // ── Report backlog ──
  let backlog: number | null = null
  try {
    backlog = await backlogCount(config.space)
  } catch { /* non-fatal */ }

  console.log(JSON.stringify({
    event: 'complete', totalIndexed, batchNumber, busy: lastBusy,
    backlog, elapsed: Date.now() - started,
  }))
}

main().catch((err) => {
  console.error('Evidence indexing failed:', err instanceof Error ? err.message : 'unknown')
  process.exitCode = 1
}).finally(() => disconnectEvidenceDb())
