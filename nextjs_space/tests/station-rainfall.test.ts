import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rainfallRequest, parseRainfall, RAIN_LICENCE } from '../lib/station-rainfall'
const query = rainfallRequest('chatteris', '2025-07-10', 7)
const row = (date: string, value?: number, quality = 'Good') => ({ date, dateTime: date + 'T09:00:00', value, quality, completeness: 'Complete', measure: { '@id': 'http://environment.data.gov.uk/hydrology/id/measures/' + query.measureId } })
const packet = (items: unknown[]) => ({ meta: { publisher: 'Environment Agency', license: RAIN_LICENCE }, items })
test('bounds requests and rejects arbitrary upstream URLs, invalid dates and spans', () => {
  assert.equal(query.start, '2025-07-03')
  assert.ok(query.url.includes('max-date=2025-07-10'))
  for (const station of ['https://localhost', '__proto__', 'constructor']) assert.throws(() => rainfallRequest(station, '2025-07-10', 7))
  assert.throws(() => rainfallRequest('chatteris', '2025-02-30', 7))
  assert.throws(() => rainfallRequest('chatteris', '2025-07-10', 90))
})
test('zero remains zero, missing remains null and unchecked flags survive', () => {
  const result = parseRainfall(packet([row('2025-07-03', 0), row('2025-07-04', 1.3, 'Unchecked'), row('2025-07-05', 99, 'Missing')]), query)
  assert.equal(result.days.length, 7)
  assert.equal(result.available, 2)
  assert.equal(result.days[0].value, 0)
  assert.equal(result.days[1].quality, 'Unchecked')
  assert.equal(result.days[1].providerTime, '2025-07-04T09:00:00')
  assert.equal(result.days[2].value, null)
  assert.equal(result.days[3].value, null)
  assert.equal(result.days[3].quality, 'Not returned')
})
test('negative, string and non-finite values cannot turn into plausible readings', () => {
  for (const value of [-1, NaN, Infinity, '0', null]) {
    const r = row('2025-07-03') as Record<string, unknown>; r.value = value
    assert.equal(parseRainfall(packet([r]), query).available, 0)
  }
})
test('rejects duplicate dates, wrong series, foreign dates and unrecognised licence', () => {
  assert.throws(() => parseRainfall(packet([row('2025-07-03', 1), row('2025-07-03', 2)]), query))
  assert.throws(() => parseRainfall(packet([{ ...row('2025-07-03', 1), measure: 'https://example.org/wrong' }]), query))
  assert.throws(() => parseRainfall(packet([row('2025-07-10', 1)]), query))
  assert.throws(() => parseRainfall({ meta: { publisher: 'Environment Agency', license: 'unknown' }, items: [] }, query))
  assert.throws(() => parseRainfall(packet(Array(64).fill(row('2025-07-03', 1))), query))
})
