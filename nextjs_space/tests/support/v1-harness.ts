// Test harness for the Developer Platform V1.
//
// Runs the REAL service, auth, contract and error code against an in-memory
// PGlite database created from the REAL migration SQL. `handle()` reproduces the
// thin route flow (authenticate → scope → validate → create → record) so the
// full request lifecycle is exercised without Next.js plumbing. `makeSdkFetch()`
// adapts it to a fetch implementation so the actual @bioveracity/sdk can be
// driven end-to-end against it.

import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Database, Sql } from '../../lib/workspaces/service'
import { platformService, type PlatformService, type TraceEntry, type ApiKeyRow, type ServiceOptions } from '../../lib/v1/service'
import { authenticate, requireScope } from '../../lib/v1/auth'
import { parseEvidenceCreate } from '../../lib/v1/contract'
import { PlatformError, rateLimitError, validationError } from '../../lib/v1/errors'
import { fixedWindowLimiter, type RateLimiter } from '../../lib/v1/ratelimit'

export interface Harness {
  pg: PGlite
  db: Database
  service: PlatformService
  makeService: (opts?: ServiceOptions) => PlatformService
  handle: (
    method: string,
    path: string,
    opts?: { token?: string; body?: unknown; headers?: Record<string, string> },
  ) => Promise<{ status: number; json: any; requestId: string }>
  makeSdkFetch: () => typeof fetch
}

export async function harness(options?: {
  processor?: ServiceOptions['processor']
  limiter?: RateLimiter
}): Promise<Harness> {
  const pg = new PGlite()
  await pg.exec(readFileSync(join(process.cwd(), 'prisma/migrations/20261001_developer_platform_v1/migration.sql'), 'utf8'))

  const sql = (client: Pick<PGlite, 'query'>): Sql => ({
    query: async <T>(text: string, values: unknown[]) => (await client.query<T>(text, values)).rows,
  })
  const db: Database = { ...sql(pg), transaction: (op) => pg.transaction((tx) => op(sql(tx))) }

  let counter = 0
  const genId = (prefix: string) => `${prefix}_${String(++counter).padStart(6, '0')}`
  const now = () => new Date('2026-10-01T12:00:00.000Z')

  const makeService = (opts: ServiceOptions = {}) =>
    platformService(db, { genId, now, processor: options?.processor, ...opts })

  const service = makeService()
  const limiter = options?.limiter ?? fixedWindowLimiter({ limit: 1000, windowMs: 60_000 })

  // Reproduces the route flow for a single request against the PGlite service.
  async function handle(
    method: string,
    path: string,
    opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) {
    const requestId = service.genId('req')
    const headers = new Headers(opts.headers ?? {})
    if (opts.token) headers.set('authorization', `Bearer ${opts.token}`)
    const trace: TraceEntry[] = [{ stage: 'received', at: service.nowIso() }]
    let apiKey: ApiKeyRow | null = null
    const idempotencyKey = headers.get('idempotency-key')?.trim() || null

    try {
      apiKey = await authenticate(service, headers)
      trace.push({ stage: 'authenticated', at: service.nowIso() })

      if (method === 'POST' && path === '/api/v1/evidence') {
        requireScope(apiKey, 'evidence:write')
        if (!limiter.check(apiKey.id)) throw rateLimitError()
        const body = parseEvidenceCreate(opts.body)
        trace.push({ stage: 'validated', at: service.nowIso() })
        const { evidence, replayed } = await service.createEvidence({ apiKey, body, rawBody: opts.body, idempotencyKey, requestId })
        trace.push({ stage: 'raw_persisted', at: service.nowIso(), detail: evidence.raw_evidence_id })
        trace.push({ stage: 'evidence_id', at: service.nowIso(), detail: evidence.id })
        trace.push({ stage: replayed ? 'replayed' : 'processing', at: service.nowIso(), detail: evidence.processing_status })
        const status = replayed ? 200 : 201
        await service.recordRequest({
          id: requestId, apiKeyId: apiKey.id, mode: apiKey.mode, method, path, status,
          evidenceId: evidence.id, rawEvidenceId: evidence.raw_evidence_id, idempotencyKey, trace,
        })
        return { status, json: { ...evidence, request_id: requestId, replayed }, requestId }
      }

      if (method === 'GET' && path.startsWith('/api/v1/evidence/')) {
        requireScope(apiKey, 'evidence:read')
        const id = path.slice('/api/v1/evidence/'.length)
        if (!id.startsWith('ev_')) throw validationError('Evidence id must be an ev_* identifier.', 'id', 'invalid_id')
        const evidence = await service.getEvidence(apiKey, id)
        if (!evidence) throw new PlatformError(404, 'validation_error', 'not_found', 'No evidence exists with that id for this API key.', 'id')
        await service.recordRequest({ id: requestId, apiKeyId: apiKey.id, mode: apiKey.mode, method, path: '/api/v1/evidence/:id', status: 200, evidenceId: evidence.id, trace })
        return { status: 200, json: { ...evidence, request_id: requestId }, requestId }
      }

      if (method === 'GET' && path.startsWith('/api/v1/requests/')) {
        const id = path.slice('/api/v1/requests/'.length)
        if (!id.startsWith('req_')) throw validationError('Request id must be a req_* identifier.', 'id', 'invalid_id')
        const record = await service.getRequest(apiKey, id)
        if (!record) throw new PlatformError(404, 'validation_error', 'not_found', 'No request exists with that id for this API key.', 'id')
        return { status: 200, json: { ...record, request_id: requestId }, requestId }
      }

      throw new PlatformError(404, 'validation_error', 'not_found', 'Unknown route.')
    } catch (err) {
      const platformErr = err instanceof PlatformError ? err : new PlatformError(500, 'api_error', 'internal_error', 'An unexpected error occurred.')
      trace.push({ stage: 'error', at: service.nowIso(), detail: platformErr.code })
      try {
        await service.recordRequest({
          id: requestId, apiKeyId: apiKey?.id ?? null, mode: apiKey?.mode ?? null, method, path, status: platformErr.status,
          errorType: platformErr.type, errorCode: platformErr.code, idempotencyKey, trace,
        })
      } catch {}
      return { status: platformErr.status, json: platformErr.body(requestId), requestId }
    }
  }

  // A fetch that routes SDK calls into handle(). Honours BioVeracity-Request-Id.
  function makeSdkFetch(): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input.toString())
      const headers: Record<string, string> = {}
      new Headers(init?.headers).forEach((v, k) => (headers[k] = v))
      const token = (headers['authorization'] || '').replace(/^Bearer\s+/i, '') || undefined
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      const res = await handle(init?.method ?? 'GET', url.pathname, { token, body, headers })
      return new Response(JSON.stringify(res.json), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', 'BioVeracity-Request-Id': res.requestId },
      })
    }) as typeof fetch
  }

  return { pg, db, service, makeService, handle, makeSdkFetch }
}
