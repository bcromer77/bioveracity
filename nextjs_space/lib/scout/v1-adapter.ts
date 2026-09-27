// ==========================================================================
// Scout → Developer Platform V1 adapter (single discovery, test-only default).
//
// Takes EXACTLY ONE Scout discovery (a schema-2.1 push carrying one
// observation), maps it to the frozen V1 EvidenceCreate contract and submits
// it through the existing @bioveracity/sdk. Deliberately NOT here: batching,
// scheduling, polling, backlog enumeration, retry fan-out, HTTP/auth logic
// (owned by the SDK) and any interpretation of the source material.
//
// Rules: unknown values are omitted, never inferred; the discovery is kept
// verbatim in source_data; idempotency keys are derived deterministically from
// the mapped payload; credentials are never logged, persisted or echoed.
// ==========================================================================

import { BioVeracity, type Evidence, type EvidenceCreateInput } from '../../packages/sdk/src/index'
import { evidenceCreateSchema, fingerprint } from '../v1/contract'
import { parseToken, redactSecrets, type KeyMode } from '../v1/keys'

export const SCOUT_ADAPTER_VERSION = 'scout-v1-adapter/1'
export const SCOUT_PROVIDER = 'scout'

export class ScoutAdapterError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(redactSecrets(message))
    this.name = 'ScoutAdapterError'
  }
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const obj = (v: unknown): Obj | undefined => (isObj(v) ? v : undefined)

// Assign only defined values so unknowns stay absent from the payload.
function put(target: Obj, key: string, value: unknown) {
  if (value !== undefined) target[key] = value
}

export interface MappedDiscovery {
  evidence: EvidenceCreateInput
  idempotencyKey: string
}

/**
 * Pure, deterministic mapping of ONE Scout discovery to EvidenceCreate.
 * Throws ScoutAdapterError for arrays, batches or unusable input (fail closed).
 */
