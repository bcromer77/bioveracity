import assert from 'node:assert/strict'
import { getWildCounty, searchWildCounties, WILD_COUNTIES } from '../lib/wild-counties/counties'

assert.equal(WILD_COUNTIES.length, 33)
assert.equal(new Set(WILD_COUNTIES.map(({ slug }) => slug)).size, 33)
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

const cambs = getWildCounty('cambridgeshire')!
assert.equal(cambs.jurisdiction, 'England')
assert.equal(cambs.topics.length, 12)
for (const query of ['snowdrops', 'bluebells', 'Peterborough', 'Earith', 'winter gardens']) {
  assert.ok(searchWildCounties(query).some(county => county.slug === 'cambridgeshire'), query)
}
const ids = new Set(cambs.topics.map(topic => topic.slug))
assert.equal(ids.size, 12)
for (const topic of cambs.topics) {
  assert.ok(topic.sourceLocator && topic.checkedAt && topic.access && topic.season)
  assert.equal(topic.evidenceScope, 'site')
  assert.ok(topic.relatedSlugs?.length)
  for (const related of topic.relatedSlugs!) assert.ok(ids.has(related) && related !== topic.slug)
}
assert.match(cambs.topics.find(topic => topic.slug === 'gamlingay-wood')!.access!, /No parking/)
assert.match(cambs.topics.find(topic => topic.slug === 'woodwalton-fen')!.access!, /flood/)
process.stdout.write('Cambridgeshire discovery and access checks passed\n')
