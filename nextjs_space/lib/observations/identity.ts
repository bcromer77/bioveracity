import { createHash } from 'node:crypto'
import type { ObservationEvent } from './contract'

// JSON object key order is not source content. Array order remains meaningful.
export function stableJson(value: unknown): string {
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort)
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, v]) => [key, sort(v)]))
    }
    return item
  }
  return JSON.stringify(sort(value))
}

export function scopedIdentity(kind: string, ...parts: string[]): string {
  if (parts.some(part => typeof part !== 'string' || !part.trim())) {
    throw new Error('Source identity requires non-empty namespace and record identifiers')
  }
  return `${kind}:v2:${createHash('sha256').update(stableJson(parts)).digest('hex')}`
}

export function observationContent(event: ObservationEvent) {
  const { receivedAt: _receivedAt, source, ...content } = event
  const { retrievedAt: _retrievedAt, versionHash: _versionHash, ...sourceContent } = source
  return { ...content, source: sourceContent }
}

export function observationContentHash(event: ObservationEvent): string {
  return createHash('sha256').update(stableJson(observationContent(event))).digest('hex')
}
