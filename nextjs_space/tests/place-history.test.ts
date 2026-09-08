import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exactHistoryDay, groupPlaceHistory, historyDateLabel, historySourceUrl } from '../lib/place-history'

const record = (id: string, date: string, datePrecision = 'day', assetSlug = 'enniscorthy') => ({ id, date, datePrecision, assetSlug })
test('history scopes the place, crosses the year boundary and includes both window edges', () => {
  const rows = [record('anchor', '2015-12-30'), record('before', '2015-12-23'), record('after', '2016-01-06'), record('outside', '2016-01-07'), record('other', '2015-12-30', 'day', 'cam')]
  const result = groupPlaceHistory(rows, 'enniscorthy', 'anchor', 7)
  assert.deepEqual(result.before.map(r => r.id), ['before'])
  assert.deepEqual(result.during.map(r => r.id), ['anchor'])
  assert.deepEqual(result.after.map(r => r.id), ['after'])
  assert.equal(result.outside, 1)
})
test('coarse, unknown and impossible dates never become before/after evidence', () => {
  const rows = [record('anchor', '2015-12-30'), record('month', '2015-12-01', 'month'), record('unknown', '2015-12-29', ''), record('invalid', '2015-02-30')]
  const result = groupPlaceHistory(rows, 'enniscorthy', 'anchor', 30)
  assert.equal(result.uncertain.length, 3)
  assert.equal(result.before.length, 0)
  assert.equal(exactHistoryDay(rows[3]), null)
  assert.equal(historyDateLabel(rows[1]), '2015-12')
  assert.equal(historyDateLabel(rows[2]), 'Date not established')
  assert.equal(groupPlaceHistory(rows, 'enniscorthy', 'month', 30).anchorValid, false)
  assert.equal(groupPlaceHistory(rows, 'other', 'anchor', 30).anchorValid, false)
  assert.equal(groupPlaceHistory(rows, 'enniscorthy', 'anchor', 999).anchorValid, false)
})
test('source links reject executable protocols', () => {
  assert.equal(historySourceUrl('javascript:alert(1)'), null)
  assert.equal(historySourceUrl('data:text/html,test'), null)
  assert.equal(historySourceUrl('https://example.org/report.pdf#page=27'), 'https://example.org/report.pdf#page=27')
})
