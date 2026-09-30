// PILOT-001 NE demo: private participant observations at a Place.
// A participant observation is its own record type. It is never an Asset, never
// PlatformEvidence, never a search document and never a Place timeline event.
// Nothing here identifies species, validates, scores or promotes. Status is always
// PARTICIPANT_UNVERIFIED (pinned by a database CHECK). Machine interpretation and
// human verification, if ever built, are separate records that reference an
// observation; they are deliberately not modelled here.
import { createHash, randomUUID } from 'node:crypto'
import { ListenError, key } from './domain.mjs'

export const STATUS = 'PARTICIPANT_UNVERIFIED'
export const STATUS_LABEL = 'Participant observation · Unverified'
export const KINDS = ['PHOTO', 'SOUND', 'NOTE']
export const CATEGORIES = ['ANIMAL', 'PLANT', 'WATER', 'HABITAT', 'DISTURBANCE', 'OTHER']
export const CONFIDENCE = ['NOT_SURE', 'FAIRLY_SURE', 'CERTAIN']
export const LOCATION_METHODS = ['DEVICE', 'MAP_APPROXIMATE', 'NONE']
export const SHARING = ['PRIVATE', 'APPROXIMATE', 'EXACT']
export const TIME_PROVENANCE = ['DEVICE_NOW', 'PARTICIPANT_CORRECTED']
export const LIMITS = { PHOTO: 8 * 1024 * 1024, SOUND: 10 * 1024 * 1024, perPlace: 100, soundMs: 30 * 60000 }
export const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
export const SOUND_MIMES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/aac']
// About 1 km: the disclosure grid used when a participant shares an approximate location.
export const APPROXIMATE_DECIMALS = 2

const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex')
const unique = error => /23505|unique constraint/i.test(`${error?.code ?? ''} ${error?.meta?.code ?? ''} ${error?.message ?? ''}`)

function optionalText(value, max, multiline, message) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new ListenError(400, message)
  const clean = multiline ? value.replace(/\r\n?/g, '\n').trim() : value.trim()
  const control = multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/
  if (clean.length > max || control.test(clean)) throw new ListenError(400, message)
  return clean || null
}
const coordinate = (value, limit) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit

/** Validates participant metadata. Nothing is inferred, rounded up in precision or defaulted silently. */
export function observationInput(value, now = new Date()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ListenError(400, 'Invalid submission')
  const id = key(value.id)
  if (!KINDS.includes(value.kind)) throw new ListenError(400, 'Choose photo, sound or note')
  if (!CATEGORIES.includes(value.category)) throw new ListenError(400, 'Choose what you noticed')
  if (typeof value.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.observedAt)) throw new ListenError(400, 'Choose when you noticed it')
  const observedAt = new Date(value.observedAt)
  const date = value.observedAt.slice(0, 10)
  if (!Number.isFinite(observedAt.getTime()) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) throw new ListenError(400, 'Invalid calendar date')
  if (observedAt - now > 5 * 60000) throw new ListenError(400, 'That time is in the future. Check the time and your device clock.')
  if (now - observedAt > 31 * 86400000) throw new ListenError(400, 'Observations must be from the past 31 days')
  if (!TIME_PROVENANCE.includes(value.observedAtProvenance)) throw new ListenError(400, 'Choose when you noticed it')
  const note = optionalText(value.note, 1000, true, 'Please check your note')
  if (value.kind === 'NOTE' && !note) throw new ListenError(400, 'Write a short note')
  const participantIdentification = optionalText(value.participantIdentification, 120, false, 'Please check what you think you noticed')
  let participantConfidence = null
  if (value.participantConfidence !== undefined && value.participantConfidence !== null && value.participantConfidence !== '') {
    if (!CONFIDENCE.includes(value.participantConfidence)) throw new ListenError(400, 'Choose how sure you are')
    if (!participantIdentification) throw new ListenError(400, 'Say what you think you noticed before saying how sure you are')
    participantConfidence = value.participantConfidence
  }
  if (!LOCATION_METHODS.includes(value.locationMethod)) throw new ListenError(400, 'Choose how to record location')
  if (!SHARING.includes(value.locationSharing)) throw new ListenError(400, 'Choose how BioVeracity may use this location')
  let capturedLat = null, capturedLng = null, capturedAccuracyM = null
  if (value.locationMethod === 'NONE') {
    if (value.lat != null || value.lng != null || value.accuracyM != null) throw new ListenError(400, 'No location was to be recorded')
    if (value.locationSharing !== 'PRIVATE') throw new ListenError(400, 'There is no location to share')
  } else {
    if (!coordinate(value.lat, 90) || !coordinate(value.lng, 180)) throw new ListenError(400, 'The location could not be read. Choose again or record no location.')
    capturedLat = value.lat; capturedLng = value.lng
    if (value.locationMethod === 'DEVICE') {
      // The device's own accuracy is kept as captured; a point without one is not a device fix.
      if (typeof value.accuracyM !== 'number' || !Number.isFinite(value.accuracyM) || value.accuracyM <= 0) throw new ListenError(400, 'The location accuracy is missing. Try again or choose on the map.')
      capturedAccuracyM = value.accuracyM
    } else if (value.accuracyM != null) throw new ListenError(400, 'A map choice is approximate and has no device accuracy')
  }
  if (value.adult !== true) throw new ListenError(400, 'This pilot is for adult participants')
  let durationMs = null
  if (value.kind === 'SOUND' && value.durationMs != null) {
    if (!Number.isInteger(value.durationMs) || value.durationMs < 0 || value.durationMs > LIMITS.soundMs) throw new ListenError(400, 'The recording length could not be read')
    durationMs = value.durationMs
  } else if (value.kind !== 'SOUND' && value.durationMs != null) throw new ListenError(400, 'Only sounds have a recording length')
  return { id, kind: value.kind, category: value.category, observedAt: observedAt.toISOString(), observedAtSource: value.observedAt, observedAtProvenance: value.observedAtProvenance, note, participantIdentification, participantConfidence, locationMethod: value.locationMethod, capturedLat, capturedLng, capturedAccuracyM, locationSharing: value.locationSharing, durationMs }
}

