// @bioveracity/sdk — thin client for the BioVeracity Developer Platform V1.
// Responsibilities: authentication, typed request/response objects, timeouts,
// safe retries, idempotency, request IDs and structured errors. Nothing else.

export { BioVeracity, type BioVeracityOptions } from './client'
export { BioVeracityError, type BioVeracityErrorType, type BioVeracityErrorShape } from './errors'
export type {
  Evidence,
  EvidenceCreateInput,
  EvidenceMode,
  Geography,
  Health,
  ObservationPrecision,
  RequestOptions,
  RequestRecord,
  TraceEntry,
} from './types'
