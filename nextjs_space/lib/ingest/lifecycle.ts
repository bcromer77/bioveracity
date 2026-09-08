// ==========================================================================
// §L — Raw-ingest lifecycle roll-up.
//
// The RawIngest pipeline state is a deterministic function of its observation
// candidates. After any candidate transition (auto-verify on ingest, or a
// human verify/reject/normalise/publish action) we recompute the parent state
// so the ingest monitor always reflects reality. This never fabricates — it
// only summarises the candidates that already exist.
// ==========================================================================

import { prisma } from '@/lib/prisma'

export type RawIngestStatus =
  | 'PARSED'
  | 'VERIFICATION_PENDING'
  | 'VERIFIED'
  | 'NORMALISED'
  | 'PUBLISHED'

// Recompute and persist a RawIngest status from its candidate statuses.
export async function rollupRawIngestStatus(rawIngestId: string): Promise<RawIngestStatus> {
  const candidates = await prisma.observationCandidate.findMany({
    where: { rawIngestId },
    select: { status: true },
  })

  const status = computeRollup(candidates.map((c) => c.status))

  // Set the matching per-state timestamp on first entry, without clobbering
  // earlier timestamps.
  const now = new Date()
  const data: Record<string, any> = { status }
  if (status === 'PARSED') data.parsedAt = now
  if (status === 'VERIFICATION_PENDING') data.verificationPendingAt = now
  if (status === 'VERIFIED') data.verifiedAt = now
  if (status === 'NORMALISED') data.normalisedAt = now
  if (status === 'PUBLISHED') data.publishedAt = now

  await prisma.rawIngest.update({ where: { id: rawIngestId }, data })
  return status
}

// Pure roll-up rule. Rejected candidates are terminal and excluded from the
// "all complete" tests — they will never be published.
export function computeRollup(statuses: string[]): RawIngestStatus {
  if (statuses.length === 0) return 'PARSED'

  const active = statuses.filter((s) => s !== 'REJECTED')
  if (active.length === 0) return 'VERIFICATION_PENDING' // all reviewed, nothing to publish

  const all = (pred: (s: string) => boolean) => active.every(pred)
  const some = (pred: (s: string) => boolean) => active.some(pred)

  if (all((s) => s === 'PUBLISHED')) return 'PUBLISHED'
  if (all((s) => s === 'NORMALISED' || s === 'PUBLISHED') && some((s) => s === 'NORMALISED'))
    return 'NORMALISED'
  if (all((s) => s === 'VERIFIED' || s === 'NORMALISED' || s === 'PUBLISHED')) return 'VERIFIED'

  // Some candidates are still CANDIDATE / NEEDS_REVIEW.
  return 'VERIFICATION_PENDING'
}