// Magic-byte sniffing. The browser's declared type and the file name are never trusted.
const ascii = (b, at, s) => b.length >= at + s.length && [...s].every((c, i) => b[at + i] === c.charCodeAt(0))
export function sniff(bytes) {
  const b = bytes
  if (!b || b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (ascii(b, 0, '\x89PNG\r\n\x1a\n')) return 'image/png'
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return 'image/webp'
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE')) return 'audio/wav'
  if (ascii(b, 4, 'ftyp')) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11])
    if (['heic', 'heix', 'mif1', 'msf1', 'hevc', 'heim', 'heis'].includes(brand)) return 'image/heic'
    if (['M4A ', 'M4B ', 'isom', 'iso2', 'iso5', 'iso6', 'mp41', 'mp42', 'dash', 'MSNV', 'qt  '].includes(brand)) return 'audio/mp4'
    return null
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'audio/webm'
  if (ascii(b, 0, 'OggS')) return 'audio/ogg'
  if (ascii(b, 0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe6) === 0xe2)) return 'audio/mpeg'
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return 'audio/aac'
  return null
}
export function acceptedMime(kind, bytes) {
  const mime = sniff(bytes)
  const allowed = kind === 'PHOTO' ? PHOTO_MIMES : kind === 'SOUND' ? SOUND_MIMES : []
  if (!mime || !allowed.includes(mime)) throw new ListenError(415, kind === 'PHOTO' ? 'This file is not a supported photo (JPEG, PNG, WebP or HEIC).' : 'This file is not a supported sound recording.')
  return mime
}

/**
 * What BioVeracity may disclose about a location. Capture never implies disclosure.
 * A future sensitive-species/location rule (disclosureOverride) can only reduce it.
 * There is no public surface for participant observations in this demo.
 */
export function disclosedLocation(o) {
  if (o.locationMethod === 'NONE' || o.capturedLat == null) return null
  let level = o.locationSharing
  if (o.disclosureOverride === 'WITHHOLD') level = 'PRIVATE'
  if (o.disclosureOverride === 'APPROXIMATE_ONLY' && level === 'EXACT') level = 'APPROXIMATE'
  if (level === 'PRIVATE') return null
  const f = 10 ** APPROXIMATE_DECIMALS
  if (level === 'APPROXIMATE') return { lat: Math.round(o.capturedLat * f) / f, lng: Math.round(o.capturedLng * f) / f, precision: 'APPROXIMATE_1KM' }
  // Exact sharing of a map choice is still only as precise as the choice itself.
  return { lat: o.capturedLat, lng: o.capturedLng, precision: o.locationMethod === 'DEVICE' ? 'DEVICE' : 'MAP_APPROXIMATE' }
}

const COLUMNS = 'o.id,o.kind,o.category,o."observedAt",o."observedAtSource",o."observedAtProvenance",o."receivedAt",o.note,o."participantIdentification",o."participantConfidence",o."locationMethod",o."capturedLat",o."capturedLng",o."capturedAccuracyM",o."locationSharing",o."disclosureOverride",o.status,m."mediaType",m.mime,m."byteLength",m.sha256,m."durationMs",(m.display IS NOT NULL) AS "hasDisplay"'

