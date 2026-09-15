import test from 'node:test'
import assert from 'node:assert/strict'
import { CLAIMS } from '../lib/cambridgeshire/catalogue'
import { connections, searchRegion } from '../lib/cambridgeshire/search'
import { DISTRICTS, resolveTaxa } from '../lib/cambridgeshire/model'
import { summariseStudy, validateStudy } from '../lib/cambridgeshire/measurement'

test('badger natural language and scientific-name searches return the reviewed manager account', () => {
  for (const q of ['badger', 'badgers', 'Meles meles', 'Find me all places with badgers in Cambridgeshire']) {
    const r = searchRegion(q, '', null)
    assert.deepEqual(r.claims.map(c => c.placeSlug), ['overhall-grove'])
    assert.equal(r.claims[0].kind, 'manager-account')
    assert.match(r.claims[0].text, /not a dated field observation/)
  }
})
test('snowdrop synonyms return a cultivated seasonal display, not a wild observation', () => {
  for (const q of ['snowdrop', 'snowdrops', 'Galanthus', 'Galanthus nivalis']) {
    const r = searchRegion(q, '', null)
    assert.deepEqual(r.claims.map(c => c.placeSlug), ['anglesey-abbey'])
    assert.equal(r.claims[0].kind, 'cultivated-display')
    assert.match(r.claims[0].season, /Winter/)
  }
  assert.equal(searchRegion('snowdrops summer', '', null).claims.length, 0)
})
test('wider ecology, species and habitat queries retrieve their supported places', () => {
  assert.ok(searchRegion('dragonflies', '', null).claims.some(c => c.placeSlug === 'wicken-fen'))
  assert.ok(searchRegion('orchids', '', null).claims.some(c => c.placeSlug === 'fulbourn-fen'))
  assert.ok(searchRegion('bitterns', '', null).claims.some(c => c.placeSlug === 'ouse-fen'))
  assert.ok(searchRegion('bluebells', '', null).claims.some(c => c.placeSlug === 'gamlingay-wood'))
  assert.ok(searchRegion('wetland', '', null).claims.length > 3)
  assert.ok(searchRegion('wider ecology', '', null).claims.length === 13)
  assert.equal(searchRegion('platypus', '', null).claims.length, 0)
  assert.equal(searchRegion('otters', '', null).claims.length, 0)
  assert.equal(searchRegion('badgers in Oxford', '', null).claims.length, 0)
  assert.equal(searchRegion('snowdrops in Lode', '', null).claims.length, 1)
})
test('whole-region search includes every district and explicit area filters constrain results', () => {
  const r = searchRegion('', '', null)
  assert.equal(new Set(r.claims.map(c => c.district)).size, 6)
  assert.equal(r.coverage.length, Object.keys(DISTRICTS).length)
  assert.equal(searchRegion('Cambridgeshire and Peterborough ecology', '', null).coverage.length, 6)
  assert.ok(r.coverage.every(c => c.occurrences === null))
  assert.deepEqual(searchRegion('orchids in Peterborough', '', null).claims.map(c => c.placeSlug), ['barnack-hills-and-holes'])
  assert.equal(searchRegion('badgers', 'E06000031', null).claims.length, 0)
  assert.throws(() => searchRegion('a'.repeat(161), '', null))
})
test('all visitor links and related links resolve to existing places without species inference', () => {
  const slugs = new Set(CLAIMS.map(c => c.placeSlug))
  for (const c of CLAIMS) {
    assert.ok(c.source.locator && c.source.checkedAt && c.source.url.startsWith('https://'))
    for (const link of connections(c)) {
      assert.ok(slugs.has(link.href.split('#')[1]))
      assert.match(link.relation, /not a surveyed route or shared-species claim/)
    }
  }
})
test('LNRS connections remain thematic and do not invent funded or delivered work', () => {
  assert.match(searchRegion('woodland', '', null).lnrs.limitation, /have not been established/)
  assert.deepEqual(resolveTaxa('combat'), []) // substring must not match bat
  assert.deepEqual(resolveTaxa('bats'), ['chiroptera'])
})
test('empty measurements do not report savings or successful discovery', () => {
  assert.deepEqual(summariseStudy([]), { guestTasks: 0, newUsefulDiscoveries: 0, newUsefulRate: null, professionalPairs: 0, medianTimeSavingPercent: null, accuracyMaintained: null, initialGateMet: false })
})
test('measurement counts new useful places and paired total-time savings with accuracy gate', () => {
  const pair = { task: 'evidence-check', manualSeconds: 100, assistedSeconds: 60, manualCorrect: 4, assistedCorrect: 4, checks: 5, order: 'manual-first' }
  const results = [pair, pair, { ...pair, order: 'assisted-first' }, { task: 'guest-discovery', useful: true, previouslyKnown: false, placeId: 'place:anglesey-abbey', elapsedSeconds: 30 }, { task: 'guest-discovery', useful: true, previouslyKnown: true, placeId: 'place:wicken-fen', elapsedSeconds: 50 }]
  const s = summariseStudy(results)
  assert.equal(s.newUsefulRate, 0.5); assert.equal(s.medianTimeSavingPercent, 40); assert.equal(s.initialGateMet, true)
  assert.equal(summariseStudy([pair, pair, { ...pair, assistedCorrect: 3 }]).initialGateMet, false)
  assert.equal(summariseStudy([{ ...pair, assistedSeconds: 120 }]).medianTimeSavingPercent, -20)
  assert.throws(() => validateStudy({ ...pair, manualSeconds: 0 }))
  assert.throws(() => validateStudy({ ...pair, assistedCorrect: 10 }))
  assert.ok(!('email' in validateStudy({ ...pair, email: 'not-persisted' })))
})
