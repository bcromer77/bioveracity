import test from 'node:test'
import assert from 'node:assert/strict'
import { SOURCE_TRAINS, healthReceipt } from '../lib/observations/source-health'
import {
  cambridgeshireOccurrenceToObservation,
  eaRainfallToObservation,
  fieldJournalToObservation,
  naturalEnglandSssiToObservation,
} from '../lib/observations/source-plumbing'

test('source registry makes authority boundaries explicit', () => {
  assert.match(SOURCE_TRAINS['natural-england-sssi'].notAuthoritativeFor, /condition/i)
  assert.match(SOURCE_TRAINS['environment-agency-rainfall'].notAuthoritativeFor, /site or catchment/i)
})

test('health receipt rejects impossible counts', () => {
  assert.throws(() => healthReceipt({
    sourceId: 'cambridgeshire-gbif',
    state: 'PARTIAL',
    lastAttemptedAt: '2026-09-19T12:00:00Z',
    lastSuccessfulAt: '2026-09-19T12:00:00Z',
    inspected: 10,
    accepted: 11,
    coverageNote: 'bounded test',
    failureReason: null,
    sourceVersion: 'v1',
    nextScheduledAt: null,
  }), /accepted cannot exceed inspected/)
})

test('field journal stays a community observation', () => {
  const event = fieldJournalToObservation({
    id: 'c1', hubId: 'h1', broadCategory: 'bird', whatYouThink: 'swallow',
    createdAt: '2026-09-19T12:00:00Z',
  })
  assert.equal(event.findings[0].evidenceClass, 'COMMUNITY')
  assert.equal(event.findings[0].state, 'REPORTED')
})

test('Cambridgeshire occurrence remains presence record rather than population measure', () => {
  const event = cambridgeshireOccurrenceToObservation({
    key: 42,
    eventId: 'survey-9',
    scientificName: 'Aeshna cyanea',
    eventDate: '2026-07-01',
    retrievedAt: '2026-09-19T12:00:00Z',
    datasetKey: 'dataset-1',
    datasetTitle: 'Example recording scheme',
    licence: 'CC BY 4.0',
  })
  assert.equal(event.findings[0].state, 'DETECTED')
  assert.equal(event.findings[0].value, undefined)
})

test('Natural England record stays spatial context', () => {
  const event = naturalEnglandSssiToObservation({
    reference: '1001',
    name: 'Example SSSI',
    geometry: { type: 'Polygon', coordinates: [] },
    retrievedAt: '2026-09-19T12:00:00Z',
    sourceUrl: 'https://example.invalid/sssi',
    licence: 'OGL v3',
  })
  assert.equal(event.findings[0].state, 'CONTEXT_ONLY')
})

test('EA rainfall is a unit-bearing physical measurement scoped to station', () => {
  const event = eaRainfallToObservation({
    stationId: 'chatteris',
    date: '2026-09-18',
    value: 4.2,
    quality: 'Good',
    retrievedAt: '2026-09-19T12:00:00Z',
    sourceUrl: 'https://example.invalid/rain',
    licence: 'OGL v3',
  })
  assert.equal(event.findings[0].unit, 'mm/day')
  assert.match(event.place.scopeNote ?? '', /not automatically a site estimate/i)
})
