import assert from 'node:assert/strict'
import { getWildCounty, searchWildCounties, WILD_COUNTIES } from '../lib/wild-counties/counties'

assert.equal(WILD_COUNTIES.length, 32)
assert.equal(new Set(WILD_COUNTIES.map(({ slug }) => slug)).size, 32)
assert.equal(WILD_COUNTIES.filter(({ jurisdiction }) => jurisdiction === 'Northern Ireland').length, 6)
assert.equal(WILD_COUNTIES.filter(({ jurisdiction }) => jurisdiction === 'Ireland').length, 26)
assert.equal(searchWildCounties('fens')[0]?.slug, 'down')
assert.equal(searchWildCounties('oysters')[0]?.slug, 'down')
assert.equal(searchWildCounties('otters')[0]?.slug, 'kilkenny')
assert.equal(getWildCounty('down')?.businessCandidates.length, 0)

for (const county of WILD_COUNTIES) {
  for (const topic of county.topics) {
    assert.match(topic.sourceUrl, /^https:\/\//)
    assert.equal(topic.reviewStatus, 'source-reviewed')
  }
  for (const business of county.businessCandidates) {
    assert.equal(business.relationshipStatus, 'pilot-candidate')
  }
}

process.stdout.write('Wild Counties architecture tests passed\n')


assert.ok(WILD_COUNTIES.every(county => county.businessCandidates.length === 0), 'No unsigned venues in public listings')
