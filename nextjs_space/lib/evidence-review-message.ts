// Pure derivation of the reviewer-facing outcome message from the server
// response of POST /api/admin/evidence (reviewEvidence). Kept out of the React
// component so the “never claim searchable unless actually published” rule is
// unit-testable. A 200 response can mean verified-and-published OR
// verified-but-excluded; the message must reflect the real outcome, not the
// HTTP status.

// Human-readable explanation of why a verified record was NOT published to
// search. Mirrors the machine reasons returned by reviewEvidence.
export const PUBLISH_BLOCK_REASONS: Record<string, string> = {
  'not-requested': 'you did not tick “Publish to registered search”, so it was recorded as verified only.',
  'catalogue-only': 'this record is a catalogue reference only — the underlying dataset is not retained pending acquisition permission.',
  'no-licensed-source-register': 'this source has no established redistributable licence on file, so it can never reach public search.',
  'incoming-sensitivity': 'the source carries an incoming sensitivity restriction that cannot be relaxed on review.',
  'content-screened-sensitive': 'the retained passage was re-screened and flagged as sensitive (for example a precise protected-species locality).',
  'requested-labels-not-public': 'the requested sensitivity/reuse labels were not public and redistributable.',
}

export type ReviewOutcome = {
  published?: boolean
  publishRequested?: boolean
  publishBlockedReason?: string | null
}

export function reviewOutcomeMessage(result: ReviewOutcome): string {
  if (result.published) {
    return 'Verified and published — this claim is now eligible for registered search.'
  }
  if (result.publishRequested) {
    const why = (result.publishBlockedReason && PUBLISH_BLOCK_REASONS[result.publishBlockedReason]) || 'it did not meet the publication eligibility rules.'
    return `Verified and recorded, but NOT published to search: ${why} It will not appear in search results.`
  }
  return 'Verified and recorded (not published to search). Tick “Publish to registered search” and re-submit to make it searchable.'
}
