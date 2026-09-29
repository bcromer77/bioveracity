// Place-neutral Place Memory text utilities (Place Experience PR G).
// Extracted verbatim from the KERRY-001 source adapter so generic retrieval
// no longer depends on a Place-specific module. Behaviour is unchanged.

import { createHash } from 'node:crypto'

/**
 * Normalise a search or vocabulary term for Place-neutral comparison:
 * NFKD-decompose, strip combining diacritics, lower-case, collapse every run
 * of non-letter/non-digit characters to a single space and trim.
 */
export function normaliseMemoryTerm(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/**
 * Deterministic identifier: `${prefix}_` followed by the first 32 hex
 * characters of the SHA-256 of the JSON-encoded parts. Same inputs always
 * yield the same ID, so projections are idempotent.
 */
export function stableMemoryId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32)}`
}
