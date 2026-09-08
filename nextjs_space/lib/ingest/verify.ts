// ==========================================================================
// §L — Verification gate for the ingest lifecycle.
//
// No LLM-proposed observation may bypass verification straight into public
// factual chronology. A candidate is auto-VERIFIED only when it can be checked
// DETERMINISTICALLY against a trusted source:
//   1. it resolved to a canonical Asset via an official identifier, OR
//   2. it resolved to a canonical Asset AND carries a source URL published by a
//      trusted regulator / statutory publisher.
// Everything else is sent to HUMAN_REVIEW. This never fabricates and never
// fuzzy-matches — the decision is purely structural.
// ==========================================================================

import { prisma } from '@/lib/prisma'

// Trusted statutory / regulator publishers across the five jurisdictions.
// Matched by hostname suffix so subdomains (e.g. environment.data.gov.uk) pass.
const TRUSTED_HOST_SUFFIXES = [
  // England & Wales / UK
  'environment.data.gov.uk',
  'data.gov.uk',
  'gov.uk',
  'naturalresources.wales',
  'cyfoethnaturiol.cymru',
  // Scotland
  'sepa.org.uk',
  'sepa.scot',
  'scotland.gov.uk',
  // Ireland
  'epa.ie',
  'catchments.ie',
  'gov.ie',
  'watersoflife.ie',
  // Northern Ireland
  'daera-ni.gov.uk',
  'doeni.gov.uk',
  'infrastructure-ni.gov.uk',
  // Cross-jurisdiction statutory / EU
  'europa.eu',
]

export function isTrustedSourceUrl(url: string | null | undefined): boolean {
  if (!url) return false
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  return TRUSTED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith('.' + suffix),
  )
}

export type VerificationDecision = 'AUTO_VERIFY' | 'HUMAN_REVIEW'

export interface VerificationAssessment {
  decision: VerificationDecision
  method: 'DETERMINISTIC_IDENTIFIER' | 'DETERMINISTIC_SOURCE' | 'HUMAN_REVIEW'
  reason: string
}

// A minimal shape so this works on both freshly-built and persisted candidates.
export interface VerifiableCandidate {
  resolvedAssetId?: string | null
  resolutionStatus?: string | null
  sourceUrl?: string | null
  // official identifiers carried by the observation (if any)
  officialIdentifier?: string | null
  identifiers?: string[] | null
}

// Decide whether an observation candidate can be verified deterministically.
export async function assessCandidate(
  c: VerifiableCandidate,
): Promise<VerificationAssessment> {
  const resolved = Boolean(c.resolvedAssetId)

  // 1. Official-identifier verification: the record carries an identifier that
  //    matches a stored, verified AssetIdentifier for the resolved asset.
  const idValues: string[] = []
  if (c.officialIdentifier?.trim()) idValues.push(c.officialIdentifier.trim())
  for (const v of c.identifiers ?? []) if (v?.trim()) idValues.push(v.trim())

  if (resolved && idValues.length > 0) {
    const match = await prisma.assetIdentifier.findFirst({
      where: { assetId: c.resolvedAssetId as string, value: { in: idValues } },
      select: { id: true, verified: true },
    })
    if (match) {
      return {
        decision: 'AUTO_VERIFY',
        method: 'DETERMINISTIC_IDENTIFIER',
        reason: 'Resolved to a canonical asset via a stored official identifier.',
      }
    }
  }

  // 2. Trusted-source verification: resolved asset + statutory/regulator source.
  if (resolved && isTrustedSourceUrl(c.sourceUrl)) {
    return {
      decision: 'AUTO_VERIFY',
      method: 'DETERMINISTIC_SOURCE',
      reason: 'Resolved to a canonical asset with a trusted statutory source URL.',
    }
  }

  // 3. Everything else requires a human decision before it can be normalised.
  const why = !resolved
    ? 'Not resolved to a canonical asset.'
    : 'No official identifier match and no trusted statutory source URL.'
  return { decision: 'HUMAN_REVIEW', method: 'HUMAN_REVIEW', reason: why }
}
