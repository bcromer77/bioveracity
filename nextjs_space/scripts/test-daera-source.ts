import assert from 'node:assert/strict'
import { fingerprint, schema21 } from '../lib/ingest/schema-2-1'
import { STRANGFORD_LOUGH_DAERA_RECORDS } from '../lib/sources/daera/strangford-lough'
import { buildStrangfordLoughSeed } from '../lib/sources/daera/to-schema-2-1'

const fixedRetrieval = '2026-09-14T00:00:00.000Z'
const payload = buildStrangfordLoughSeed(fixedRetrieval)

assert.equal(schema21.safeParse(payload).success, true)
assert.equal(STRANGFORD_LOUGH_DAERA_RECORDS.length, 3)
assert.equal(new Set(STRANGFORD_LOUGH_DAERA_RECORDS.map((record) => record.recordId)).size, 3)

for (const record of STRANGFORD_LOUGH_DAERA_RECORDS) {
  assert.match(record.sourceUrl, /^https:\/\/www\.daera-ni\.gov\.uk\/protected-areas\//)
  assert.equal(record.publicationDate, null)
  assert.equal(record.publicationDatePrecision, 'unknown')
  assert.ok(record.supportingPassage.length > 40)
}

const serialised = JSON.stringify(payload).toLowerCase()
assert.doesNotMatch(serialised, /daera[- ]approved|daera[- ]certified|endorsed by daera/)
assert.equal(payload.commercial.regulator_endorsement, false)
assert.equal(fingerprint(payload), fingerprint(buildStrangfordLoughSeed(fixedRetrieval)))

process.stdout.write('DAERA source adapter tests passed\n')

