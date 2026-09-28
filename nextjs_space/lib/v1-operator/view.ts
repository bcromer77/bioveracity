// ==========================================================================
// Developer Platform V1 — read-only operator view model.
//
// SELECT-only queries over the five Platform tables, returning SAFE fields:
// identifiers, mode, timestamps, processing status/trace and provenance.
// Never selected: raw bodies, source data, metadata, key hashes, key lookup
// ids. Every string that leaves this module passes through redactSecrets. Runs on the
// shared Sql abstraction so it is exercised on PGlite in tests.
// ==========================================================================

import { createHash } from 'node:crypto'
import type { Sql } from '../workspaces/service'
import { redactSecrets } from '../v1/keys'

const iso = (v: unknown): string | null => {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
const text = (v: unknown): string | null => (v == null ? null : redactSecrets(String(v)))
const json = (v: unknown): unknown => {
  if (v == null) return null
  const parsed = typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return v } })() : v
  return JSON.parse(redactSecrets(JSON.stringify(parsed)))
}
// Client-supplied idempotency keys are shown as a short digest only.
const digest = (v: unknown): string | null =>
  v == null ? null : 'sha256:' + createHash('sha256').update(String(v)).digest('hex').slice(0, 12)

export interface OperatorRequest {
  id: string; api_key_id: string | null; mode: string | null; method: string; path: string; status: number
  error_type: string | null; error_code: string | null; evidence_id: string | null; raw_evidence_id: string | null
  idempotency_key_digest: string | null; trace: unknown; created_at: string | null
}
export interface OperatorRaw {
  id: string; api_key_id: string; mode: string; payload_fingerprint: string; request_id: string; bytes: number; created_at: string | null
}
export interface OperatorEvidence {
  id: string; api_key_id: string; mode: string; raw_evidence_id: string; contract_version: string; provider: string
  source_external_id: string | null; evidence_type: string; publisher: string | null; source_url: string | null
  observation_time: string | null; observation_precision: string | null; publication_time: string | null; retrieval_time: string | null
  processing_status: string; processing_error: string | null; provenance: unknown; request_id: string; created_at: string | null
}
export interface OperatorChain { evidence: OperatorEvidence; raw: OperatorRaw | null; requests: OperatorRequest[] }
export interface OperatorView {
  counts: { requests: number; raw: number; evidence: number; active_keys: number; by_status: Record<string, number> }
  chains: OperatorChain[]
  recent_requests: OperatorRequest[]
}

export async function loadPlatformOperatorView(sql: Sql, limit = 50): Promise<OperatorView> {
  const n = Math.max(1, Math.min(200, Math.trunc(limit)))
  const [reqRows, evRows, countRows, statusRows] = await Promise.all([
    sql.query<any>(
      `SELECT "id","apiKeyId","mode","method","path","status","errorType","errorCode","evidenceId","rawEvidenceId","idempotencyKey","trace","createdAt"
         FROM "PlatformRequest" ORDER BY "createdAt" DESC, "id" DESC LIMIT $1`, [n]),
    sql.query<any>(
      `SELECT "id","apiKeyId","mode","rawEvidenceId","contractVersion","provider","sourceExternalId","evidenceType","publisher","sourceUrl",
              "observationTime","observationPrecision","publicationTime","retrievalTime","processingStatus","processingError","provenance","requestId","createdAt"
         FROM "PlatformEvidence" ORDER BY "createdAt" DESC, "id" DESC LIMIT $1`, [n]),
    sql.query<any>(
      `SELECT (SELECT COUNT(*) FROM "PlatformRequest")::int AS requests,
              (SELECT COUNT(*) FROM "PlatformRawEvidence")::int AS raw,
              (SELECT COUNT(*) FROM "PlatformEvidence")::int AS evidence,
              (SELECT COUNT(*) FROM "PlatformApiKey" WHERE "revokedAt" IS NULL)::int AS active_keys`, []),
    sql.query<any>(`SELECT "processingStatus" AS s, COUNT(*)::int AS c FROM "PlatformEvidence" GROUP BY "processingStatus"`, []),
  ])

  const toReq = (r: any): OperatorRequest => ({
    id: String(r.id), api_key_id: text(r.apiKeyId), mode: text(r.mode), method: String(r.method), path: String(text(r.path)),
    status: Number(r.status), error_type: text(r.errorType), error_code: text(r.errorCode), evidence_id: text(r.evidenceId),
    raw_evidence_id: text(r.rawEvidenceId), idempotency_key_digest: digest(r.idempotencyKey), trace: json(r.trace), created_at: iso(r.createdAt),
  })
  const evidence: OperatorEvidence[] = evRows.map((r) => ({
    id: String(r.id), api_key_id: String(r.apiKeyId), mode: String(r.mode), raw_evidence_id: String(r.rawEvidenceId),
    contract_version: String(r.contractVersion), provider: String(text(r.provider)), source_external_id: text(r.sourceExternalId),
    evidence_type: String(text(r.evidenceType)), publisher: text(r.publisher), source_url: text(r.sourceUrl),
    observation_time: iso(r.observationTime), observation_precision: text(r.observationPrecision),
    publication_time: iso(r.publicationTime), retrieval_time: iso(r.retrievalTime),
    processing_status: String(r.processingStatus), processing_error: text(r.processingError), provenance: json(r.provenance),
    request_id: String(r.requestId), created_at: iso(r.createdAt),
  }))

  const evIds = evidence.map((e) => e.id)
  const rawIds = evidence.map((e) => e.raw_evidence_id)
  const [rawRows, linkedReqRows] = evIds.length
    ? await Promise.all([
        sql.query<any>(
          `SELECT "id","apiKeyId","mode","payloadFingerprint","requestId",octet_length("rawBody"::text)::int AS bytes,"createdAt"
             FROM "PlatformRawEvidence" WHERE "id" = ANY($1::text[])`, [rawIds]),
        sql.query<any>(
          `SELECT "id","apiKeyId","mode","method","path","status","errorType","errorCode","evidenceId","rawEvidenceId","idempotencyKey","trace","createdAt"
             FROM "PlatformRequest" WHERE "evidenceId" = ANY($1::text[]) ORDER BY "createdAt" ASC, "id" ASC`, [evIds]),
      ])
    : [[], []]

  const rawById = new Map<string, OperatorRaw>(
    rawRows.map((r: any) => [String(r.id), {
      id: String(r.id), api_key_id: String(r.apiKeyId), mode: String(r.mode), payload_fingerprint: String(r.payloadFingerprint),
      request_id: String(r.requestId), bytes: Number(r.bytes), created_at: iso(r.createdAt),
    }]),
  )
  const linked = linkedReqRows.map(toReq)
  const c = countRows[0] ?? {}
  const by_status: Record<string, number> = {}
  for (const s of statusRows) by_status[String(s.s)] = Number(s.c)

  return {
    counts: { requests: Number(c.requests ?? 0), raw: Number(c.raw ?? 0), evidence: Number(c.evidence ?? 0), active_keys: Number(c.active_keys ?? 0), by_status },
    chains: evidence.map((e) => ({ evidence: e, raw: rawById.get(e.raw_evidence_id) ?? null, requests: linked.filter((r) => r.evidence_id === e.id) })),
    recent_requests: reqRows.map(toReq),
  }
}
