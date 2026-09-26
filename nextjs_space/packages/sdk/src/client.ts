import { BioVeracityError, connectionError, type BioVeracityErrorShape } from './errors'
import type { Evidence, EvidenceCreateInput, Health, RequestOptions, RequestRecord } from './types'

export interface BioVeracityOptions {
  apiKey: string
  /** API base URL, e.g. https://bioveracity.com. Defaults to production. */
  baseUrl?: string
  /** Default request timeout in milliseconds (default 15000). */
  timeoutMs?: number
  /** Default maximum retries for transient failures (default 2). */
  maxRetries?: number
  /** Injectable fetch (for testing). Defaults to global fetch. */
  fetch?: typeof fetch
}

const DEFAULT_BASE = 'https://bioveracity.com'

function randomId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return 'idem-' + Math.random().toString(16).slice(2) + Date.now().toString(16)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class BioVeracity {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly fetchImpl: typeof fetch

  constructor(options: BioVeracityOptions) {
    if (!options?.apiKey) throw new BioVeracityError({ type: 'authentication_error', code: 'missing_api_key', message: 'An apiKey is required.' })
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '')
    this.timeoutMs = options.timeoutMs ?? 15_000
    this.maxRetries = options.maxRetries ?? 2
    this.fetchImpl = options.fetch ?? globalThis.fetch
    if (!this.fetchImpl) throw new BioVeracityError({ type: 'connection_error', code: 'no_fetch', message: 'No fetch implementation available; pass one via options.fetch.' })
  }

  // ---- Resources -------------------------------------------------------

  readonly evidence = {
    create: (input: EvidenceCreateInput, options: RequestOptions = {}): Promise<Evidence> =>
      this.request<Evidence>('POST', '/api/v1/evidence', {
        ...options,
        // Idempotency is first-class: auto-attach a key so retries are safe.
        idempotencyKey: options.idempotencyKey ?? randomId(),
        body: input,
      }),
    retrieve: (id: string, options: RequestOptions = {}): Promise<Evidence> =>
      this.request<Evidence>('GET', `/api/v1/evidence/${encodeURIComponent(id)}`, options),
  }

  readonly requests = {
    retrieve: (id: string, options: RequestOptions = {}): Promise<RequestRecord> =>
      this.request<RequestRecord>('GET', `/api/v1/requests/${encodeURIComponent(id)}`, options),
  }

  health(options: RequestOptions = {}): Promise<Health> {
    return this.request<Health>('GET', '/api/v1/health', options)
  }

  // ---- Core transport --------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    options: RequestOptions & { body?: unknown } = {},
  ): Promise<T> {
    const url = this.baseUrl + path
    const maxRetries = options.maxRetries ?? this.maxRetries
    const timeoutMs = options.timeoutMs ?? this.timeoutMs

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      ...options.headers,
    }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    // The same idempotency key is reused across retries of one logical call.
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

    let attempt = 0
    for (;;) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response: Response
      try {
        response = await this.fetchImpl(url, {
          method,
          headers,
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        })
      } catch (err) {
        clearTimeout(timer)
        // Network/timeout — retry if budget remains, else surface a connection error.
        if (attempt < maxRetries) {
          await sleep(this.backoff(attempt))
          attempt += 1
          continue
        }
        throw connectionError(`Request to ${path} failed: ${(err as Error)?.message ?? 'network error'}`)
      }
      clearTimeout(timer)

      const requestId = response.headers.get('BioVeracity-Request-Id') ?? undefined
      const payload = await this.parseBody(response)

      if (response.ok) return payload as T

      const shape = this.errorShape(payload, response.status, requestId)
      const error = new BioVeracityError(shape, response.status)
      // Retry transient failures only; honour Retry-After for rate limits.
      if (error.isRetryable && attempt < maxRetries) {
        const retryAfter = Number(response.headers.get('retry-after'))
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : this.backoff(attempt))
        attempt += 1
        continue
      }
      throw error
    }
  }

  private async parseBody(response: Response): Promise<unknown> {
    const text = await response.text()
    if (!text) return {}
    try {
      return JSON.parse(text)
    } catch {
      return { _raw: text }
    }
  }

  private errorShape(payload: unknown, status: number, requestId?: string): BioVeracityErrorShape {
    const envelope = (payload as { error?: Partial<BioVeracityErrorShape> })?.error
    if (envelope && typeof envelope === 'object' && envelope.type && envelope.code) {
      return {
        type: envelope.type,
        code: envelope.code,
        message: envelope.message ?? 'Request failed.',
        param: envelope.param,
        request_id: envelope.request_id ?? requestId,
      }
    }
    return {
      type: status >= 500 ? 'api_error' : 'api_error',
      code: `http_${status}`,
      message: `Unexpected response (HTTP ${status}).`,
      request_id: requestId,
    }
  }

  private backoff(attempt: number): number {
    const base = Math.min(2000, 200 * 2 ** attempt)
    return base + Math.floor(Math.random() * 100) // jitter
  }
}
