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
  topics: readonly WildTopic[]
  businessCandidates: readonly BusinessCandidate[]
}

