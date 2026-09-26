// ==========================================================================
// Developer Platform V1 — server-side authentication + scope enforcement.
//
// Authorisation is enforced here, independently of any SDK. The SDK is a
// convenience; it is never trusted. A single uniform authentication error is
// returned for every failure mode (unknown / wrong secret / wrong mode) so the
// endpoint does not leak which credentials exist.
// ==========================================================================

import { authError, permissionError } from './errors'
import { parseToken, secretMatches } from './keys'
import type { ApiKeyRow, PlatformService } from './service'

const BEARER = /^Bearer\s+(.+)$/i

// Extract the raw token from either `Authorization: Bearer <token>` or the
// `x-bioveracity-api-key` header.
export function extractToken(headers: Headers): string | null {
  const auth = headers.get('authorization')
  if (auth) {
    const m = BEARER.exec(auth.trim())
    if (m) return m[1].trim()
  }
  return headers.get('x-bioveracity-api-key')
}

export async function authenticate(service: PlatformService, headers: Headers): Promise<ApiKeyRow> {
  const raw = extractToken(headers)
  const parsed = parseToken(raw)
  if (!parsed) throw authError('No valid API key provided.', 'missing_api_key')

  const key = await service.findKeyByLookup(parsed.lookupId)
  // Uniform failure: never distinguish unknown key from wrong secret/mode.
  if (!key || key.mode !== parsed.mode || !secretMatches(parsed.secret, key.secretHash)) {
    throw authError('The provided API key is invalid.', 'invalid_api_key')
  }
  if (key.revokedAt) throw authError('This API key has been revoked.', 'revoked_api_key')

  // Best-effort last-used stamp; never blocks the request.
  service.markKeyUsed(key.id).catch(() => {})
  return key
}

export function requireScope(key: ApiKeyRow, scope: string): void {
  const scopes = key.scopes.split(',').map((s) => s.trim()).filter(Boolean)
  if (!scopes.includes(scope)) throw permissionError(`This API key lacks the "${scope}" scope.`)
}
