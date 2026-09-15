import test from 'node:test'
import assert from 'node:assert/strict'
import { contains, eligible, ingestRegion, type Geometry } from '../lib/cambridgeshire/ingest'
import { parseSnapshot } from '../lib/cambridgeshire/snapshot'
import { searchRegion } from '../lib/cambridgeshire/search'
import { DISTRICTS } from '../lib/cambridgeshire/model'

// Synthetic polygons/records are test fixtures only and never runtime content.
const geometry: Geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }
const occurrence = { key: 123, license: 'https://creativecommons.org/licenses/by/4.0/legalcode', occurrenceStatus: 'PRESENT', countryCode: 'GB', year: 2020, species: 'Meles meles', genus: 'Meles', family: 'Mustelidae', datasetKey: '00000000-0000-0000-0000-000000000001', datasetTitle: 'Synthetic test fixture', coordinateUncertaintyInMeters: 100, decimalLatitude: 0.5, decimalLongitude: 0.5 }
test('polygon membership handles holes and separate polygon parts', () => {
  assert.equal(contains([0.5, 0.5], geometry), true); assert.equal(contains([2, 2], geometry), false)
  const hole: Geometry = { type: 'Polygon', coordinates: [...geometry.coordinates, [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6], [0.4, 0.4]]] }
  assert.equal(contains([0.5, 0.5], hole), false)
  assert.equal(contains([0.5, 0.5], { type: 'MultiPolygon', coordinates: [geometry.coordinates] }), true)
})
test('licence, absence, withheld/generalised data and geographical gates reject unsuitable records', () => {
  assert.ok(eligible(occurrence, geometry))
  for (const patch of [{ license: 'CC-BY-NC' }, { occurrenceStatus: 'ABSENT' }, { informationWithheld: 'sensitive' }, { dataGeneralizations: 'generalised' }, { hasGeospatialIssues: true }, { countryCode: 'IE' }, { year: null }, { decimalLongitude: 2 }, { coordinateUncertaintyInMeters: 2000 }, { coordinateUncertaintyInMeters: null }, { key: null }]) assert.equal(eligible({ ...occurrence, ...patch }, geometry), null)
})
test('all six district jobs execute; duplicates removed; public output cannot expose raw locations or IDs', async () => {
  let boundaryRequests = 0
  const snapshot = await ingestRegion(async url => {
    if (url.includes('FeatureServer')) { boundaryRequests++; const district = new URL(url).searchParams.get('where')!.split("'")[1]; return { features: [{ properties: { LAD24CD: district }, geometry }] } }
    return { results: [occurrence, occurrence], endOfRecords: true }
  }, 1)
  assert.equal(boundaryRequests, 6); assert.equal(snapshot.coverage.length, 6)
  assert.equal(snapshot.groups.reduce((n, g) => n + g.count, 0), 1)
  assert.ok(snapshot.coverage.every(c => c.state === 'complete'))
  const text = JSON.stringify(snapshot)
  for (const field of ['decimalLatitude', 'decimalLongitude', 'recordedBy', 'occurrenceID', '"key"']) assert.ok(!text.includes(field))
  const parsed = parseSnapshot({ ...snapshot, privateCase: 'strip me', groups: snapshot.groups.map(g => ({ ...g, decimalLatitude: 0.5 })) })
  assert.ok(!JSON.stringify(parsed).includes('decimalLatitude')); assert.ok(!('privateCase' in parsed))
  assert.equal(searchRegion('badgers', '', parsed).groups.length, 1)
})
test('source errors are unavailable and capped pagination is partial, never biological absence', async () => {
  const failed = await ingestRegion(async () => { throw new Error('timeout') }, 1)
  assert.equal(parseSnapshot(failed).groups.length, 0)
  assert.ok(failed.coverage.every(c => c.state === 'unavailable'))
  const partial = await ingestRegion(async url => url.includes('FeatureServer') ? { features: [{ properties: { LAD24CD: new URL(url).searchParams.get('where')!.split("'")[1] }, geometry }] } : { results: [occurrence], endOfRecords: false }, 1)
  assert.ok(partial.coverage.every(c => c.state === 'partial'))
  assert.ok(partial.coverage.every(c => c.nextOffset === 1))
})
test('invalid boundary fails closed; snapshot refuses incorrect counts and licences', async () => {
  const empty = await ingestRegion(async () => ({ features: [] }), 1)
  assert.throws(() => parseSnapshot({ ...empty, coverage: empty.coverage.slice(1) }))
  assert.throws(() => parseSnapshot({ ...empty, coverage: empty.coverage.map(c => ({ ...c, accepted: 1 })) }))
  assert.deepEqual(empty.coverage.map(c => c.district), Object.keys(DISTRICTS))
})
test('pagination continues to end and all taxa are queried without a bat/country-IE restriction', async () => {
  let pages = 0
  const result = await ingestRegion(async url => {
    const u = new URL(url)
    if (url.includes('FeatureServer')) return { features: [{ properties: { LAD24CD: u.searchParams.get('where')!.split("'")[1] }, geometry }] }
    pages++; assert.equal(u.searchParams.get('country'), 'GB'); assert.equal(u.searchParams.has('taxonKey'), false)
    return u.searchParams.get('offset') === '0' ? { results: [occurrence], endOfRecords: false } : { results: [], endOfRecords: true }
  }, 2)
  assert.equal(pages, 12); assert.ok(result.coverage.every(c => c.state === 'complete'))
})
