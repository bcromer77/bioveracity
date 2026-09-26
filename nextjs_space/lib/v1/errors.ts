// ==========================================================================
// Developer Platform V1 — stable, machine-readable error model.
//
// Every failure crosses the boundary as the same envelope so an SDK client can
// branch on `type`/`code` without parsing prose:
//
//   { error: { type, code, message, param?, request_id } }
//
// No stack traces, database details or credential material ever appear here.
// ==========================================================================

export type PlatformErrorType =
  | 'authentication_error'
  | 'permission_error'
  | 'validation_error'
  | 'idempotency_error'
  | 'rate_limit_error'
  | 'api_unavailable_error'
  | 'api_error'

export interface PlatformErrorBody {
  type: PlatformErrorType
  code: string
  message: string
  param?: string
  request_id?: string
}

export class PlatformError extends Error {
  readonly status: number
  readonly type: PlatformErrorType
  readonly code: string
  readonly param?: string

  constructor(status: number, type: PlatformErrorType, code: string, message: string, param?: string) {
    super(message)
    this.name = 'PlatformError'
    this.status = status
    this.type = type
    this.code = code
    this.param = param
  }

  body(requestId?: string): { error: PlatformErrorBody } {
    const error: PlatformErrorBody = { type: this.type, code: this.code, message: this.message }
    if (this.param) error.param = this.param
    if (requestId) error.request_id = requestId
    return { error }
  }
}

// ---- Constructors for the explicitly-required failure classes ----

export const authError = (message = 'No valid API key provided.', code = 'missing_api_key') =>
  new PlatformError(401, 'authentication_error', code, message)

export const permissionError = (message = 'The API key lacks the required scope for this action.', code = 'insufficient_scope') =>
  new PlatformError(403, 'permission_error', code, message)

export const validationError = (message: string, param?: string, code = 'invalid_request') =>
  new PlatformError(400, 'validation_error', code, message, param)

export const idempotencyConflict = (
  message = 'An idempotency key was reused with a different request payload.',
  code = 'idempotency_key_reuse',
) => new PlatformError(409, 'idempotency_error', code, message)

export const rateLimitError = (message = 'Too many requests. Please retry after a short delay.', code = 'rate_limited') =>
  new PlatformError(429, 'rate_limit_error', code, message)

export const dependencyUnavailable = (message = 'A downstream dependency is temporarily unavailable.', code = 'dependency_unavailable') =>
  new PlatformError(503, 'api_unavailable_error', code, message)

export const internalError = (message = 'An unexpected error occurred.', code = 'internal_error') =>
  new PlatformError(500, 'api_error', code, message)
