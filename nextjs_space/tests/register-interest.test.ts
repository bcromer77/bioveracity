// PR54 — Register interest validation/normalisation tests.
// Pure-logic coverage of parseInterest, normaliseSource and categoryLabel.
// All test data is clearly fictional.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseInterest,
  normaliseSource,
  categoryLabel,
  InterestError,
  INTEREST_CATEGORIES,
  INTEREST_SOURCES,
} from '../lib/register-interest/interest'

test('valid submission returns a normalised lead', () => {
  const lead = parseInterest({
    name: '  Fern Willow  ',
    email: '  Fern.Willow@EXAMPLE.com ',
    organisation: '  Meadow Trust  ',
    category: 'professional',
    message: '  Keen to hear more.  ',
    source: 'professionals',
  })
  assert.equal(lead.name, 'Fern Willow')
  assert.equal(lead.email, 'fern.willow@example.com')
  assert.equal(lead.organisation, 'Meadow Trust')
  assert.equal(lead.category, 'professional')
  assert.equal(lead.message, 'Keen to hear more.')
  assert.equal(lead.source, 'professionals')
})

test('optional fields collapse to null when blank', () => {
  const lead = parseInterest({
    name: 'Rowan Beck',
    email: 'rowan@example.com',
    category: 'other',
  })
  assert.equal(lead.organisation, null)
  assert.equal(lead.message, null)
  assert.equal(lead.source, 'general')
})

test('unknown source collapses to general', () => {
  assert.equal(normaliseSource('marketing-blast'), 'general')
  assert.equal(normaliseSource(undefined), 'general')
  assert.equal(normaliseSource(42), 'general')
})

test('every controlled source is preserved', () => {
  for (const s of INTEREST_SOURCES) {
    assert.equal(normaliseSource(s), s)
  }
})

test('missing name is rejected', () => {
  assert.throws(
    () => parseInterest({ email: 'x@example.com', category: 'other' }),
    InterestError,
  )
})

test('invalid email is rejected', () => {
  assert.throws(
    () => parseInterest({ name: 'Ada Fen', email: 'not-an-email', category: 'other' }),
    InterestError,
  )
})

test('uncontrolled category is rejected', () => {
  assert.throws(
    () => parseInterest({ name: 'Ada Fen', email: 'ada@example.com', category: 'ceo' }),
    InterestError,
  )
})

test('missing category is rejected', () => {
  assert.throws(
    () => parseInterest({ name: 'Ada Fen', email: 'ada@example.com' }),
    InterestError,
  )
})

test('oversized field is rejected', () => {
  assert.throws(
    () =>
      parseInterest({
        name: 'A'.repeat(200),
        email: 'ada@example.com',
        category: 'other',
      }),
    InterestError,
  )
})

test('honeypot field rejects the submission', () => {
  assert.throws(
    () =>
      parseInterest({
        name: 'Spam Bot',
        email: 'spam@example.com',
        category: 'other',
        company: 'Definitely A Robot Ltd',
      }),
    InterestError,
  )
})

test('non-object input is rejected', () => {
  assert.throws(() => parseInterest(null), InterestError)
  assert.throws(() => parseInterest('hello'), InterestError)
})

test('categoryLabel maps controlled values and falls back safely', () => {
  for (const c of INTEREST_CATEGORIES) {
    assert.equal(categoryLabel(c.value), c.label)
  }
  assert.equal(categoryLabel('unknown-value'), 'unknown-value')
})
