import { receiveEvidence } from '@/lib/evidence-store'
import { handleScotlandPost } from '@/lib/ingest/scotland-pipeline'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  return handleScotlandPost(request, {
    enabled: process.env.SCOTLAND_INGEST_ENABLED,
    secret: process.env.INGEST_CRON_SECRET,
    writeEnabled: process.env.BIOVERACITY_EVIDENCE_ENABLED === 'true' ? process.env.SCOTLAND_INGEST_WRITE_ENABLED : 'false',
    acquisitionApproved: process.env.SCOTLAND_ACQUISITION_APPROVED,
  }, receiveEvidence)
}
