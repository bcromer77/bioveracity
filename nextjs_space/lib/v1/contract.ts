// ==========================================================================
// Developer Platform V1 — versioned canonical EvidenceCreate contract.
//
// The public contract is snake_case and validated strictly server-side. It
// preserves uncertainty explicitly: observation/publication times, precision,
// geography, source attribution and coordinates are all OPTIONAL and are never
// invented when absent. County evidence is never silently converted to
// town/site evidence — geography is stored verbatim as supplied.
// ==========================================================================

import { z } from 'zod'
import { createHash } from 'node:crypto'
import { validationError } from './errors'

export const CONTRACT_VERSION = 'v1'

// Calendar precision a producer may assert about an observation time. Absent =
// "unknown"; we never upgrade an imprecise date into a precise one.
const PRECISION = ['year', 'month', 'day', 'time', 'unknown'] as const
export type ObservationPrecision = (typeof PRECISION)[number]

const boundedString = (max: number) =>
  z.string().min(1).max(max).refine((s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s), 'Control characters are not permitted')

// An ISO-8601 date or date-time. We do not coerce; an invalid string is a
// validation error rather than a silently-adjusted date.
const isoDateTime = z
  .string()
  .min(4)
  .max(40)
  .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Must be an ISO-8601 date or date-time')

// Geography is stored verbatim. We validate coordinate ranges only when both
// are present, and never fabricate a missing pair.
const geography = z
  .object({
    kind: boundedString(60).optional(), // e.g. "county", "site", "point" — supplied, never inferred
    name: boundedString(300).optional(),
    admin_code: boundedString(120).optional(),
    latitude: z.number().finite().gte(-90).lte(90).optional(),
    longitude: z.number().finite().gte(-180).lte(180).optional(),
    precision: boundedString(60).optional(),
  })
  .passthrough()
  .refine(
    (g) => (g.latitude === undefined) === (g.longitude === undefined),
    'Coordinates require both latitude and longitude, or neither',
  )

export const evidenceCreateSchema = z
  .object({
    provider: boundedString(200), // source/provider — required
    source_external_id: boundedString(300).optional(),
    evidence_type: boundedString(120), // required
    source_data: z.record(z.any()), // raw/source data — required object, stored verbatim
    geography: geography.optional(),
    observation_time: isoDateTime.optional(),
    observation_precision: z.enum(PRECISION).optional(),
    publication_time: isoDateTime.optional(),
    retrieval_time: isoDateTime.optional(),
    source_url: z
      .string()
      .min(1)
      .max(2000)
      .url('source_url must be a valid URL')
      .optional(),
    publisher: boundedString(300).optional(),
    metadata: z.record(z.any()).optional(),
    provenance: z.record(z.any()).optional(),
  })
  .strict()

export type EvidenceCreate = z.infer<typeof evidenceCreateSchema>

// Validate, translating the first Zod issue into the stable error envelope.
export function parseEvidenceCreate(input: unknown): EvidenceCreate {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('Request body must be a JSON object.', 'body')
  }
  const result = evidenceCreateSchema.safeParse(input)
  if (!result.success) {
    const issue = result.error.issues[0]
    const param = issue.path.length ? issue.path.join('.') : undefined
    throw validationError(issue.message, param)
  }
  const data = result.data
  // Precision without a time is meaningless; a time without precision defaults
  // to "unknown" rather than an invented precision.
  if (data.observation_precision && !data.observation_time) {
    throw validationError('observation_precision requires observation_time.', 'observation_precision')
  }
  return data
}

// ---- Deterministic fingerprint (stable key order) ----
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const obj = value as Record<string, unknown>
  return '{' + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

export function fingerprint(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}
