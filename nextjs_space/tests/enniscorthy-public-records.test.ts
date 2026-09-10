import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchBatOccurrencesNear,
  fetchPlanningApplicationsNear,
  BAT_TAXON_KEY,
  NBDC_PUBLISHER,
} from '../lib/ingest/connectors-ireland'

// A fetcher that returns a fixed JSON body, matching the pattern used by the
// other connector tests. The map connectors accept options.fetcher so no live
// network call is made.
const mock = (data: unknown) => (async () => Response.json(data)) as typeof fetch
// A fetcher that always rejects, to exercise the never-throw error path.
const boom = (async () => {
  throw new Error('network down')
}) as typeof fetch

const ENNISCORTHY = { lat: 52.5019, lng: -6.5657, radiusKm: 20 }

test('bat occurrences preserve coordinates, precision, attribution, date and source link', async () => {
  const value = {
    key: 111,
    scientificName: 'Pipistrellus pipistrellus',
    decimalLatitude: 52.51,
    decimalLongitude: -6.57,
    coordinateUncertaintyInMeters: 250,
    eventDate: '2021-06-14',
    year: 2021,
    basisOfRecord: 'HUMAN_OBSERVATION',
    publishingOrgKey: NBDC_PUBLISHER,
    institutionCode: 'NBDC',
    collectionCode: 'BatLandscape',
    license: 'CC_BY_4_0',
  }
  const r = await fetchBatOccurrencesNear(ENNISCORTHY, { fetcher: mock({ results: [value] }) })
  assert.equal(r.layer, 'species')
  assert.equal(r.status, 'ok')
  assert.equal(r.records.length, 1)
  const rec = r.records[0]
  assert.equal(rec.kind, 'species')
  assert.equal(rec.title, 'Pipistrellus pipistrellus')
  // real coordinates preserved (plottable)
  assert.equal(rec.lat, 52.51)
  assert.equal(rec.lng, -6.57)
  assert.equal(rec.precisionMeters, 250)
  assert.equal(rec.generalised, false)
  // provider attribution mapped from the NBDC publisher key
  assert.match(rec.subtitle, /National Biodiversity Data Centre via GBIF/)
  // observation date and precision preserved exactly
  assert.equal(rec.eventDate, '2021-06-14')
  assert.equal(rec.datePrecision, 'day')
  // source link points at the real GBIF occurrence record
  assert.equal(rec.sourceUrl, 'https://www.gbif.org/occurrence/111')
  assert.equal(rec.license, 'CC_BY_4_0')
})

test('generalised bat records are KEPT and flagged, not dropped', async () => {
  const generalisedByFlag = {
    key: 222, scientificName: 'Myotis daubentonii', decimalLatitude: 52.5, decimalLongitude: -6.55,
    coordinateUncertaintyInMeters: 1000, eventDate: '2019', year: 2019, dataGeneralizations: 'Coordinates generalised',
  }
  const generalisedByPrecision = {
    key: 333, scientificName: 'Nyctalus leisleri', decimalLatitude: 52.49, decimalLongitude: -6.6,
    coordinateUncertaintyInMeters: 10000, eventDate: '2018', year: 2018,
  }
  const r = await fetchBatOccurrencesNear(ENNISCORTHY, {
    fetcher: mock({ results: [generalisedByFlag, generalisedByPrecision] }),
  })
  assert.equal(r.records.length, 2)
  assert.ok(r.records.every((x) => x.generalised === true), 'both flagged generalised')
  // year-only date precision preserved, not fabricated to a day
  assert.equal(r.records[0].datePrecision, 'year')
  assert.equal(r.records[0].eventDate, '2019')
})

test('bat records without usable coordinates are skipped', async () => {
  const noCoords = { key: 444, scientificName: 'Plecotus auritus', eventDate: '2020' }
  const r = await fetchBatOccurrencesNear(ENNISCORTHY, { fetcher: mock({ results: [noCoords] }) })
  assert.equal(r.status, 'empty')
  assert.equal(r.records.length, 0)
})

test('bat retrieval never throws: upstream failure -> status error, layer stays off', async () => {
  const r = await fetchBatOccurrencesNear(ENNISCORTHY, { fetcher: boom })
  assert.equal(r.status, 'error')
  assert.equal(r.records.length, 0)
  assert.match(r.error ?? '', /could not be retrieved/i)
})

test('bat retrieval on a bad schema -> status error', async () => {
  const r = await fetchBatOccurrencesNear(ENNISCORTHY, { fetcher: mock({ notResults: true }) })
  assert.equal(r.status, 'error')
})

test('empty GBIF result -> status empty, not error', async () => {
  const r = await fetchBatOccurrencesNear(ENNISCORTHY, { fetcher: mock({ results: [] }) })
  assert.equal(r.status, 'empty')
  assert.equal(r.records.length, 0)
})

test('bat query scopes to order Chiroptera (taxonKey 734)', () => {
  assert.equal(BAT_TAXON_KEY, 734)
})

test('planning applications preserve reference, status, description, date and source link', async () => {
  const feature = {
    attributes: {
      OBJECTID: 9,
      PlanningAuthority: 'Wexford County Council',
      ApplicationNumber: '20260123',
      ApplicationStatus: 'Decided',
      DevelopmentDescription: 'Construction of a dwelling and associated works',
      ReceivedDate: Date.UTC(2026, 0, 15),
    },
    geometry: { x: -6.56, y: 52.5 },
  }
  const r = await fetchPlanningApplicationsNear(ENNISCORTHY, { fetcher: mock({ features: [feature] }) })
  assert.equal(r.layer, 'planning')
  assert.equal(r.status, 'ok')
  assert.equal(r.records.length, 1)
  const rec = r.records[0]
  assert.equal(rec.kind, 'planning')
  assert.match(rec.title, /20260123/)
  assert.equal(rec.subtitle, 'Wexford County Council')
  assert.equal(rec.status, 'Decided')
  assert.equal(rec.detail, 'Construction of a dwelling and associated works')
  assert.equal(rec.lat, 52.5)
  assert.equal(rec.lng, -6.56)
  assert.equal(rec.generalised, false)
  // epoch-ms received date rendered as an ISO day
  assert.equal(rec.eventDate, '2026-01-15')
  assert.match(rec.sourceUrl, /IrishPlanningApplications/)
})

test('planning features without geometry are skipped', async () => {
  const feature = { attributes: { OBJECTID: 1, ApplicationNumber: 'X1' } }
  const r = await fetchPlanningApplicationsNear(ENNISCORTHY, { fetcher: mock({ features: [feature] }) })
  assert.equal(r.status, 'empty')
  assert.equal(r.records.length, 0)
})

test('planning retrieval never throws: upstream failure -> status error', async () => {
  const r = await fetchPlanningApplicationsNear(ENNISCORTHY, { fetcher: boom })
  assert.equal(r.status, 'error')
  assert.equal(r.records.length, 0)
  assert.match(r.error ?? '', /could not be retrieved/i)
})

test('planning empty result -> status empty', async () => {
  const r = await fetchPlanningApplicationsNear(ENNISCORTHY, { fetcher: mock({ features: [] }) })
  assert.equal(r.status, 'empty')
})
