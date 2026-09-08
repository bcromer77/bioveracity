import assert from 'node:assert/strict'
import test from 'node:test'
import { INVESTIGATIONS, investigationCoverage } from '../lib/investigation-questions'
test('coverage is scoped and preserves unknown/coarse dates without inventing completeness', () => {
  const rows = [
    { assetSlug: 'cam', date: '2022-01-01', datePrecision: 'year', sourceUrl: 'https://example.org' },
    { assetSlug: 'cam', date: '2025-01-01', datePrecision: 'unknown', sourceUrl: null },
    { assetSlug: 'other', date: '2026-01-01', datePrecision: 'day', sourceUrl: 'https://example.org' },
  ]
  assert.deepEqual(investigationCoverage(rows, 'cam'), { records: 2, linked: 1, from: '2022', to: '2022', unknownDates: 1 })
  assert.equal(investigationCoverage([], null).from, null)
  assert.equal(investigationCoverage(rows, 'missing').records, 0)
})
test('question register covers eight families and forty distinct test prompts', () => {
  assert.equal(INVESTIGATIONS.length, 8)
  assert.equal(new Set(INVESTIGATIONS.flatMap(i => [...i.examples])).size, 40)
})
