import type { Database } from '@/lib/workspaces/service'
import type { EvidencePublic } from '@/lib/v1/service'

export type PlaceMemoryProjectionResult = {
  projected: boolean
  reason?: string
  [key: string]: unknown
}

export type PlaceMemoryProjectorAdapter<
  TRecord,
  TResult extends PlaceMemoryProjectionResult = PlaceMemoryProjectionResult,
> = Readonly<{
  id: string
  adapt(evidence: EvidencePublic): TRecord | null
  project(db: Database, record: TRecord): Promise<TResult>
}>

type ResolvedProjection = Readonly<{
  id: string
  run(db: Database): Promise<PlaceMemoryProjectionResult>
}>

export type RegisteredPlaceMemoryProjector = Readonly<{
  id: string
  resolve(evidence: EvidencePublic): ResolvedProjection | null
}>

// This is the only type-erasure boundary. The generic adapter guarantees that
// its parser output and projector input agree before it enters the registry.
export function registerPlaceMemoryProjector<
  TRecord,
  TResult extends PlaceMemoryProjectionResult,
>(adapter: PlaceMemoryProjectorAdapter<TRecord, TResult>): RegisteredPlaceMemoryProjector {
  if (!adapter.id.trim()) throw new Error('place_memory_registry_invalid:empty_id')
  return Object.freeze({
    id: adapter.id,
    resolve(evidence: EvidencePublic) {
      const record = adapter.adapt(evidence)
      if (record === null) return null
      return Object.freeze({
        id: adapter.id,
        run: (db: Database) => adapter.project(db, record),
      })
    },
  })
}

export function createPlaceMemoryProjectorRegistry(
  db: Database,
  registrations: readonly RegisteredPlaceMemoryProjector[],
) {
  const projectors = Object.freeze([...registrations])
  const ids = projectors.map((projector) => projector.id)
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index)
  if (duplicate) throw new Error(`place_memory_registry_invalid:duplicate_id:${duplicate}`)

  return async (evidence: EvidencePublic): Promise<PlaceMemoryProjectionResult> => {
    const matches = projectors
      .map((projector) => projector.resolve(evidence))
      .filter((resolved): resolved is ResolvedProjection => resolved !== null)
    if (matches.length > 1) {
      throw new Error(`place_memory_registry_ambiguous:${matches.map((match) => match.id).join(',')}`)
    }
    if (matches.length === 0) return { projected: false, reason: 'unregistered' }
    return matches[0].run(db)
  }
}
