import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineMeters, pairPlanningNearBats, countGeneralised } from '../components/workspace/proximity.mjs'

test('haversineMeters computes a correct great-circle distance', () => {
  // Two points ~1 km apart near Enniscorthy.
  const a = { lat: 52.5, lng: -6.56 }
  const b = { lat: 52.509, lng: -6.56 } // ~1001 m north
  const d = haversineMeters(a, b)
  assert.ok(Math.abs(d - 1001) < 20, `expected ~1001 m, got ${d}`)
  // Zero distance for identical points.
  assert.equal(Math.round(haversineMeters(a, a)), 0)
})

const planning = [
  { id: 'planning:P1', title: 'App P1', status: 'Decided', eventDate: '2026-01-15', sourceUrl: 'https://plan/1', lat: 52.5, lng: -6.56 },
  { id: 'planning:P2', title: 'App P2', status: 'New', eventDate: '2026-02-01', sourceUrl: 'https://plan/2', lat: 52.6, lng: -6.9 },
]
const bats = [
  { id: 'gbif:1', title: 'Pipistrelle', eventDate: '2021-06-14', sourceUrl: 'https://gbif/1', lat: 52.5009, lng: -6.56, generalised: false, precisionMeters: 100 },
  { id: 'gbif:2', title: 'Daubenton (generalised)', eventDate: '2019', sourceUrl: 'https://gbif/2', lat: 52.5, lng: -6.56, generalised: true, precisionMeters: 10000 },
]

test('pairPlanningNearBats pairs only precise bats within the radius', () => {
  const pairs = pairPlanningNearBats(planning, bats, 2000)
  // P1 is ~100 m from the precise bat; P2 is far. The generalised bat is skipped.
  assert.equal(pairs.length, 1)
  assert.equal(pairs[0].planningId, 'planning:P1')
  assert.equal(pairs[0].batId, 'gbif:1')
  assert.ok(pairs[0].distanceMeters <= 2000)
  // both source links + dates carried for the reviewer
  assert.equal(pairs[0].planning.sourceUrl, 'https://plan/1')
  assert.equal(pairs[0].bat.sourceUrl, 'https://gbif/1')
  assert.equal(pairs[0].planning.date, '2026-01-15')
  assert.equal(pairs[0].bat.date, '2021-06-14')
})

test('generalised bat records are never used for distance comparison', () => {
  // Only the generalised bat exists -> no pairs regardless of proximity.
  const pairs = pairPlanningNearBats(planning, [bats[1]], 5000)
  assert.equal(pairs.length, 0)
  assert.equal(countGeneralised([bats[1]]), 1)
  assert.equal(countGeneralised(bats), 1)
})

test('pairs are sorted nearest first', () => {
  const closeBat = { id: 'gbif:close', title: 'Close bat', eventDate: '2022', sourceUrl: 'https://gbif/close', lat: 52.50005, lng: -6.56, generalised: false }
  const farBat = { id: 'gbif:far', title: 'Far bat', eventDate: '2022', sourceUrl: 'https://gbif/far', lat: 52.508, lng: -6.56, generalised: false }
  const pairs = pairPlanningNearBats([planning[0]], [farBat, closeBat], 3000)
  assert.equal(pairs.length, 2)
  assert.equal(pairs[0].batId, 'gbif:close')
  assert.ok(pairs[0].distanceMeters <= pairs[1].distanceMeters)
})

test('empty / missing inputs are handled safely', () => {
  assert.deepEqual(pairPlanningNearBats(undefined, undefined), [])
  assert.deepEqual(pairPlanningNearBats([], []), [])
  assert.equal(countGeneralised(undefined), 0)
})
