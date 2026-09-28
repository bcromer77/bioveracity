// ==========================================================================
// Developer Platform V1 — production processing step (integrity verification).
//
// This is the smallest deterministic processor that lets a persisted evidence
// item complete the frozen lifecycle RAW_PERSISTED → PROCESSING → PROCESSED |
// PROCESSING_FAILED. It is READ-ONLY: it re-validates the untouched raw
// submission against the frozen contract and confirms the canonical evidence
// row is a faithful projection of it. It adds no enrichment, interpretation,
// dates, coordinates, classifications or certainty, and never writes anything;
// the service alone records the resulting status.
// ==========================================================================

import type { Database, Sql } from '@/lib/workspaces/service'
import { createProductionPlaceMemoryProjector } from '@/lib/place-memory/production-registry'
import { CONTRACT_VERSION, fingerprint, parseEvidenceCreate } from './contract'
import type { EvidencePublic, ServiceOptions } from './service'

export class ProcessingCheckError extends Error {
  constructor(readonly check: string) {
    // Names the failed check only — never echoes submitted values.
    super(`integrity_check_failed: ${check}`)
    this.name = 'ProcessingCheckError'
  }
}

const parsed = (v: unknown): unknown => {
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return v
  }
}

// Compares values canonically (stable key order), so storage-level key
// reordering is not mistaken for a change while any content change is caught.
const same = (a: unknown, b: unknown) => fingerprint(a ?? null) === fingerprint(b ?? null)

export function createV1Processor(db: Sql): NonNullable<ServiceOptions['processor']> {
  return async (evidence: EvidencePublic) => {
    const fail = (check: string): never => {
      throw new ProcessingCheckError(check)
    }
    if (evidence.processing_status !== 'PROCESSING') fail('status_not_processing')
    if (evidence.contract_version !== CONTRACT_VERSION) fail('contract_version')

    const rows = await db.query<{ rawBody: unknown }>('SELECT "rawBody" FROM "PlatformRawEvidence" WHERE "id" = $1', [
      evidence.raw_evidence_id,
    ])
    if (!rows[0]) fail('raw_evidence_missing')

    let raw
    try {
      raw = parseEvidenceCreate(parsed(rows[0].rawBody))
    } catch {
      return fail('raw_contract_invalid')
    }

    // Verbatim fields: must match the raw submission exactly (absent ⇒ null).
    const verbatim: Array<[string, unknown, unknown]> = [
      ['provider', raw.provider, evidence.provider],
      ['evidence_type', raw.evidence_type, evidence.evidence_type],
      ['source_external_id', raw.source_external_id, evidence.source_external_id],
      ['publisher', raw.publisher, evidence.publisher],
      ['source_url', raw.source_url, evidence.source_url],
      ['observation_precision', raw.observation_precision, evidence.observation_precision],
      ['source_data', raw.source_data, evidence.source_data],
      ['geography', raw.geography, evidence.geography],
      ['metadata', raw.metadata, evidence.metadata],
      ['provenance', raw.provenance, evidence.provenance],
    ]
    for (const [name, a, b] of verbatim) if (!same(a, b)) fail(`${name}_mismatch`)

    // Times are stored canonically, so check presence parity: a time the
    // producer did not supply must still be unknown, and a supplied one kept.
    const times: Array<[string, unknown, unknown]> = [
      ['observation_time', raw.observation_time, evidence.observation_time],
      ['publication_time', raw.publication_time, evidence.publication_time],
      ['retrieval_time', raw.retrieval_time, evidence.retrieval_time],
    ]
    for (const [name, a, b] of times) if ((a == null) !== (b == null)) fail(`${name}_presence`)
  }
}

export const v1ServiceOptions = (db: Database): ServiceOptions => {
  const integrity = createV1Processor(db)
  const placeMemory = createProductionPlaceMemoryProjector(db)
  return {
    processor: async (evidence) => {
      // Integrity always completes first. Place Memory is an additive,
      // idempotent projection and runs only for an explicitly recognised live
      // source adapter; every other V1 record retains the frozen behaviour.
      await integrity(evidence)
      await placeMemory(evidence)
    },
  }
}
