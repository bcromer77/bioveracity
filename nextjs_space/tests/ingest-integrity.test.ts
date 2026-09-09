import test from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'
import { resolveAsset } from '../lib/ingest/resolve'
import { computeNormalisation } from '../lib/ingest/normalise'

const scope = { jurisdiction: 'England', identifierAuthority: 'Environment Agency', identifierType: 'WFD_WATER_BODY_ID' }
const candidate: any = { candidateType: 'VERIFIED_RECORD_CANDIDATE', resolvedAssetId: 'synthetic', title: 'Synthetic fixture only', rawObservation: {}, publishedAt: new Date('2025-04-10'), retrievedAt: new Date('2026-04-10') }

test('identifier lookup requires verified namespace and jurisdiction and covers every supplied ID', async () => {
  const original = prisma.assetIdentifier.findMany
  let calls = 0
  try {
    prisma.assetIdentifier.findMany = (async (args: any) => {
      calls++
      assert.equal(args.where.verified, true)
      assert.equal(args.where.authority, scope.identifierAuthority)
      assert.equal(args.where.identifierType, scope.identifierType)
      assert.equal(args.where.asset.jurisdiction.equals, scope.jurisdiction)
      return [{ assetId: 'cam', value: 'one' }]
    }) as any
    assert.equal(await resolveAsset({ officialIdentifier: 'one' }), null)
    assert.equal(await resolveAsset({ jurisdiction: 'England', officialIdentifier: 'one' }), null)
    assert.equal(calls, 0)
    assert.equal(await resolveAsset({ ...scope, identifiers: ['one', 'missing'] }), null)
    assert.equal(await resolveAsset({ ...scope, officialIdentifier: 'one' }), 'cam')
  } finally { prisma.assetIdentifier.findMany = original }
})

test('wrong namespace, unverified or conflicting identifier matches never resolve', async () => {
  const original = prisma.assetIdentifier.findMany
  try {
    prisma.assetIdentifier.findMany = (async (args: any) => {
      assert.equal(args.where.verified, true)
      return args.where.authority === 'Other authority' ? [] : [{ assetId: 'cam', value: 'one' }, { assetId: 'other', value: 'one' }]
    }) as any
    assert.equal(await resolveAsset({ ...scope, officialIdentifier: 'one' }), null)
    assert.equal(await resolveAsset({ ...scope, identifierAuthority: 'Other authority', officialIdentifier: 'one' }), null)
    prisma.assetIdentifier.findMany = (async () => []) as any
    assert.equal(await resolveAsset({ ...scope, officialIdentifier: 'unverified', name: 'Cam' }), null)
  } finally { prisma.assetIdentifier.findMany = original }
})

test('all aliases must be verified, jurisdiction-scoped and mutually consistent', async () => {
  const original = prisma.assetAlias.findMany
  try {
    prisma.assetAlias.findMany = (async (args: any) => {
      assert.equal(args.where.verificationState, 'VERIFIED')
      assert.equal(args.where.asset.jurisdiction.equals, 'England')
      const alias = args.where.aliasNormalized
      return alias === 'missing' ? [] : alias === 'ambiguous' ? [{ assetId: 'cam' }, { assetId: 'other' }] : [{ assetId: alias === 'other river' ? 'other' : 'cam' }]
    }) as any
    assert.equal(await resolveAsset({ jurisdiction: 'England', aliases: [' River   Cam ', 'Cam'] }), 'cam')
    assert.equal(await resolveAsset({ jurisdiction: 'England', aliases: ['Cam', 'Other river'] }), null)
    assert.equal(await resolveAsset({ jurisdiction: 'England', aliases: ['Cam', 'missing'] }), null)
    assert.equal(await resolveAsset({ jurisdiction: 'England', aliases: ['ambiguous'] }), null)
  } finally { prisma.assetAlias.findMany = original }
})

test('an exact name does not mask a contradictory slug', async () => {
  const original = prisma.asset.findMany
  try {
    prisma.asset.findMany = (async (args: any) => {
      assert.equal(args.where.jurisdiction.equals, 'England')
      return [{ id: args.where.slug ? 'other' : 'cam' }]
    }) as any
    assert.equal(await resolveAsset({ jurisdiction: 'England', name: 'Cam', slug: 'other' }), null)
  } finally { prisma.asset.findMany = original }
})

test('unknown event and measurement dates ignore metadata and unqualified date fields', () => {
  for (const rawObservation of [{}, { date: '2025-04-10' }, { publication_timestamp: '2025-04-10', retrieval_timestamp: '2026-04-10' }]) {
    assert.equal(computeNormalisation({ ...candidate, rawObservation }).ok, false)
    assert.equal(computeNormalisation({ ...candidate, candidateType: 'MEASUREMENT', rawObservation: { ...rawObservation, parameter: 'pH', value: 7 } }).ok, false)
  }
})

test('events preserve month/year precision; other destinations retain coarse dates for review', () => {
  for (const [event_date, precision] of [['2024', 'year'], ['2024-02', 'month']]) {
    const plan = computeNormalisation({ ...candidate, rawObservation: { event_date } })
    assert.equal(plan.ok, true)
    assert.equal(plan.payload?.datePrecision, precision)
    assert.equal(computeNormalisation({ ...candidate, candidateType: 'MEASUREMENT', rawObservation: { event_date, parameter: 'pH', value: 7 } }).ok, false)
  }
})

test('secondary permit, project and validity fields cannot invent day precision', () => {
  for (const [candidateType, key] of [['PERMIT', 'granted_date'], ['PERMIT', 'expiry_date'], ['PROJECT', 'start_date'], ['PROJECT', 'end_date'], ['WFD_WATER_BODY_IDENTITY', 'valid_from']]) {
    for (const date of ['2024', '2024-02', '2024-02-31']) {
      const plan = computeNormalisation({ ...candidate, candidateType, rawObservation: { [key]: date, value: 'fixture-id' } })
      assert.equal(plan.ok, false, `${candidateType}.${key}=${date}`)
    }
  }
  const full = computeNormalisation({ ...candidate, candidateType: 'PERMIT', rawObservation: { granted_date: '2024-02-29' } })
  assert.equal(full.payload?.grantedDate, '2024-02-29T00:00:00.000Z')
  assert.equal(computeNormalisation({ ...candidate, candidateType: 'PERMIT', rawObservation: { granted_date: '2024-02-29', grantedDate: '2024-03-01' } }).ok, false)
})
