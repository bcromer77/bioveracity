export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { authenticate, requireScope } from '@/lib/v1/auth'
import { PlatformError, dependencyUnavailable, validationError } from '@/lib/v1/errors'
import { errorResponse, getService, jsonResponse, v1Enabled } from '@/lib/v1/http'
import type { ApiKeyRow, TraceEntry } from '@/lib/v1/service'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const service = getService()
  const requestId = service.genId('req')
  const trace: TraceEntry[] = [{ stage: 'received', at: service.nowIso() }]
  let apiKey: ApiKeyRow | null = null
  const { id } = await params

  try {
    if (!v1Enabled()) throw dependencyUnavailable('The developer platform is not enabled on this deployment.', 'platform_disabled')

    apiKey = await authenticate(service, request.headers)
    trace.push({ stage: 'authenticated', at: service.nowIso() })
    requireScope(apiKey, 'evidence:read')

    if (!id || !id.startsWith('ev_')) throw validationError('Evidence id must be an ev_* identifier.', 'id', 'invalid_id')

    const evidence = await service.getEvidence(apiKey, id)
    if (!evidence) {
      throw new PlatformError(404, 'validation_error', 'not_found', 'No evidence exists with that id for this API key.', 'id')
    }
    trace.push({ stage: 'evidence_id', at: service.nowIso(), detail: evidence.id })

    await service.recordRequest({
      id: requestId, apiKeyId: apiKey.id, mode: apiKey.mode, method: 'GET', path: '/api/v1/evidence/:id',
      status: 200, evidenceId: evidence.id, rawEvidenceId: evidence.raw_evidence_id, trace,
    })
    return jsonResponse({ ...evidence, request_id: requestId }, 200, requestId)
  } catch (err) {
    const platformErr = err instanceof PlatformError ? err : null
    trace.push({ stage: 'error', at: service.nowIso(), detail: platformErr?.code ?? 'internal_error' })
    try {
      await service.recordRequest({
        id: requestId, apiKeyId: apiKey?.id ?? null, mode: apiKey?.mode ?? null, method: 'GET', path: '/api/v1/evidence/:id',
        status: platformErr?.status ?? 500, errorType: platformErr?.type ?? 'api_error', errorCode: platformErr?.code ?? 'internal_error', trace,
      })
    } catch {}
    return errorResponse(err, requestId)
  }
}
