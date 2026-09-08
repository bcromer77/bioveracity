import assert from 'node:assert/strict'
import test from 'node:test'
import { validateEvidence, validateReview, parseEvidenceDate } from '../lib/evidence-contract'
import { validIngestKey, boundedJson } from '../lib/evidence-http'
import { assessCandidate } from '../lib/ingest/verify'
import { computeNormalisation } from '../lib/ingest/normalise'
import { resolveAsset } from '../lib/ingest/resolve'
import { prisma } from '../lib/prisma'
import { POST as intakePost } from '../app/api/ingest/evidence/route'

const fixture = { url: 'https://example.org/minutes', title: 'Synthetic council minutes', publisher: 'Fixture council', authority_id: 'fixture', jurisdiction: 'Fixture', retrieved_at: '2026-01-01T00:00:00Z', event_date: null, event_date_precision: 'unknown', publication_date: '2025-12', content_kind: 'source_excerpt', sections: [{ locator: 'Page 2', text: 'The council agreed to investigate flooding.' }] }
test('intake discards incoming verification and publication claims', () => {
  const r = validateEvidence({ ...fixture, status: 'VERIFIED', review_status: 'verified', access_label: 'public' })
  assert.equal('status' in r.content, false)
  assert.equal('access_label' in r.content, false)
})
test('version identity ignores retrieval changes but tracks substantive source changes', () => {
  assert.equal(validateEvidence(fixture).versionHash, validateEvidence({ ...fixture, retrieved_at: '2026-01-02T00:00:00Z' }).versionHash)
  assert.notEqual(validateEvidence(fixture).versionHash, validateEvidence({ ...fixture, title: 'Corrected minutes' }).versionHash)
})
test('source URL or identifier cannot verify an unsupported claim', async () => {
  for (const c of [{ resolvedAssetId: 'x', sourceUrl: 'https://www.gov.uk/' }, { resolvedAssetId: 'x', officialIdentifier: 'GB123' }, {}]) assert.equal((await assessCandidate(c)).decision, 'HUMAN_REVIEW')
})
test('review requires exact source passage and affirmative reviewer checks', () => {
  const r = { sourceChecked: true, claimSupported: true, publicationPermitted: true, claim: 'The council agreed to investigate flooding.', excerpt: fixture.sections[0].text, locator: 'Page 2', basis: 'Checked the stated decision against page 2.', evidenceType: 'council_record' }
  assert.equal(validateReview(r, fixture.sections).claim, r.claim)
  assert.throws(() => validateReview({ ...r, excerpt: 'The council confirmed contamination.' }, fixture.sections))
  assert.throws(() => validateReview({ ...r, sourceChecked: false }, fixture.sections))
  assert.throws(() => validateReview({ ...r, locator: 'Page 3' }, fixture.sections))
})
test('calendar precision and unknown dates are preserved', () => {
  assert.deepEqual(parseEvidenceDate('2024'), { value: '2024', precision: 'year' })
  assert.deepEqual(parseEvidenceDate('2024-02'), { value: '2024-02', precision: 'month' })
  assert.deepEqual(parseEvidenceDate(null), { value: null, precision: 'unknown' })
  assert.throws(() => parseEvidenceDate('2024-02-31'))
  assert.throws(() => parseEvidenceDate('2024-02', 'day'))
})
test('legacy normalisation cannot substitute retrieval or publication for an event date', () => {
  const c: any = { candidateType: 'VERIFIED_RECORD_CANDIDATE', resolvedAssetId: 'fixture', title: 'Fixture', rawObservation: {}, publishedAt: new Date('2025-01-01'), retrievedAt: new Date('2026-01-01') }
  assert.equal(computeNormalisation(c).ok, false)
  const year = computeNormalisation({ ...c, rawObservation: { event_date: '2024' } })
  assert.equal(year.payload?.datePrecision, 'year')
  assert.equal(year.payload?.date, '2024-01-01T00:00:00.000Z')
  assert.equal(computeNormalisation({ ...c, candidateType: 'MEASUREMENT', rawObservation: { event_date: '2024', parameter: 'pH', value: 7 } }).ok, false)
})
test('intake key and body bounds fail closed', async () => {
  process.env.BIOVERACITY_EVIDENCE_INGEST_KEY = 'x'.repeat(32)
  assert.equal(validIngestKey('x'.repeat(32)), true)
  assert.equal(validIngestKey(null), false)
  assert.equal(validIngestKey('y'.repeat(32)), false)
  const request = new Request('https://example.org', { method: 'POST', body: JSON.stringify({ a: '1234567890' }) })
  await assert.rejects(boundedJson(request, 5))
})
test('identifier resolution filters unverified records and refuses conflicting place identities', async () => {
  const original = prisma.assetIdentifier.findMany
  try {
    prisma.assetIdentifier.findMany = (async (args: any) => {
      assert.equal(args.where.verified, true)
      return [{ assetId: 'one' }, { assetId: 'two' }]
    }) as any
    assert.equal(await resolveAsset({ officialIdentifier: 'shared', name: 'misleading fallback' }), null)
    prisma.assetIdentifier.findMany = (async () => []) as any
    assert.equal(await resolveAsset({ officialIdentifier: 'unverified', name: 'fallback' }), null)
  } finally { prisma.assetIdentifier.findMany = original }
})
test('HTTP intake rejects disabled service and unauthenticated writes before database access', async () => {
  process.env.BIOVERACITY_EVIDENCE_ENABLED = 'false'
  assert.equal((await intakePost(new Request('https://example.org/api/ingest/evidence', { method: 'POST', body: '{}' }))).status, 503)
  process.env.BIOVERACITY_EVIDENCE_ENABLED = 'true'
  assert.equal((await intakePost(new Request('https://example.org/api/ingest/evidence', { method: 'POST', body: '{}' }))).status, 401)
  process.env.BIOVERACITY_EVIDENCE_ENABLED = 'false'
})
