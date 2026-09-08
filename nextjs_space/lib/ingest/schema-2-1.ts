import { z } from 'zod'
import { createHash } from 'crypto'

// ==========================================================================
// BioVeracity schema 2.1 — direct machine-to-machine ingest
//
// We validate the TOP-LEVEL envelope strictly (the six documented sections)
// while allowing forward-compatible extra keys inside each section via
// .passthrough(), so a schema-2.1 producer can add fields without breaking
// ingestion. Nothing here interprets the content — it only shapes it.
// ==========================================================================

const looseObject = z.object({}).passthrough()

export const schema21 = z
  .object({
    ingestion_metadata: looseObject.optional().default({}),
    raw_source: looseObject.optional().default({}),
    observations: z.array(looseObject).default([]),
    analysis: looseObject.optional().default({}),
    commercial: looseObject.optional().default({}),
    // entity_resolution_proposals may be omitted entirely.
    entity_resolution_proposals: looseObject.optional(),
  })
  .passthrough()

export type Schema21Payload = z.infer<typeof schema21>

// ---- small readers that tolerate snake_case / camelCase producers ----

function rec(v: unknown): Record<string, any> {
  return v && typeof v === 'object' ? (v as Record<string, any>) : {}
}

export function pickStr(obj: Record<string, any>, ...keys: string[]): string | null {
  for (const k of keys) {
    const val = obj?.[k]
    if (typeof val === 'string' && val.trim()) return val.trim()
    if (typeof val === 'number') return String(val)
  }
  return null
}

export function pickNum(obj: Record<string, any>, ...keys: string[]): number | null {
  for (const k of keys) {
    const val = obj?.[k]
    if (typeof val === 'number' && Number.isFinite(val)) return val
    if (typeof val === 'string' && val.trim() && !Number.isNaN(Number(val))) return Number(val)
  }
  return null
}

export function pickInt(obj: Record<string, any>, ...keys: string[]): number | null {
  const n = pickNum(obj, ...keys)
  return n == null ? null : Math.trunc(n)
}

export function pickDate(obj: Record<string, any>, ...keys: string[]): Date | null {
  const s = pickStr(obj, ...keys)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function metaOf(p: Schema21Payload) {
  return rec(p.ingestion_metadata)
}

export interface IngestMeta {
  sourceAgent: string | null
  schemaVersion: string | null
  category: string | null
  targetRegion: string | null
  demoTag: string | null
  stream: string | null
}

export function readMeta(p: Schema21Payload): IngestMeta {
  const m = metaOf(p)
  return {
    sourceAgent: pickStr(m, 'source_agent', 'sourceAgent', 'agent'),
    schemaVersion: pickStr(m, 'schema_version', 'schemaVersion', 'version'),
    category: pickStr(m, 'category'),
    targetRegion: pickStr(m, 'target_region', 'targetRegion', 'region'),
    demoTag: pickStr(m, 'demo_tag', 'demoTag'),
    stream: pickStr(m, 'stream'),
  }
}

// ---- deterministic fingerprint ----
// Stable JSON stringify with recursively sorted object keys so that logically
// identical payloads (regardless of key order) produce the same fingerprint.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

export function fingerprint(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}
