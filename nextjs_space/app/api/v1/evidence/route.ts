export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { authenticate, requireScope } from '@/lib/v1/auth'
import { parseEvidenceCreate } from '@/lib/v1/contract'
import { PlatformError, dependencyUnavailable, rateLimitError, validationError } from '@/lib/v1/errors'
import { errorResponse, getService, jsonResponse, v1Enabled } from '@/lib/v1/http'
import { defaultLimiter } from '@/lib/v1/ratelimit'
import type { ApiKeyRow, TraceEntry } from '@/lib/v1/service'

const MAX_BYTES = 262_144 // 256 KiB request-size limit

// Read the body under a hard byte ceiling, then JSON-parse it.
async function boundedBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) throw validationError('A JSON request body is required.', 'body')
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > MAX_BYTES) {
      await reader.cancel()
      throw new PlatformError(413, 'validation_error', 'request_too_large', 'Request body exceeds the 256 KiB limit.')
    }
    chunks.push(value)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw validationError('Request body is not valid JSON.', 'body')
  }
}

export async function POST(request: Request) {
  const service = getService()
  const requestId = service.genId('req')
  const trace: TraceEntry[] = [{ stage: 'received', at: service.nowIso() }]
  let apiKey: ApiKeyRow | null = null
  let idempotencyKey: string | null = null

  try {
    if (!v1Enabled()) throw dependencyUnavailable('The developer platform is not enabled on this deployment.', 'platform_disabled')

    idempotencyKey = request.headers.get('idempotency-key')?.trim() || null

    apiKey = await authenticate(service, request.headers)
    trace.push({ stage: 'authenticated', at: service.nowIso() })
    requireScope(apiKey, 'evidence:write')

    if (!defaultLimiter.check(apiKey.id)) throw rateLimitError()

    const rawBody = await boundedBody(request)
    const body = parseEvidenceCreate(rawBody)
    trace.push({ stage: 'validated', at: service.nowIso() })

    const { evidence, replayed } = await service.createEvidence({ apiKey, body, rawBody, idempotencyKey, requestId })
    trace.push({ stage: 'raw_persisted', at: service.nowIso(), detail: evidence.raw_evidence_id })
    trace.push({ stage: 'evidence_id', at: service.nowIso(), detail: evidence.id })
    trace.push({ stage: replayed ? 'replayed' : 'processing', at: service.nowIso(), detail: evidence.processing_status })

    const status = replayed ? 200 : 201
    await service.recordRequest({
      id: requestId, apiKeyId: apiKey.id, mode: apiKey.mode, method: 'POST', path: '/api/v1/evidence',
      status, evidenceId: evidence.id, rawEvidenceId: evidence.raw_evidence_id, idempotencyKey, trace,
    })
    return jsonResponse({ ...evidence, request_id: requestId, replayed }, status, requestId)
  } catch (err) {
    const platformErr = err instanceof PlatformError ? err : null
    trace.push({ stage: 'error', at: service.nowIso(), detail: platformErr?.code ?? 'internal_error' })
    // Best-effort audit; a logging failure must not mask the original error.
    try {
      await service.recordRequest({
        id: requestId, apiKeyId: apiKey?.id ?? null, mode: apiKey?.mode ?? null, method: 'POST', path: '/api/v1/evidence',
        status: platformErr?.status ?? 500, errorType: platformErr?.type ?? 'api_error', errorCode: platformErr?.code ?? 'internal_error',
        idempotencyKey, trace,
      })
    } catch {}
    return errorResponse(err, requestId)
  }
}

export async function GET() {
  return jsonResponse(
    { error: { type: 'validation_error', code: 'method_not_allowed', message: 'Use POST to create evidence, or GET /api/v1/evidence/:id to retrieve it.' } },
    405,
    'req_none',
  )
}
