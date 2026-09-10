import { receiveEvidence } from '@/lib/evidence-store'
import { handleRegionalPost } from '@/lib/ingest/regional-pipeline'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(request: Request) {
 return handleRegionalPost(request, {
  enabled: process.env.REGIONAL_INGEST_ENABLED,
  secret: process.env.INGEST_CRON_SECRET,
  writeEnabled: process.env.BIOVERACITY_EVIDENCE_ENABLED === 'true' ? process.env.REGIONAL_INGEST_WRITE_ENABLED : 'false',
  acquisitionApproved: process.env.REGIONAL_ACQUISITION_APPROVED,
 }, receiveEvidence)
}
