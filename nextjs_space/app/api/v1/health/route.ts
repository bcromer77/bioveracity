export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getService, jsonResponse, v1Enabled } from '@/lib/v1/http'
import { prisma } from '@/lib/prisma'

// Unauthenticated liveness/readiness probe. Reports whether the platform is
// enabled and whether its datastore is reachable. Never exposes any internal
// detail, credential or connection string.
export async function GET() {
  const service = getService()
  const requestId = service.genId('req')

  let database: 'ok' | 'unavailable' = 'ok'
  try {
    await prisma.$queryRawUnsafe('SELECT 1')
  } catch {
    database = 'unavailable'
  }

  const enabled = v1Enabled()
  const healthy = database === 'ok'
  return jsonResponse(
    {
      object: 'health',
      status: healthy ? 'ok' : 'degraded',
      contract_version: 'v1',
      platform_enabled: enabled,
      dependencies: { database },
      request_id: requestId,
      time: service.nowIso(),
    },
    healthy ? 200 : 503,
    requestId,
  )
}
