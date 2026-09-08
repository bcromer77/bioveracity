import assert from 'node:assert/strict'
import test from 'node:test'
import { verifiedDischargeConnections, type RegionRelation } from '../lib/region-relations'

const base: RegionRelation = {
  fromAsset: { slug: 'milton-wrc' },
  toAsset: { slug: 'river-cam', name: 'River Cam' },
  relationshipType: 'DISCHARGES_TO',
  verificationState: 'VERIFIED',
  sourceUrl: 'https://example.gov/evidence',
}

test('returns only verified, source-linked discharge relationships', () => {
  const result = verifiedDischargeConnections([
    base,
    { ...base, verificationState: 'UNVERIFIED' },
    { ...base, sourceUrl: null },
    { ...base, relationshipType: 'ADJACENT_TO' },
  ])
  assert.deepEqual(result, [{
    fromSlug: 'milton-wrc',
    toSlug: 'river-cam',
    toName: 'River Cam',
    label: 'discharges to',
    sourceUrl: 'https://example.gov/evidence',
  }])
})

test('excludes a relationship unless both endpoints are plotted', () => {
  assert.deepEqual(verifiedDischargeConnections([base], new Set(['river-cam'])), [])
})
