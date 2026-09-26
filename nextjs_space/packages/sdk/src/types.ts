// Public types for the BioVeracity Developer Platform V1 contract.
// These mirror the documented server contract; they carry no business logic.

export type EvidenceMode = 'test' | 'live'

export type ObservationPrecision = 'year' | 'month' | 'day' | 'time' | 'unknown'

export interface Geography {
  /** Supplied geographic kind (e.g. "county", "site", "point"). Never inferred. */
  kind?: string
  name?: string
  admin_code?: string
  latitude?: number
  longitude?: number
  precision?: string
  [key: string]: unknown
}

/** The versioned canonical EvidenceCreate contract. Optional fields preserve
 *  uncertainty and are never invented when absent. */
export interface EvidenceCreateInput {
  provider: string
  source_external_id?: string
  evidence_type: string
  source_data: Record<string, unknown>
  geography?: Geography
  observation_time?: string
  observation_precision?: ObservationPrecision
  publication_time?: string
  retrieval_time?: string
  source_url?: string
  publisher?: string
  metadata?: Record<string, unknown>
  provenance?: Record<string, unknown>
}

export interface Evidence {
  id: string
  object: 'evidence'
  mode: EvidenceMode
  contract_version: string
  raw_evidence_id: string
  provider: string
  source_external_id: string | null
  evidence_type: string
  publisher: string | null
  source_url: string | null
  geography: unknown
  observation_time: string | null
  observation_precision: string | null
  publication_time: string | null
  retrieval_time: string | null
  source_data: unknown
  metadata: unknown
  provenance: unknown
  processing_status: string
  request_id: string
  created_at: string
  /** true when the response was served from an idempotent replay/dedup. */
  replayed?: boolean
}

export interface TraceEntry {
  stage: string
  at: string
  detail?: string
}

export interface RequestRecord {
  id: string
  object: 'request'
  mode: EvidenceMode | null
  method: string
  path: string
  status: number
  error_type: string | null
  error_code: string | null
  evidence_id: string | null
  raw_evidence_id: string | null
  idempotency_key: string | null
  trace: TraceEntry[]
  created_at: string | null
  request_id: string
}

export interface Health {
  object: 'health'
  status: 'ok' | 'degraded'
  contract_version: string
  platform_enabled: boolean
  dependencies: { database: 'ok' | 'unavailable' }
  request_id: string
  time: string
}

export interface RequestOptions {
  /** Idempotency key. Auto-generated for create() when omitted. */
  idempotencyKey?: string
  /** Per-request timeout override in milliseconds. */
  timeoutMs?: number
  /** Per-request retry override. */
  maxRetries?: number
  /** Additional request headers. */
  headers?: Record<string, string>
}
