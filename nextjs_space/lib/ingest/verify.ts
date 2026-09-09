// Place identity does not establish source support for a claim.
export type VerificationDecision = 'AUTO_VERIFY' | 'HUMAN_REVIEW'
export interface VerificationAssessment {
  decision: VerificationDecision
  method: 'HUMAN_REVIEW'
  reason: string
}
export interface VerifiableCandidate {
  resolvedAssetId?: string | null
  resolutionStatus?: string | null
  sourceUrl?: string | null
  officialIdentifier?: string | null
  identifiers?: string[] | null
}
export async function assessCandidate(c: VerifiableCandidate): Promise<VerificationAssessment> {
  return { decision: 'HUMAN_REVIEW', method: 'HUMAN_REVIEW', reason: c.resolvedAssetId
    ? 'Place resolved. The claim still requires supporting source content and review.'
    : 'Place unresolved. Resolve identity and check supporting source content before verification.' }
}
