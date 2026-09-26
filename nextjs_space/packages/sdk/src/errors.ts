// Structured error surfaced to SDK callers. Mirrors the server error envelope
// so applications can branch on `type`/`code` deterministically.

export type BioVeracityErrorType =
  | 'authentication_error'
  | 'permission_error'
  | 'validation_error'
  | 'idempotency_error'
  | 'rate_limit_error'
  | 'api_unavailable_error'
  | 'api_error'
  | 'connection_error'

export interface BioVeracityErrorShape {
  type: BioVeracityErrorType
  code: string
  message: string
  param?: string
  request_id?: string
}

export class BioVeracityError extends Error {
  readonly type: BioVeracityErrorType
  readonly code: string
  readonly param?: string
  readonly requestId?: string
  readonly status?: number

  constructor(shape: BioVeracityErrorShape, status?: number) {
    super(shape.message)
    this.name = 'BioVeracityError'
    this.type = shape.type
    this.code = shape.code
    this.param = shape.param
    this.requestId = shape.request_id
    this.status = status
  }

  /** True for transient failures the SDK may retry. */
  get isRetryable(): boolean {
    return (
      this.type === 'rate_limit_error' ||
      this.type === 'api_unavailable_error' ||
      this.type === 'connection_error' ||
      (this.status !== undefined && this.status >= 500)
    )
  }
}

export function connectionError(message: string): BioVeracityError {
  return new BioVeracityError({ type: 'connection_error', code: 'connection_failed', message })
}