export function mapScoutDiscovery(discovery: unknown): MappedDiscovery {
  if (Array.isArray(discovery)) throw new ScoutAdapterError('batch_rejected', 'Arrays are rejected: submit exactly one Scout discovery.')
  if (!isObj(discovery)) throw new ScoutAdapterError('invalid_discovery', 'A Scout discovery must be a JSON object.')
  const observations = discovery.observations
  if (!Array.isArray(observations)) throw new ScoutAdapterError('invalid_discovery', 'A Scout discovery must carry an observations array with exactly one entry.')
  if (observations.length !== 1) {
    throw new ScoutAdapterError('batch_rejected', `Exactly one observation is required; received ${observations.length}.`)
  }
  const o = observations[0]
  if (!isObj(o)) throw new ScoutAdapterError('invalid_discovery', 'The observation must be a JSON object.')

  const meta = obj(discovery.ingestion_metadata) ?? {}
  const rawSource = obj(discovery.raw_source) ?? {}

  const evidenceType = str(o.observation_type)
  if (!evidenceType) throw new ScoutAdapterError('invalid_discovery', 'observation.observation_type is required.')

  // Verbatim copy of the whole discovery (JSON round-trip = plain data only).
  const sourceData = JSON.parse(JSON.stringify(discovery)) as Obj

  const evidence: Obj = { provider: SCOUT_PROVIDER, evidence_type: evidenceType, source_data: sourceData }
  put(evidence, 'source_external_id', str(o.source_external_id) ?? str(o.official_identifier))
  put(evidence, 'source_url', str(o.source_url) ?? str(rawSource.url))
  put(evidence, 'publisher', str(rawSource.publisher) ?? str(o.publisher))
  put(evidence, 'publication_time', str(o.publication_timestamp))
  put(evidence, 'retrieval_time', str(o.retrieval_timestamp))
  const observationTime = str(o.observation_timestamp)
  put(evidence, 'observation_time', observationTime)
  // Precision is only meaningful with a time; never invented when absent.
  if (observationTime) put(evidence, 'observation_precision', str(o.observation_precision))

  // Geography: supplied descriptors only; coordinates only as a complete pair.
  const g = obj(o.geography)
  const coords = obj(o.coordinates)
  const lat = num(coords?.lat) ?? num(coords?.latitude)
  const lng = num(coords?.lng) ?? num(coords?.longitude)
  const geography: Obj = {}
  if (g) {
    put(geography, 'kind', str(g.kind))
    put(geography, 'name', str(g.name))
    put(geography, 'admin_code', str(g.admin_code))
    put(geography, 'precision', str(g.precision))
  }
  if (lat !== undefined && lng !== undefined) {
    geography.latitude = lat
    geography.longitude = lng
    put(geography, 'coordinate_precision', str(o.coordinate_precision))
  }
  if (Object.keys(geography).length) evidence.geography = geography

  const metadata: Obj = { adapter: SCOUT_ADAPTER_VERSION }
  put(metadata, 'source_agent', str(meta.source_agent))
  put(metadata, 'schema_version', str(meta.schema_version))
  put(metadata, 'category', str(meta.category))
  put(metadata, 'target_region', str(meta.target_region))
  evidence.metadata = metadata

  const provenance: Obj = { submitted_via: SCOUT_ADAPTER_VERSION }
  put(provenance, 'source_agent', str(meta.source_agent))
  put(provenance, 'raw_source_url', str(rawSource.url))
  put(provenance, 'licence', str(rawSource.licence) ?? str(o.licence))
  put(provenance, 'licence_url', str(rawSource.licence_url))
  put(provenance, 'attribution', str(rawSource.attribution))
  put(provenance, 'source_locator', str(o.source_locator))
  put(provenance, 'source_excerpt', str(o.source_excerpt))
  if (isObj(o.uncertainty)) provenance.uncertainty = JSON.parse(JSON.stringify(o.uncertainty))
  evidence.provenance = provenance

  // Fail closed locally against the frozen contract before anything is sent.
  const checked = evidenceCreateSchema.safeParse(evidence)
  if (!checked.success) {
    const issue = checked.error.issues[0]
    throw new ScoutAdapterError('contract_violation', `Mapped payload violates EvidenceCreate at ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }

  return { evidence: evidence as unknown as EvidenceCreateInput, idempotencyKey: `scout-v1:${fingerprint(evidence)}` }
}

export interface SubmitOptions {
  apiKey: string
  /** Required and explicit: there is no production default. */
  baseUrl: string
  /** Defaults to 'test'. 'live' additionally requires allowLive: true. */
  mode?: KeyMode
  allowLive?: boolean
  fetch?: typeof fetch
  timeoutMs?: number
}

export interface SubmitResult {
  mode: KeyMode
  evidence_id: string
  raw_evidence_id: string
  request_id: string
  processing_status: string
  replayed: boolean
  idempotency_key: string
}

/** Submit exactly ONE Scout discovery through the SDK. One HTTP attempt. */
export async function submitScoutDiscovery(discovery: unknown, options: SubmitOptions): Promise<SubmitResult> {
  const mode: KeyMode = options?.mode ?? 'test'
  if (mode !== 'test' && mode !== 'live') throw new ScoutAdapterError('invalid_mode', 'mode must be "test" or "live".')
  if (mode === 'live' && options.allowLive !== true) {
    throw new ScoutAdapterError('live_not_allowed', 'Live submission requires mode "live" AND allowLive: true.')
  }
  if (!str(options?.baseUrl)) throw new ScoutAdapterError('missing_base_url', 'baseUrl is required; there is no default target.')
  const parsed = parseToken(options.apiKey)
  if (!parsed) throw new ScoutAdapterError('invalid_api_key', 'The API credential is missing or malformed.')
  if (parsed.mode !== mode) {
    throw new ScoutAdapterError('mode_mismatch', `The credential is a ${parsed.mode} key but the adapter is in ${mode} mode.`)
  }

  const { evidence, idempotencyKey } = mapScoutDiscovery(discovery)
  const bio = new BioVeracity({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    timeoutMs: options.timeoutMs,
    maxRetries: 0, // no retry fan-out; a caller may repeat safely with the same key
  })

  let created: Evidence
  try {
    created = await bio.evidence.create(evidence, { idempotencyKey })
  } catch (err) {
    const e = err as { code?: string; message?: string; requestId?: string; request_id?: string }
    const code = typeof e?.code === 'string' ? e.code : 'submission_failed'
    const msg = String(e?.message ?? err).split(options.apiKey).join('[REDACTED]')
    throw new ScoutAdapterError(code, `Submission failed: ${msg}`)
  }
  return {
    mode: created.mode,
    evidence_id: created.id,
    raw_evidence_id: created.raw_evidence_id,
    request_id: created.request_id,
    processing_status: created.processing_status,
    replayed: created.replayed === true,
    idempotency_key: idempotencyKey,
  }
}
