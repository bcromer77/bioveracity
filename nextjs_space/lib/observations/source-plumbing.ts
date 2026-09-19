import {
  fromCommunityObservation,
  fromOccurrenceRecord,
  fromPhysicalMeasurement,
  fromSpatialContext,
} from './adapters'
import type { ObservationEvent } from './contract'

export function fieldJournalToObservation(input: {
  id: string
  hubId: string
  broadCategory: string
  whatYouThink?: string
  note?: string
  observedAt?: string | null
  coarseLocation?: string
  createdAt: string
}): ObservationEvent {
  return fromCommunityObservation({
    contributionId: input.id,
    hubId: input.hubId,
    broadCategory: input.broadCategory,
    whatYouThink: input.whatYouThink,
    note: input.note,
    observedAt: input.observedAt,
    coarseLocation: input.coarseLocation,
    createdAt: input.createdAt,
  })
}

export function cambridgeshireOccurrenceToObservation(input: {
  key: string | number
  eventId?: string | null
  scientificName: string
  eventDate?: string | null
  retrievedAt: string
  datasetKey: string
  datasetTitle: string
  licence: string
  sourceUrl?: string | null
  districtAssetId?: string | null
  coordinateUncertaintyInMeters?: number | null
}): ObservationEvent {
  return fromOccurrenceRecord({
    recordId: String(input.key),
    sourceSystem: 'gbif',
    eventId: input.eventId ?? null,
    scientificName: input.scientificName,
    eventDate: input.eventDate ?? null,
    receivedAt: input.retrievedAt,
    publisher: input.datasetTitle,
    datasetIdentifier: input.datasetKey,
    sourceUrl: input.sourceUrl ?? null,
    licence: input.licence,
    placeId: input.districtAssetId ?? null,
    spatialUncertaintyMeters: input.coordinateUncertaintyInMeters ?? null,
  })
}

export function naturalEnglandSssiToObservation(input: {
  reference: string
  name: string
  geometry: unknown
  retrievedAt: string
  sourceUrl: string
  licence: string
}): ObservationEvent {
  return fromSpatialContext({
    sourceSystem: 'natural-england-sssi',
    recordId: input.reference,
    label: input.name,
    geometry: input.geometry,
    retrievedAt: input.retrievedAt,
    publisher: 'Natural England',
    datasetIdentifier: 'SSSI_England',
    sourceUrl: input.sourceUrl,
    licence: input.licence,
    scopeNote: 'Published SSSI boundary context only; not a condition assessment.',
  })
}

export function eaRainfallToObservation(input: {
  stationId: string
  date: string
  value: number
  quality: string
  retrievedAt: string
  sourceUrl: string
  licence: string
}): ObservationEvent {
  return fromPhysicalMeasurement({
    sourceSystem: 'environment-agency-rainfall',
    recordId: `${input.stationId}:${input.date}`,
    parameter: 'rainfall',
    value: input.value,
    unit: 'mm/day',
    observedAt: input.date,
    retrievedAt: input.retrievedAt,
    stationId: input.stationId,
    quality: input.quality,
    sourceUrl: input.sourceUrl,
    licence: input.licence,
  })
}
