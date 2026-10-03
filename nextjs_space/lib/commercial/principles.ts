// BioVeracity does not decide that an asset is at risk.
// It records that something in the world around the asset changed, says why
// that record is being shown, keeps the uncertainty, and leaves the decision
// to the professional.
//
// Distance is not dependency.
// Correlation is not causation.
// Missing evidence is not safety.
// Announced is not funded.
// Funded is not delivered.

export const LENSES = ['FINANCE', 'LEGAL', 'ASSET', 'SUSTAINABILITY', 'INVESTMENT'] as const
export type Lens = (typeof LENSES)[number]

export const RESOLUTIONS = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'] as const
export type Resolution = (typeof RESOLUTIONS)[number]

export const BANDS = [
  'ON THIS ASSET',
  'ON THIS SITE',
  'CONNECTED',
  'NEARBY',
  'LOCAL AREA',
  'REGIONAL CONTEXT',
  'NATIONAL CONTEXT',
] as const
export type Band = (typeof BANDS)[number]

export const CHECK_STATES = [
  'NO_CHANGE',
  'NO_RECORD_FOUND',
  'SOURCE_UNAVAILABLE',
  'CHECK_FAILED',
  'NOT_CHECKED',
  'UNKNOWN',
  'RECORD_LOCATED',
] as const
export type CheckState = (typeof CHECK_STATES)[number]

export const LIFECYCLE = [
  'SCIENTIFIC_EVIDENCE',
  'RECOMMENDED',
  'CONSULTATION',
  'PROPOSED',
  'APPLICATION_SUBMITTED',
  'APPROVED',
  'REFUSED',
  'POLICY_ADOPTED',
  'FUNDED',
  'DESIGN',
  'PROCUREMENT',
  'CONTRACT_AWARDED',
  'CONSTRUCTION',
  'OPERATIONAL',
  'DELIVERED',
  'DELAYED',
  'PAUSED',
  'CANCELLED',
  'SUPERSEDED',
] as const

const FORBIDDEN = [
  /will flood/i,
  /creates liability/i,
  /reduces value/i,
  /uninsurable/i,
  /requires €\d/i,
  /government failure/i,
  /proves exposure/i,
  /climate resilient/i,
  /is compliant/i,
  /no risk/i,
]

export class CommercialError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function assertNoInventedConclusion(text: string) {
  for (const pattern of FORBIDDEN) {
    if (pattern.test(text)) throw new CommercialError(422, 'A stronger claim than the evidence was blocked')
  }
}

export function bandFor(resolution: Resolution, relationship: string): Band {
  if (resolution === 'P7') return 'NATIONAL CONTEXT'
  if (resolution === 'P6') return 'REGIONAL CONTEXT'
  if (resolution === 'P5' || relationship === 'SAME_LOCAL_AUTHORITY' || relationship === 'SAME_PLANNING_AREA') return 'LOCAL AREA'
  if ((relationship === 'INTERSECTS' || relationship === 'ON_SITE') && resolution === 'P0') return 'ON THIS ASSET'
  if (relationship === 'ON_SITE' && resolution === 'P1') return 'ON THIS SITE'
  if (relationship === 'CONTEXT_ONLY') return 'REGIONAL CONTEXT'
  if (relationship === 'SAME_CATCHMENT' || relationship === 'UPSTREAM_OF' || relationship === 'DOWNSTREAM_OF' || relationship === 'SAME_WATER_RESOURCE_ZONE' || relationship === 'SAME_WWTP') return 'CONNECTED'
  if (relationship === 'ADJACENT_TO' || relationship === 'WITHIN_RADIUS') return 'NEARBY'
  if (relationship === 'SAME_LOCAL_AUTHORITY' || relationship === 'SAME_PLANNING_AREA') return 'LOCAL AREA'
  if (relationship === 'NOT_ATTACHED') return 'REGIONAL CONTEXT'
  return 'REGIONAL CONTEXT'
}

export function assertAttachable(resolution: Resolution, band: Band) {
  if ((band === 'ON THIS ASSET' || band === 'ON THIS SITE') && resolution !== 'P0' && resolution !== 'P1') {
    throw new CommercialError(422, 'A wider geography cannot be stated as on this asset')
  }
  if (band === 'ON THIS ASSET' && resolution !== 'P0') {
    throw new CommercialError(422, 'Only an asset-level record can be stated as on this asset')
  }
}

const QUESTIONS: Record<Lens, string> = {
  FINANCE: 'Could this warrant review of planned capital expenditure, insurance assumptions or business-continuity planning? No financial conclusion is made.',
  LEGAL: 'Does this record warrant review of due diligence, contractual representations or environmental obligations? This is not a legal conclusion.',
  ASSET: 'Does this warrant checking drainage, access, utilities or planned maintenance? No operational conclusion is made.',
  SUSTAINABILITY: 'Does this affect evidence currently used for climate or nature reporting, or adaptation planning? No compliance conclusion is made.',
  INVESTMENT: 'Would this have changed a question asked during acquisition due diligence? No valuation is made.',
}

export function roleQuestion(lens: Lens) {
  const text = QUESTIONS[lens]
  assertNoInventedConclusion(text)
  return text
}

export function whySeeing(input: { family: string; band: Band; reason: string; authority: string; status: string }) {
  const text = `${input.family}. ${input.band}. ${input.reason} Source: ${input.authority}. Status: ${input.status}.`
  assertNoInventedConclusion(text)
  return text
}
