import type { Database } from '@/lib/workspaces/service'
import { manifestPlaceProjectionAdapter } from './manifest-place'
import { kerry001ProjectionAdapter } from './projector'
import { createPlaceMemoryProjectorRegistry, registerPlaceMemoryProjector } from './registry'

const kerry001 = registerPlaceMemoryProjector(kerry001ProjectionAdapter)
// Generic manifest projector: new Places are authorised by committing a reviewed
// manifest to data/places, not by registering Place-specific code (PILOT-001).
const placeManifest = registerPlaceMemoryProjector(manifestPlaceProjectionAdapter)

// Production projection is an explicit allowlist. Registration here is the
// authorisation boundary; implementing an adapter alone cannot activate it.
export const PRODUCTION_PLACE_MEMORY_PROJECTORS = Object.freeze([kerry001, placeManifest] as const)
export const PRODUCTION_PLACE_MEMORY_PROJECTOR_IDS = Object.freeze(
  PRODUCTION_PLACE_MEMORY_PROJECTORS.map((projector) => projector.id),
)

export const createProductionPlaceMemoryProjector = (db: Database) =>
  createPlaceMemoryProjectorRegistry(db, PRODUCTION_PLACE_MEMORY_PROJECTORS)
