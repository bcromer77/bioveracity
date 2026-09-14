import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { validateEdition, type Edition } from '../lib/brochure/edition'
import { renderEdition, BROCHURE_RENDERER_VERSION } from '../lib/brochure/render-edition'
import { BROCHURE_TEMPLATE_VERSION } from '../lib/brochure/tokens'
import { ALL_FIXTURES, potteryFixture } from '../lib/brochure/fixtures'

// Every business-type fixture must validate and render through the ONE shared
// renderer to exactly six pages — that is the consistency guarantee.
test('all business-type fixtures validate and render to six pages', async () => {
  assert.equal(ALL_FIXTURES.length, 4)
  for (const { label, edition } of ALL_FIXTURES) {
    const v = validateEdition(edition)
    assert.equal(v.ok, true, `${label} should validate: ${v.errors.map(e => e.field).join(', ')}`)
    const res = await renderEdition(edition)
    assert.equal(res.pageCount, 6, `${label} must be 6 pages`)
    assert.ok(res.byteLength > 2000, `${label} must produce real bytes`)
    // Confirm it is a real, loadable PDF.
    const reopened = await PDFDocument.load(res.bytes)
    assert.equal(reopened.getPageCount(), 6)
  }
})

test('renderer and template versions are stamped', () => {
  assert.match(BROCHURE_RENDERER_VERSION, /bv-brochure-renderer\//)
  assert.match(BROCHURE_TEMPLATE_VERSION, /bv-brochure\//)
})

// The validator must REFUSE to silently accept overflow — it reports an actionable
// error identifying the field and the limit, never truncating.
test('overflow is reported, never truncated', () => {
  const over: Edition = { ...potteryFixture, headline: 'x'.repeat(200) }
  const v = validateEdition(over)
  assert.equal(v.ok, false)
  const issue = v.errors.find(e => e.field === 'headline')
  assert.ok(issue, 'headline overflow must be flagged')
  assert.match(issue!.message, /allows up to 90/)
})

test('missing required content blocks publication with specific messages', () => {
  const empty: Edition = {
    ...potteryFixture,
    headline: '',
    story: '',
    landscapeConnection: '',
    photos: [],
  }
  const v = validateEdition(empty)
  assert.equal(v.ok, false)
  for (const field of ['headline', 'story', 'landscapeConnection', 'photos']) {
    assert.ok(v.errors.some(e => e.field === field), `expected error for ${field}`)
  }
})

test('unconfirmed photo rights block inclusion', () => {
  const ed: Edition = {
    ...potteryFixture,
    photos: potteryFixture.photos.map((p, i) => (i === 0 ? { ...p, rightsConfirmed: false } : p)),
  }
  const v = validateEdition(ed)
  assert.equal(v.ok, false)
  assert.ok(v.errors.some(e => e.field.includes('rights')))
})

test('ecology cards must cite an existing source', () => {
  const ed: Edition = {
    ...potteryFixture,
    ecologyCards: [{ id: 'x', commonName: 'Robin', scientificName: 'Erithacus rubecula', scope: 'wider-area', body: 'A garden bird.', sourceIds: ['does-not-exist'] }],
  }
  const v = validateEdition(ed)
  assert.equal(v.ok, false)
  assert.ok(v.errors.some(e => e.field.includes('sources') && /not in the source list/.test(e.message)))
})

test('too few ecology stories warns but does not block', () => {
  const ed: Edition = { ...potteryFixture, ecologyCards: potteryFixture.ecologyCards.slice(0, 1) }
  const v = validateEdition(ed)
  assert.equal(v.ok, true)
  assert.ok(v.warnings.some(e => e.field === 'ecologyCards'))
})