/** Owner-scoped service. placeId is always resolved server-side from a public slug. */
export function observationService(db, ownerId) {
  async function locked(operation) {
    return db.transaction(async tx => {
      const [user] = await tx.query('SELECT id FROM "User" WHERE id=$1 AND "emailVerified" IS NOT NULL FOR UPDATE', [ownerId])
      if (!user) throw new ListenError(403, 'Verify your email before saving an observation')
      return operation(tx)
    })
  }
  return {
    async listForPlace(placeId) {
      return db.query(`SELECT ${COLUMNS} FROM "ParticipantObservation" o JOIN "ListeningPlot" p ON p.id=o."plotId" LEFT JOIN "ParticipantObservationMedia" m ON m."observationId"=o.id WHERE p."ownerId"=$1 AND o."placeId"=$2 ORDER BY o."observedAt" DESC,o.id`, [ownerId, placeId])
    },
    async listAll() {
      return db.query(`SELECT o."placeId",o."plotId",${COLUMNS} FROM "ParticipantObservation" o JOIN "ListeningPlot" p ON p.id=o."plotId" LEFT JOIN "ParticipantObservationMedia" m ON m."observationId"=o.id WHERE p."ownerId"=$1 ORDER BY o."observedAt",o.id`, [ownerId])
    },
    /** media: null, or { mime, original: Buffer, sha256, displayMime, display } already sniffed and prepared. */
    async save({ placeId, placeName, input, media }) {
      if ((input.kind === 'NOTE') !== !media) throw new ListenError(400, input.kind === 'NOTE' ? 'A note has no media file' : 'Add a photo or sound first')
      if (media && media.mediaType !== input.kind) throw new ListenError(400, 'The file does not match the observation type')
      const fingerprint = hash({ placeId, input, media: media ? media.sha256 : null })
      return locked(async tx => {
        const [existing] = await tx.query('SELECT o.id,o."payloadHash",p."ownerId" FROM "ParticipantObservation" o JOIN "ListeningPlot" p ON p.id=o."plotId" WHERE o.id=$1', [input.id])
        if (existing) {
          // A retry of the same submission returns the saved record; anything else is a conflict that reveals nothing.
          if (existing.ownerId !== ownerId || existing.payloadHash !== fingerprint) throw new ListenError(409, 'This observation identifier was already used')
          return { id: existing.id, replayed: true }
        }
        await tx.query('INSERT INTO "ListeningPlot" (id,"ownerId",name,county,"placeId","payloadHash") VALUES ($1,$2,$3,NULL,$4,$5) ON CONFLICT ("ownerId","placeId") DO NOTHING', [randomUUID(), ownerId, placeName, placeId, hash({ placeId })])
        const [plot] = await tx.query('SELECT id FROM "ListeningPlot" WHERE "ownerId"=$1 AND "placeId"=$2', [ownerId, placeId])
        if (!plot) throw new ListenError(409, 'Your history here could not be confirmed. Retry.')
        const [count] = await tx.query('SELECT COUNT(*)::int AS n FROM "ParticipantObservation" WHERE "plotId"=$1', [plot.id])
        if (count.n >= LIMITS.perPlace) throw new ListenError(409, `This demonstration keeps up to ${LIMITS.perPlace} observations per place. You can still read, export and delete them.`)
        try {
          await tx.query('INSERT INTO "ParticipantObservation" (id,"plotId","placeId",kind,category,"observedAt","observedAtSource","observedAtProvenance",note,"participantIdentification","participantConfidence","locationMethod","capturedLat","capturedLng","capturedAccuracyM","locationSharing","payloadHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',
            [input.id, plot.id, placeId, input.kind, input.category, new Date(input.observedAt), input.observedAtSource, input.observedAtProvenance, input.note, input.participantIdentification, input.participantConfidence, input.locationMethod, input.capturedLat, input.capturedLng, input.capturedAccuracyM, input.locationSharing, fingerprint])
          if (media) await tx.query('INSERT INTO "ParticipantObservationMedia" ("observationId","mediaType",mime,"byteLength",sha256,"durationMs",original,"displayMime",display) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [input.id, media.mediaType, media.mime, media.original.length, media.sha256, input.durationMs, media.original, media.displayMime ?? null, media.display ?? null])
        } catch (error) { if (unique(error)) throw new ListenError(409, 'This observation identifier was already used'); throw error }
        return { id: input.id, replayed: false }
      })
    },
    async media(value, variant) {
      const id = key(value)
      const [row] = await db.query('SELECT m."mediaType",m.mime,m.original,m."displayMime",m.display FROM "ParticipantObservationMedia" m JOIN "ParticipantObservation" o ON o.id=m."observationId" JOIN "ListeningPlot" p ON p.id=o."plotId" WHERE m."observationId"=$1 AND p."ownerId"=$2', [id, ownerId])
      if (!row) throw new ListenError(404, 'Not found')
      if (variant === 'display' && row.display) return { mime: row.displayMime, bytes: row.display, mediaType: row.mediaType, variant }
      return { mime: row.mime, bytes: row.original, mediaType: row.mediaType, variant: row.mediaType === 'SOUND' && variant === 'display' ? 'display' : 'original' }
    },
    async remove(value) {
      const id = key(value)
      return locked(async tx => {
        const rows = await tx.query('DELETE FROM "ParticipantObservation" o USING "ListeningPlot" p WHERE o.id=$1 AND p.id=o."plotId" AND p."ownerId"=$2 RETURNING o.id', [id, ownerId])
        if (!rows.length) throw new ListenError(404, 'Observation not found')
        return { deleted: true }
      })
    },
  }
}
