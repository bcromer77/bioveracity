export type WildCountyJurisdiction = 'Ireland' | 'Northern Ireland' | 'England'
export type WildCountyStatus = 'foundation' | 'planned'
export type EvidenceScope = 'county' | 'regional' | 'national-context' | 'site'

export type WildTopic = {
  slug: string
  title: string
  summary: string
  sourceUrl: string
  publisher: string
  evidenceScope: EvidenceScope
  reviewStatus: 'source-reviewed'
  locality?: string
  season?: string
  access?: string
  sourceLocator?: string
  sourcePublishedAt?: string | null
  checkedAt?: string
  relatedSlugs?: readonly string[]
  connectionNote?: string
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
  province: 'Connacht' | 'Leinster' | 'Munster' | 'Ulster' | 'East of England'
  jurisdiction: WildCountyJurisdiction
  status: WildCountyStatus
  aliases?: readonly string[]
  topics: readonly WildTopic[]
  businessCandidates: readonly BusinessCandidate[]
}

