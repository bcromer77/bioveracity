import type { Sql } from '@/lib/workspaces/service'

export const EVIDENCE_CLASSES = [
  'AUTHORITATIVE_STATUTORY',
  'AUTHORITATIVE_MONITORING',
  'PROFESSIONAL_OBSERVATION',
  'STRUCTURED_CITIZEN_OBSERVATION',
  'UNVERIFIED_PUBLIC_SUBMISSION',
  'MODEL_DERIVED_OUTPUT',
  'BIOVERACITY_DERIVED_ANALYSIS',
] as const

export type PlaceMemoryEvidenceClass = (typeof EVIDENCE_CLASSES)[number]
export type MemoryActor = { kind: 'public' } | { kind: 'user'; userId: string }

export type MemorySearchQuery = {
  placeId: string
  q?: string
  from?: string
  to?: string
  evidenceClasses?: PlaceMemoryEvidenceClass[]
  entityIds?: string[]
  publisher?: string
  sourceExternalId?: string
  limit?: number
}

export type MemoryMatchedEntity = {
  id: string
  kind: string
  canonicalLabel: string
  externalId: string | null
  relationType: string
  assertionState: string
  matchedTerms: string[]
}

export type MemorySearchHit = {
  id: string
  placeId: string
  kind: string
  evidenceClass: PlaceMemoryEvidenceClass
  sourceMode: 'test' | 'live' | null
  originalStatement: string
  eventStart: string | null
  eventEnd: string | null
  timePrecision: string
  geographyPrecision: string | null
  locationDisclosure: string
  publisher: string | null
  sourceExternalId: string | null
  sourceUrl: string | null
  retrievalTime: string | null
  rightsState: string
  matchType: 'browse' | 'identifier' | 'lexical' | 'concept' | 'semantic'
  matchReason: string
  entities: MemoryMatchedEntity[]
  currentPresenceSupported: false
}

export type MemorySearchResponse = {
  hits: MemorySearchHit[]
  authorisedCandidateCount: number
  warning: string | null
}

// Semantic retrieval is deliberately downstream of the SQL access gate. A
// provider can only receive the already-authorised, non-secret search documents
// passed here; it can never search a global private vector index by accident.
export type AuthorisedSemanticCandidate = {
  itemId: string
  content: string
}

export interface AuthorisedSemanticReranker {
  rerank(query: string, candidates: AuthorisedSemanticCandidate[]): Promise<string[]>
}

export type PlaceMemoryDependencies = {
  db: Sql
  semantic?: AuthorisedSemanticReranker
}
