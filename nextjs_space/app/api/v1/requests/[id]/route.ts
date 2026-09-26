export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { authenticate } from '@/lib/v1/auth'
import { PlatformError, dependencyUnavailable, validationError } from '@/lib/v1/errors'
import { errorResponse, getService, jsonResponse, v1Enabled } from '@/lib/v1/http'
import type { ApiKeyRow } from '@/lib/v1/service'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const service = getService()
  const requestId = service.genId('req')
  let apiKey: ApiKeyRow | null = null
  const { id } = await params

  try {
    if (!v1Enabled()) throw dependencyUnavailable('The developer platform is not enabled on this deployment.', 'platform_disabled')

    apiKey = await authenticate(service, request.headers)
    if (!id || !id.startsWith('req_')) throw validationError('Request id must be a req_* identifier.', 'id', 'invalid_id')

    const record = await service.getRequest(apiKey, id)
    if (!record) {
      throw new PlatformError(404, 'validation_error', 'not_found', 'No request exists with that id for this API key.', 'id')
    }
    // Note: this lookup is deliberately NOT self-logged, to avoid unbounded
    // request-log growth from traceability polling.
    return jsonResponse({ ...record, request_id: requestId }, 200, requestId)
  } catch (err) {
    return errorResponse(err, requestId)
  }
}
