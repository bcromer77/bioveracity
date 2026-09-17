import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cellAt, pointInCell } from '../lib/honeycomb/geometry'
import { searchGazetteer } from '../components/workspace/ireland-gazetteer.mjs'
import { RIVER_ANCHORS } from '../components/workspace/irish-rivers.mjs'

// searchGazetteer is the workspace's named-place -> Honeycomb entry bridge. It
// is pure lexical (no vector/embedding dependency), so these assertions also
// prove the semantic-unavailable fallback required by the spec: the five river
// names resolve regardless of any embedding service.

/** Top-ranked curated-river row for a query, or undefined. */
function topRiver(query: string): any {
  return (searchGazetteer(query, 6) as any[]).find((place) => place.kind === 'river')
}

/** Every curated-river row a query surfaces. */
function riverRows(query: string): any[] {
  return (searchGazetteer(query, 6) as any[]).filter((place) => place.kind === 'river')
}

test('every target river resolves from ordinary human searches (lexical only)', () => {
  const cases: Array<[string, string, string]> = [
    // query, expected river key, expected county of the top row
    ['River Nore', 'nore', 'Kilkenny'],
    ['Nore', 'nore', 'Kilkenny'],
    ['River Slaney', 'slaney', 'Wexford'],
    ['Slaney', 'slaney', 'Wexford'],
    ['River Dodder', 'dodder', 'Dublin'],
    ['Dodder', 'dodder', 'Dublin'],
    ['Dodder Dublin', 'dodder', 'Dublin'],
    ['River Shannon', 'shannon', 'Westmeath'],
    ['Shannon', 'shannon', 'Westmeath'],
    ['Blackwater river Cork', 'blackwater-munster', 'Cork'],
    ['River Blackwater', 'blackwater-munster', 'Cork']
  ]
  for (const [query, river, county] of cases) {
    const top = topRiver(query)
    assert.ok(top, `"${query}" should resolve to a curated river`)
    assert.equal(top.river, river, `"${query}" should resolve to river ${river}`)
    assert.equal(top.county, county, `"${query}" top row should be in ${county}`)
    assert.equal(typeof top.lat, 'number')
    assert.equal(typeof top.lng, 'number')
  }
})

test('Shannon is a bounded corridor: a plain search surfaces every named stretch', () => {
  const rows = riverRows('River Shannon')
  const shannon = rows.filter((r: any) => r.river === 'shannon')
  assert.equal(shannon.length, 2, 'Shannon should surface both stretches')
  const counties = shannon.map((r: any) => r.county).sort()
  assert.deepEqual(counties, ['Limerick', 'Westmeath'])
  // Distinct on-river anchors, not one point pretending to be the whole river.
  assert.notEqual(shannon[0].lat, shannon[1].lat)
})

test('Blackwater ambiguity: every Blackwater search resolves only to the Munster river', () => {
  for (const query of ['Blackwater', 'blackwater', 'River Blackwater', 'Blackwater river Cork', 'Munster Blackwater', 'Blackwater Cork']) {
    const rows = riverRows(query)
    assert.ok(rows.length >= 1, `"${query}" should resolve to a river`)
    for (const row of rows) {
      assert.equal(row.river, 'blackwater-munster', `"${query}" must never resolve to another river (got ${row.river})`)
      assert.equal(row.county, 'Cork')
    }
  }
})

test('no cross-river leak: a river-name search never surfaces a different target river', () => {
  const names: Record<string, string> = {
    Nore: 'nore',
    Slaney: 'slaney',
    Dodder: 'dodder',
    Shannon: 'shannon'
  }
  for (const [query, expected] of Object.entries(names)) {
    const others = riverRows(query).filter((r: any) => r.river !== expected)
    assert.equal(others.length, 0, `"${query}" leaked another river: ${others.map((o: any) => o.river).join(', ')}`)
  }
})

test('spatial false-positive protection: distinct rivers occupy distinct cells', () => {
  const nore = RIVER_ANCHORS.find((r: any) => r.river === 'nore')!.anchors[0]
  const dodder = RIVER_ANCHORS.find((r: any) => r.river === 'dodder')!.anchors[0]
  const noreCell = cellAt({ lat: nore.lat, lng: nore.lng }, 1000)
  const dodderCell = cellAt({ lat: dodder.lat, lng: dodder.lng }, 1000)
  // Anchors on different rivers must not collapse to the same Honeycomb cell.
  assert.notEqual(noreCell.id, dodderCell.id)
  // The Nore anchor belongs to the Nore cell; the far Dodder anchor does not.
  assert.equal(pointInCell({ lat: nore.lat, lng: nore.lng }, noreCell), true)
  assert.equal(pointInCell({ lat: dodder.lat, lng: dodder.lng }, noreCell), false)
})

test('every river anchor sits inside the supported Honeycomb geometry domain', () => {
  for (const river of RIVER_ANCHORS) {
    assert.ok(river.anchors.length >= 1, `${river.river} needs at least one anchor`)
    for (const anchor of river.anchors) {
      assert.doesNotThrow(
        () => cellAt({ lat: anchor.lat, lng: anchor.lng }, 1000),
        `${river.river} anchor ${anchor.label} must be inside the Ireland grid`
      )
    }
  }
})

test('a real place search is unaffected by the added river rows', () => {
  const kilkenny = searchGazetteer('Kilkenny', 6)
  assert.ok(kilkenny.some((p: any) => p.kind === 'county' && p.county === 'Kilkenny'))
  const enniscorthy = searchGazetteer('Enniscorthy', 6)
  assert.ok(enniscorthy.some((p: any) => p.kind === 'town' && p.name === 'Enniscorthy'))
})
