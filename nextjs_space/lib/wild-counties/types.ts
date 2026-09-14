export type WildCountyJurisdiction = 'Ireland' | 'Northern Ireland'
export type WildCountyStatus = 'foundation' | 'planned'
export type EvidenceScope = 'county' | 'regional' | 'national-context'

export type WildTopic = {
  slug: string
  title: string
  summary: string
  sourceUrl: string
  publisher: string
  evidenceScope: EvidenceScope
  reviewStatus: 'source-reviewed'
  caveat?: string
  /** Plain-language seasonal reason to look, for guest discovery copy. */
  season?: string
  /** Public discovery locality / map marker label (never a sensitive species location). */
  place?: string
  /** Approximate public latitude of the locality/landmark for the discovery map. */
  lat?: number
  /** Approximate public longitude of the locality/landmark for the discovery map. */
  lng?: number
  /** ISO date the source link was last verified reachable by a maintainer. */
  sourceChecked?: string
}

export type BusinessCandidate = {
  slug: string
  name: string
  locality: string
  category: 'eat' | 'stay' | 'visit' | 'shop'
  sourceUrl: string
  relationshipStatus: 'pilot-candidate'
}

export type WildCounty = {
  slug: string
  name: string
  brandName: string
  province: 'Connacht' | 'Leinster' | 'Munster' | 'Ulster'
  jurisdiction: WildCountyJurisdiction
  status: WildCountyStatus
  aliases?: readonly string[]
  /** Distinctive one-paragraph introduction for foundation counties. */
  intro?: string
  topics: readonly WildTopic[]
  businessCandidates: readonly BusinessCandidate[]
}

