import test from 'node:test'
import assert from 'node:assert/strict'
import { cellAt, cellFromId, neighbours, pointInCell, cellsBounds } from '../lib/honeycomb/geometry'

test('stable cells roundtrip across Ireland at every scale; closed six-edge rings', () => {
  for (const size of [500, 1000, 2000])
    for (let lat = 51.1; lat < 56; lat += 0.2)
      for (let lng = -10.9; lng < -5; lng += 0.3) {
        const cell = cellAt({ lat, lng }, size)
        assert.deepEqual(cellFromId(cell.id), cell)
        assert.equal(cellAt(cell.center, size).id, cell.id)
        assert.equal(cell.ring.length, 7)
        assert.deepEqual(cell.ring[0], cell.ring[6])
        assert.ok(pointInCell({ lat, lng }, cell))
      }
})
test('hex graph has 7 and 19 cells, no duplicates, and symmetric adjacency', () => {
  const c = cellAt({ lat: 53.5, lng: -8 })
  assert.equal(neighbours(c, 0).length, 1)
  assert.equal(neighbours(c, 1).length, 7)
  assert.equal(neighbours(c).length, 19)
  assert.equal(new Set(neighbours(c).map((n) => n.id)).size, 19)
  for (const n of neighbours(c, 1)) assert.ok(neighbours(n, 1).some((v) => v.id === c.id))
})
test('shared boundaries have one owner; bbox corner is not hex membership', () => {
  const c = cellAt({ lat: 53.5, lng: -8 }),
    adjacent = neighbours(c, 1)
  for (let i = 0; i < 6; i++) {
    const a = c.ring[i],
      b = c.ring[i + 1]
    const midpoint = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
    assert.equal(adjacent.filter((n) => pointInCell(midpoint, n)).length, 1)
    assert.equal(adjacent.filter((n) => pointInCell(a, n)).length, 1)
  }
  const bounds = cellsBounds([c])
  assert.equal(pointInCell({ lat: bounds.north, lng: bounds.east }, c), false)
  for (const p of c.ring)
    assert.ok(p.lng >= bounds.west && p.lng <= bounds.east && p.lat >= bounds.south && p.lat <= bounds.north)
})
test('domain edges retain ownership and IDs; malformed values fail closed', () => {
  for (const lat of [51, 56])
    for (const lng of [-11, -5]) {
      const cell = cellAt({ lat, lng })
      assert.equal(cellFromId(cell.id).id, cell.id)
      assert.ok(pointInCell({ lat, lng }, cell))
    }
  for (const p of [
    { lat: NaN, lng: -8 },
    { lat: 57, lng: -8 },
    { lat: 53, lng: Infinity }
  ])
    assert.throws(() => cellAt(p))
  assert.throws(() => cellAt({ lat: 53, lng: -8 }, 750))
  for (const id of ['iehex2:1000:0:0', 'iehex1:1000:-0:0', 'iehex1:1000:999999999:0', 'iehex1:1000:01:0'])
    assert.throws(() => cellFromId(id))
  assert.throws(() => cellsBounds([]))
  assert.throws(() => neighbours(cellAt({ lat: 53, lng: -8 }), 6))
})
