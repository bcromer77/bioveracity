import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cellAt, neighbours } from '../lib/honeycomb/geometry'
import {
  parseHoneycombQuery,
  filterHits,
  dateMatches,
  validDay,
  authorisedHoneycombSearch
} from '../lib/honeycomb/search'
import {
  fetchDesignations,
  fetchPlanning,
  fetchSpecies,
  runHoneycombSearch
} from '../lib/honeycomb/providers'
import type { HoneycombHit } from '../lib/honeycomb/types'
const cell = cellAt({ lat: 52.65, lng: -7.25 })
const query = parseHoneycombQuery({ cells: [cell.id], q: '' })
const reply = (v: unknown) =>
  new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json' } })
const hit: HoneycombHit = {
  id: 'a',
  kind: 'species',
  title: 'Lutra lutra',
  sourceUrl: 'https://example.org/a',
  publisher: 'Source',
  licence: 'CC BY 4.0',
  eventDate: '2024',
  datePrecision: 'year',
  cellIds: [cell.id],
  spatialRelation: 'reported-point-in-cell',
  matchReason: 'Reported point',
  details: 'Otter'
}

test('query bounds, valid calendars and interval-overlap dates', () => {
  for (const v of [
    { cells: [] },
    { cells: Array(8).fill(cell.id) },
    { cells: ['bad'] },
    { cells: [cell.id], q: 'x'.repeat(161) },
    { cells: [cell.id], from: '2025-02-30' },
    { cells: [cell.id], from: '2025-01-01', to: '2024-01-01' },
    { cells: [cell.id, cellAt(cell.center, 500).id] }
  ])
    assert.throws(() => parseHoneycombQuery(v))
  assert.equal(validDay('2024-02-29'), true)
  assert.equal(validDay('2025-02-29'), false)
  assert.equal(validDay('2024-99-99'), false)
  assert.equal(dateMatches(hit, '2024-06-01', '2024-06-30'), true)
  assert.equal(
    dateMatches({ ...hit, eventDate: '2024-02', datePrecision: 'month' }, '2024-02-29', '2024-02-29'),
    true
  )
  assert.equal(dateMatches({ ...hit, eventDate: null, datePrecision: 'unknown' }, '2024-01-01', ''), false)
  assert.equal(filterHits([hit], { ...query, q: 'otter' }).length, 1)
  assert.equal(filterHits([hit], { ...query, q: 'bat' }).length, 0)
})
test('NPWS uses actual cell polygon, preserves site identity and deduplicates spanning sites', async () => {
  const adjacent = neighbours(cell, 1).find((c) => c.id !== cell.id)!
  let calls = 0
  const request = (async (input) => {
    calls++
    const u = new URL(String(input))
    assert.equal(u.searchParams.get('geometryType'), 'esriGeometryPolygon')
    const polygon = JSON.parse(u.searchParams.get('geometry')!)
    assert.equal(polygon.rings[0].length, 7)
    assert.equal(u.searchParams.get('spatialRel'), 'esriSpatialRelIntersects')
    return reply({
      features: u.pathname.includes('/3/')
        ? [
            {
              attributes: {
                SITECODE: '002162',
                SITE_NAME: 'River Barrow and River Nore SAC',
                HA: 12325,
                VERSION: 3.04
              }
            }
          ]
        : []
    })
  }) as typeof fetch
  const batches = await fetchDesignations([cell, adjacent], { request })
  assert.equal(calls, 8)
  const results = filterHits(
    batches.flatMap((b) => b.hits),
    { ...query, cells: [cell, adjacent] }
  )
  assert.equal(results.length, 1)
  assert.equal(results[0].cellIds.length, 2)
  assert.equal(results[0].spatialRelation, 'site-intersects-cell')
  assert.equal(results[0].location, undefined)
  assert.equal(results[0].eventDate, null)
})
test('partial NPWS source is distinguished from an empty successful layer', async () => {
  const batches = await fetchDesignations([cell], {
    request: (async (input) => {
      if (String(input).includes('/0/')) throw Error('offline')
      return reply({ features: [], exceededTransferLimit: String(input).includes('/3/') })
    }) as typeof fetch
  })
  assert.equal(batches[0].coverage.status, 'error')
  assert.equal(batches[1].coverage.status, 'ok')
  assert.equal(batches[3].coverage.status, 'partial')
})
test('planning matches cell geometry, keeps distinct IDs and admits unknown dates honestly', async () => {
  const point = cell.center,
    other = neighbours(cell, 1).find((c) => c.id !== cell.id)!.center
  const feature = (id: number, p = point) => ({
    attributes: {
      OBJECTID: id,
      PlanningAuthority: `Authority ${id}`,
      ApplicationNumber: 'same-reference',
      ReceivedDate: null
    },
    geometry: { x: p.lng, y: p.lat }
  })
  const result = await fetchPlanning([cell], {
    request: (async () =>
      reply({
        features: [feature(1), feature(2), feature(3, other), feature(4, { lat: 999, lng: 999 })]
      })) as typeof fetch
  })
  assert.equal(result.coverage.status, 'partial')
  assert.equal(result.hits.length, 2)
  assert.notEqual(result.hits[0].id, result.hits[1].id)
  assert.equal(result.hits[0].eventDate, null)
})
test('bat reuse, precision and withheld-location gates exclude unsafe context', async () => {
  const a = {
    key: 1,
    countryCode: 'IE',
    order: 'Chiroptera',
    occurrenceStatus: 'PRESENT',
    decimalLatitude: cell.center.lat,
    decimalLongitude: cell.center.lng,
    coordinateUncertaintyInMeters: 30,
    scientificName: 'Pipistrellus pipistrellus',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    eventDate: '2024-06'
  }
  const result = await fetchSpecies([cell], {
    request: (async () =>
      reply({
        endOfRecords: true,
        results: [
          a,
          { ...a, key: 2, informationWithheld: 'location withheld' },
          { ...a, key: 3, coordinateUncertaintyInMeters: null },
          { ...a, key: 4, license: 'https://creativecommons.org/licenses/by-nc/4.0/' },
          { ...a, key: 5, license: 'https://creativecommons.org/publicdomain/zero/1.0/' },
          { ...a, key: 7, occurrenceStatus: 'ABSENT' },
          { ...a, key: 8, decimalLatitude: 999 },
          { ...a, key: 6, eventDate: '2020-01-01/2024-01-01' }
        ]
      })) as typeof fetch
  })
  assert.equal(result.hits.length, 3)
  assert.equal(result.coverage.status, 'partial')
  assert.equal(result.hits[0].datePrecision, 'month')
  assert.equal(result.hits[2].eventDate, null)
  assert.equal(result.hits[0].precisionMeters, 30)
})
test('bounded pagination reports capped inspection, keyword filtering does not erase coverage', async () => {
  let calls = 0
  const response = await runHoneycombSearch(
    { ...query, q: 'not-present' },
    {
      request: (async (input) => {
        const url = String(input)
        calls++
        if (url.includes('gbif')) return reply({ results: [], endOfRecords: false })
        return reply({ features: [], exceededTransferLimit: url.includes('IrishPlanning') })
      }) as typeof fetch,
      now: () => new Date('2026-09-14T12:00:00Z')
    }
  )
  assert.equal(calls, 8)
  assert.equal(response.results.length, 0)
  assert.equal(response.sources.length, 6)
  assert.equal(response.sources.find((s) => s.id === 'planning')!.status, 'partial')
  assert.equal(response.sources.find((s) => s.id === 'bats')!.status, 'partial')
})
test('case denial precedes even input reading and every upstream call', async () => {
  let read = false,
    queried = false
  await assert.rejects(
    authorisedHoneycombSearch(
      {
        getCase: async () => {
          throw Error('denied')
        }
      },
      'w',
      'c',
      async () => {
        read = true
        return { cells: [cell.id] }
      },
      async () => {
        queried = true
      }
    ),
    /denied/
  )
  assert.equal(read, false)
  assert.equal(queried, false)
})
