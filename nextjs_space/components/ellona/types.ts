export type OpportunityDTO = {
  id: string
  status: string
  classification: string
  buyer: string
  title: string
  country: string
  region: string | null
  themes: string[]
  capabilities: string[]
  measurementNeed: string | null
  publishedValue: string | null
  clarificationDeadline: string | null
  tenderDeadline: string | null
  nextAction: string | null
  latitude: number | null
  longitude: number | null
  precision: string | null
  awardedSupplierName: string | null
  awardedSupplierId: string | null
  awardedValue: number | null
  buyerContactName: string | null
  buyerContactEmail: string | null
  following: boolean
  hasCorrection: boolean
  deadlineSort: number | null
  routedAt: string
  evidenceRefreshedAt: string
  isSeed: boolean
  accessLimited: boolean
  newSinceLastPortfolio: boolean
}
