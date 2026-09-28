// Data-contract readiness only. No route calls this module and this change does
// not authorise public submission, media upload, moderation or publication.

export type QrObservationDraft = {
  placeId: string
  originalLanguage: string
  originalText: string
  observedAt: string | null
  observedPrecision: 'instant' | 'day' | 'month' | 'year' | 'unknown'
  location: {
    geometry: unknown | null
    crs: string | null
    spatialUncertaintyMeters: number | null
    precision: 'EXACT_POINT' | 'APPROXIMATE_POINT' | 'AREA_OR_POLYGON' | 'NAMED_SITE' | 'UNKNOWN'
  }
  media: Array<{ reference: string; sha256: string; mimeType: string }>
  attribution: { state: 'ANONYMOUS' | 'PUBLIC_ATTRIBUTION' | 'PRIVATE_CONTACT'; publicLabel: string | null }
  claimedObservation: { text: string }
  machineInterpretation: null | { model: string; version: string; candidates: unknown[] }
  verificationState: 'UNREVIEWED'
  licence: string | null
  consent: { venuePublication: boolean; widerReuse: boolean; recordedAt: string }
  sensitiveLocation: boolean
  locationDisclosure: 'EXACT' | 'GENERALISED' | 'NAMED_ONLY' | 'HIDDEN'
}

