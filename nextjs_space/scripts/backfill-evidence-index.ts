import 'dotenv/config'
/**
 * One-time backfill: indexes ALL verified claims that are missing embeddings.
 * Uses the same multi-batch runner as the hourly job, but with higher limits.
 *
 * Usage:  yarn tsx --require dotenv/config scripts/backfill-evidence-index.ts
 *
 * Environment overrides:
 *   BACKFILL_MAX_RUNTIME_MS  — default 300000 (5 min)
 *   BACKFILL_MAX_CLAIMS      — default 5000
 *
 * Safe to run repeatedly (idempotent: ON CONFLICT DO NOTHING in the library).
 * Respects the advisory lock: if the hourly job is running, a batch will report busy
 * and the backfill retries after a short pause.
 */
import { indexEvidence } from '../lib/evidence-index'
import { embeddingConfig } from '../lib/evidence-embeddings'
import { prisma } from '../lib/prisma'

const MAX_RUNTIME_MS = parseInt(process.env.BACKFILL_MAX_RUNTIME_MS || '300000', 10)
const MAX_CLAIMS    = parseInt(process.env.BACKFILL_MAX_CLAIMS   || '5000', 10)
const BATCH_SIZE    = 16

async function main() {
  const config = embeddingConfig()
  if (!config) {
    console.error('Vector search not configured. Set BIOVERACITY_VECTOR_ENABLED=true, OPENAI_API_KEY, and optionally BIOVERACITY_EMBEDDING_MODEL.')
    process.exitCode = 1
    return
  }

  const started = Date.now()
  let totalIndexed = 0
  let batchNumber = 0
  let busyRetries = 0

  console.log(JSON.stringify({ event: 'backfill-start', maxRuntime: MAX_RUNTIME_MS, maxClaims: MAX_CLAIMS }))

  while (totalIndexed < MAX_CLAIMS && Date.now() - started < MAX_RUNTIME_MS) {
    try {
      batchNumber++
      const remaining = Math.min(BATCH_SIZE, MAX_CLAIMS - totalIndexed)
      const result = await indexEvidence(remaining)

      if (result.busy) {
        busyRetries++
        if (busyRetries > 10) {
          console.log(JSON.stringify({ event: 'backfill-abort', reason: 'persistent-lock', totalIndexed }))
          break
        }
        await new Promise(r => setTimeout(r, 3000))
        continue
      }
      busyRetries = 0
      totalIndexed += result.indexed

      if (result.indexed === 0) {
        console.log(JSON.stringify({ event: 'backfill-complete', totalIndexed, batchNumber, elapsed: Date.now() - started }))
        return
      }

      if (batchNumber % 10 === 0) {
        console.log(JSON.stringify({ event: 'backfill-progress', totalIndexed, batchNumber, elapsed: Date.now() - started }))
      }
    } catch (err) {
      console.error(JSON.stringify({ event: 'backfill-batch-error', batchNumber, message: err instanceof Error ? err.message : 'unknown' }))
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  console.log(JSON.stringify({ event: 'backfill-done', totalIndexed, batchNumber, elapsed: Date.now() - started }))
}

main().catch(err => {
  console.error('Backfill failed:', err instanceof Error ? err.message : 'unknown')
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
