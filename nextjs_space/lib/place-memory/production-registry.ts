import type { Database } from '@/lib/workspaces/service'
import { kerry001ProjectionAdapter } from './projector'
import { createPlaceMemoryProjectorRegistry, registerPlaceMemoryProjector } from './registry'

const kerry001 = registerPlaceMemoryProjector(kerry001ProjectionAdapter)

// Production projection is an explicit allowlist. Registration here is the
// authorisation boundary; implementing an adapter alone cannot activate it.
export const PRODUCTION_PLACE_MEMORY_PROJECTORS = Object.freeze([kerry001] as const)
export const PRODUCTION_PLACE_MEMORY_PROJECTOR_IDS = Object.freeze(
  PRODUCTION_PLACE_MEMORY_PROJECTORS.map((projector) => projector.id),
)

export const createProductionPlaceMemoryProjector = (db: Database) =>
  createPlaceMemoryProjectorRegistry(db, PRODUCTION_PLACE_MEMORY_PROJECTORS)