const text = (value: unknown, field: string, max: number): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) {
    throw new Error(`Invalid ${field}`)
  }
  return value.trim()
}
const object = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${field}`)
  return value as Record<string, unknown>
}
const leap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
const calendar = (year: number, month: number, day: number) => {
  const days = [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
}
const validCalendarPrefix = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return !match || calendar(Number(match[1]), Number(match[2]), Number(match[3]))
}
const timestamp = (value: unknown, field: string): string => {
  const raw = text(value, field, 40)
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(raw)
  if (!match || !calendar(Number(match[1]), Number(match[2]), Number(match[3])) ||
      Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59 ||
      Number(match[7] ?? 0) > 23 || Number(match[8] ?? 0) > 59 || !Number.isFinite(Date.parse(raw))) {
    throw new Error(`Invalid ${field}`)
  }
  return new Date(raw).toISOString()
}

export function validateQrObservationDraft(value: unknown): QrObservationDraft {
  const input = object(value, 'QR observation')
  const placeId = text(input.placeId, 'place identity', 160)
  if (!/^bv_place_[a-z0-9_]+$/.test(placeId)) throw new Error('Invalid place identity')
  const originalLanguage = text(input.originalLanguage, 'original language', 20)
  const originalText = text(input.originalText, 'original statement', 2000)
  const observedPrecision = String(input.observedPrecision ?? 'unknown') as QrObservationDraft['observedPrecision']
  if (!['instant', 'day', 'month', 'year', 'unknown'].includes(observedPrecision)) throw new Error('Invalid observation precision')
  const observedAt = input.observedAt == null ? null : text(input.observedAt, 'observation time', 40)
  if (observedAt === null && observedPrecision !== 'unknown') throw new Error('Unknown observation time requires unknown precision')
  if (observedAt !== null) {
    const patterns = {
      instant: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
      day: /^\d{4}-\d{2}-\d{2}$/,
      month: /^\d{4}-\d{2}$/,
      year: /^\d{4}$/,
      unknown: /^$/,
    }
    if (!patterns[observedPrecision].test(observedAt)) throw new Error('Observation time does not match its precision')
    if ((observedPrecision === 'day' || observedPrecision === 'instant') && !validCalendarPrefix(observedAt)) {
      throw new Error('Invalid observation calendar date')
    }
    if (observedPrecision === 'instant') timestamp(observedAt, 'observation time')
  }

  const location = object(input.location, 'location')
  const precision = String(location.precision ?? 'UNKNOWN') as QrObservationDraft['location']['precision']
  if (!['EXACT_POINT', 'APPROXIMATE_POINT', 'AREA_OR_POLYGON', 'NAMED_SITE', 'UNKNOWN'].includes(precision)) {
    throw new Error('Invalid location precision')
  }
  const uncertainty = location.spatialUncertaintyMeters == null ? null : Number(location.spatialUncertaintyMeters)
  if (uncertainty !== null && (!Number.isFinite(uncertainty) || uncertainty < 0)) throw new Error('Invalid spatial uncertainty')
  const geometry = location.geometry ?? null
  const crs = location.crs == null ? null : text(location.crs, 'CRS', 80)
  if (geometry !== null && (!crs || precision === 'UNKNOWN')) throw new Error('Geometry requires CRS and stated precision')

  const rawMedia = input.media ?? []
  if (!Array.isArray(rawMedia) || rawMedia.length > 10) throw new Error('Invalid media references')
  const media = rawMedia.map((raw, index) => {
    const item = object(raw, `media ${index}`)
    const sha256 = text(item.sha256, 'media hash', 64)
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid media hash')
    return { reference: text(item.reference, 'media reference', 500), sha256, mimeType: text(item.mimeType, 'media type', 100) }
  })

  const attribution = object(input.attribution, 'attribution')
  const attributionState = String(attribution.state) as QrObservationDraft['attribution']['state']
  if (!['ANONYMOUS', 'PUBLIC_ATTRIBUTION', 'PRIVATE_CONTACT'].includes(attributionState)) throw new Error('Invalid attribution state')
  const publicLabel = attribution.publicLabel == null ? null : text(attribution.publicLabel, 'public attribution', 120)
  if (attributionState === 'ANONYMOUS' && publicLabel) throw new Error('Anonymous observation cannot carry a public identity')

  const claimed = object(input.claimedObservation, 'claimed observation')
  const claimedText = text(claimed.text, 'claimed observation', 2000)
  if (claimedText !== originalText) throw new Error('Claimed observation must preserve the original statement verbatim')
  let machineInterpretation: QrObservationDraft['machineInterpretation'] = null
  if (input.machineInterpretation != null) {
    const machine = object(input.machineInterpretation, 'machine interpretation')
    if (!Array.isArray(machine.candidates) || machine.candidates.length > 20) throw new Error('Invalid machine candidates')
    machineInterpretation = {
      model: text(machine.model, 'interpretation model', 120),
      version: text(machine.version, 'interpretation version', 120),
      candidates: structuredClone(machine.candidates),
    }
  }

  const consent = object(input.consent, 'consent')
  if (typeof consent.venuePublication !== 'boolean' || typeof consent.widerReuse !== 'boolean') throw new Error('Invalid consent')
  const sensitiveLocation = input.sensitiveLocation === true
  const disclosure = String(input.locationDisclosure ?? (sensitiveLocation ? 'HIDDEN' : 'NAMED_ONLY')) as QrObservationDraft['locationDisclosure']
  if (!['EXACT', 'GENERALISED', 'NAMED_ONLY', 'HIDDEN'].includes(disclosure)) throw new Error('Invalid location disclosure')
  if (sensitiveLocation && disclosure === 'EXACT') throw new Error('Sensitive location cannot be publicly exact')

  return {
    placeId,
    originalLanguage,
    originalText,
    observedAt,
    observedPrecision,
    location: { geometry: structuredClone(geometry), crs, spatialUncertaintyMeters: uncertainty, precision },
    media,
    attribution: { state: attributionState, publicLabel },
    claimedObservation: { text: claimedText },
    machineInterpretation,
    verificationState: 'UNREVIEWED',
    licence: input.licence == null ? null : text(input.licence, 'licence', 200),
    consent: {
      venuePublication: consent.venuePublication,
      widerReuse: consent.widerReuse,
      recordedAt: timestamp(consent.recordedAt, 'consent time'),
    },
    sensitiveLocation,
    locationDisclosure: disclosure,
  }
}
