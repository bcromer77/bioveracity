import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expandQuery, rankResults, CONCEPT_GROUPS } from '../components/workspace/retrieval.mjs'

test('expandQuery drops stopwords and keeps meaningful tokens', () => {
  const { tokens } = expandQuery('what bats are near the river')
  assert.ok(tokens.includes('bats'), 'keeps "bats"')
  assert.ok(tokens.includes('river'), 'keeps "river"')
  assert.ok(!tokens.includes('what'), 'drops "what"')
  assert.ok(!tokens.includes('the'), 'drops "the"')
  assert.ok(!tokens.includes('are'), 'drops "are"')
})

test('expandQuery expands bats to Pipistrelle / Daubenton / roost', () => {
  const { terms } = expandQuery('any bats recorded?')
  const lower = terms.map(t => t.toLowerCase())
  assert.ok(lower.includes('pipistrelle'))
  assert.ok(lower.includes('daubenton'))
  assert.ok(lower.includes('roost'))
})

test('expandQuery expands flooding to inundation / waterlogged', () => {
  const { terms } = expandQuery('is there a flooding risk')
  const lower = terms.map(t => t.toLowerCase())
  assert.ok(lower.includes('inundation'))
  assert.ok(lower.includes('waterlogged'))
  assert.ok(lower.includes('floodplain'))
})

test('expandQuery keeps the exact phrase first and numeric tokens', () => {
  const { phrase, terms } = expandQuery('permit ABP-2021')
  assert.equal(phrase, 'permit ABP-2021')
  assert.equal(terms[0], 'permit ABP-2021')
  // numeric/alphanumeric ref retained despite short length
  assert.ok(terms.map(t => t.toLowerCase()).includes('abp-2021') || terms.some(t => /2021/.test(t)))
})

test('expandQuery bounds the number of terms', () => {
  const { terms } = expandQuery('bats flooding otter badger survey protected river water quality habitat planning objection kingfisher')
  assert.ok(terms.length <= 24, `expected <=24 terms, got ${terms.length}`)
})

test('rankResults ranks passages matching more concepts higher', () => {
  const perTerm = [
    { term: 'bats', hits: [{ id: 'p1', name: 'A', locator: 'p.1', text: 'bats seen' }] },
    { term: 'pipistrelle', hits: [{ id: 'p2', name: 'B', locator: 'p.2', text: 'pipistrelle roost' }] },
    { term: 'roost', hits: [{ id: 'p2', name: 'B', locator: 'p.2', text: 'pipistrelle roost' }] },
  ]
  const { ranked } = rankResults(perTerm, ['bats'])
  assert.equal(ranked.length, 2)
  assert.equal(ranked[0].id, 'p2', 'p2 matched 2 terms so ranks first')
  assert.equal(ranked[0].score, 2)
  assert.deepEqual(new Set(ranked[0].matchedTerms), new Set(['pipistrelle', 'roost']))
})

test('rankResults reports matched and unmatched concepts', () => {
  const perTerm = [
    { term: 'bats', hits: [] },
    { term: 'pipistrelle', hits: [{ id: 'p1', name: 'A', locator: 'p.1', text: 'pipistrelle' }] },
    { term: 'flood', hits: [] },
    { term: 'inundation', hits: [] },
  ]
  const { matchedConcepts, unmatchedConcepts } = rankResults(perTerm, ['bats', 'flood'])
  assert.ok(matchedConcepts.includes('bats'), 'bats matched via pipistrelle')
  assert.ok(unmatchedConcepts.includes('flood'), 'flood had no hits in any member')
})

test('rankResults dedupes a passage returned by several terms', () => {
  const perTerm = [
    { term: 'a', hits: [{ id: 'x', name: 'D', locator: 'p.9', text: 't' }] },
    { term: 'b', hits: [{ id: 'x', name: 'D', locator: 'p.9', text: 't' }] },
  ]
  const { ranked } = rankResults(perTerm, [])
  assert.equal(ranked.length, 1)
  assert.equal(ranked[0].score, 2)
})

test('CONCEPT_GROUPS are non-trivial', () => {
  assert.ok(CONCEPT_GROUPS.length >= 10)
})
