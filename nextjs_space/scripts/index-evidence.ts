import 'dotenv/config'
import { indexEvidence } from '../lib/evidence-index'
import { embeddingConfig } from '../lib/evidence-embeddings'
import { prisma } from '../lib/prisma'

// Adapted for the managed hourly scheduled task: when vector search is not
// configured (BIOVERACITY_VECTOR_ENABLED!=='true', no OPENAI_API_KEY, or an
// unsupported model) this is a clean no-op that exits 0, so the recurring job
// never errors while the feature is dormant. Once vectors are enabled it runs
// the bounded, idempotent, advisory-locked indexing pass.
async function main() {
  if (!embeddingConfig()) {
    console.log(JSON.stringify({ indexed: 0, skipped: true, reason: 'vector-indexing-disabled' }))
    return
  }
  const result = await indexEvidence()
  console.log(JSON.stringify(result))
}

main().catch(() => {
  console.error('Evidence indexing failed; check configuration, database and provider availability. Retry the bounded job.')
  process.exitCode = 1
}).finally(() => prisma.$disconnect())