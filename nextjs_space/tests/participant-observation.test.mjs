// PILOT-001 NE demo: participant observation input rules, media sniffing and disclosure.
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { observationInput, sniff, acceptedMime, disclosedLocation, STATUS, STATUS_LABEL } from '../lib/listens/observations.mjs'

const now = new Date('2026-09-30T12:00:00.000Z')
const ok = (extra = {}) => ({ id: randomUUID(), kind: 'NOTE', category: 'OTHER', observedAt: '2026-09-30T11:30:00.000Z', observedAtProvenance: 'DEVICE_NOW', note: 'Seals hauled out', locationMethod: 'NONE', locationSharing: 'PRIVATE', adult: true, ...extra })
const rejects = (extra, re) => assert.throws(() => observationInput(ok(extra), now), e => e.status === 400 && re.test(e.message))

test('status is fixed and labelled as unverified participant material', () => {
  assert.equal(STATUS, 'PARTICIPANT_UNVERIFIED')
  assert.equal(STATUS_LABEL, 'Participant observation · Unverified')
})

test('valid note, device fix and corrected time keep exactly what the participant gave', () => {
  const a = observationInput(ok(), now)
  assert.equal(a.capturedLat, null); assert.equal(a.participantIdentification, null); assert.equal(a.participantConfidence, null)
  const b = observationInput(ok({ kind: 'SOUND', note: '', durationMs: 4200, observedAt: '2026-09-29T07:15:00+01:00', observedAtProvenance: 'PARTICIPANT_CORRECTED', locationMethod: 'DEVICE', lat: 54.4712345, lng: -5.6012345, accuracyM: 12.5, locationSharing: 'APPROXIMATE', participantIdentification: 'Curlew', participantConfidence: 'NOT_SURE' }), now)
  assert.equal(b.observedAt, '2026-09-29T06:15:00.000Z'); assert.equal(b.observedAtSource, '2026-09-29T07:15:00+01:00')
  assert.deepEqual([b.capturedLat, b.capturedLng, b.capturedAccuracyM], [54.4712345, -5.6012345, 12.5], 'captured precision kept, never rounded')
  assert.equal(b.note, null); assert.equal(b.durationMs, 4200)
  const c = observationInput(ok({ locationMethod: 'MAP_APPROXIMATE', lat: 54.47, lng: -5.6, locationSharing: 'EXACT' }), now)
  assert.equal(c.capturedAccuracyM, null)
})

test('invalid submissions are refused rather than repaired', () => {
  rejects({ observedAt: '2026-09-30T13:00:00.000Z' }, /future/)
  rejects({ observedAt: '2026-08-01T12:00:00.000Z' }, /31 days/)
  rejects({ observedAt: '2026-02-30T12:00:00.000Z' }, /calendar/)
  rejects({ observedAt: '2026-09-30 11:00' }, /when/)
  rejects({ observedAtProvenance: 'SERVER' }, /when/)
  rejects({ note: '' }, /short note/)
  rejects({ kind: 'VIDEO' }, /photo, sound or note/)
  rejects({ category: 'BIRD' }, /what you noticed/)
  rejects({ lat: 54.4 }, /No location/)
  rejects({ locationSharing: 'EXACT' }, /no location to share/)
  rejects({ locationMethod: 'DEVICE', lat: 54.4, lng: -5.6, locationSharing: 'PRIVATE' }, /accuracy is missing/)
  rejects({ locationMethod: 'MAP_APPROXIMATE', lat: 54.4, lng: -5.6, accuracyM: 5, locationSharing: 'PRIVATE' }, /approximate/)
  rejects({ locationMethod: 'MAP_APPROXIMATE', lat: 91, lng: -5.6, locationSharing: 'PRIVATE' }, /could not be read/)
  rejects({ participantConfidence: 'CERTAIN' }, /before saying how sure/)
  rejects({ participantIdentification: 'Tern', participantConfidence: 'PROBABLY' }, /how sure/)
  rejects({ adult: false }, /adult/)
  rejects({ durationMs: 1000 }, /Only sounds/)
  rejects({ kind: 'SOUND', durationMs: -1 }, /length/)
  rejects({ note: 'bad\u0000byte' }, /note/)
  rejects({ participantIdentification: 'x'.repeat(121) }, /think you noticed/)
})

test('media type comes from magic bytes, never the declared type', () => {
  const pad = b => Buffer.concat([Buffer.from(b), Buffer.alloc(16)])
  assert.equal(sniff(pad([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(sniff(pad('\x89PNG\r\n\x1a\n'.split('').map(c => c.charCodeAt(0)))), 'image/png')
  assert.equal(sniff(Buffer.from('RIFF\0\0\0\0WAVEfmt ')), 'audio/wav')
  assert.equal(sniff(pad([0x1a, 0x45, 0xdf, 0xa3])), 'audio/webm')
  assert.equal(sniff(Buffer.from('OggS\0\0\0\0\0\0\0\0')), 'audio/ogg')
  assert.equal(sniff(Buffer.from('<html><script>alert(1)</script>')), null)
  assert.equal(sniff(Buffer.from('short')), null)
  assert.equal(acceptedMime('PHOTO', pad([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.throws(() => acceptedMime('PHOTO', Buffer.from('OggS\0\0\0\0\0\0\0\0')), e => e.status === 415)
  assert.throws(() => acceptedMime('SOUND', pad([0xff, 0xd8, 0xff, 0xe0])), e => e.status === 415)
  assert.throws(() => acceptedMime('NOTE', pad([0xff, 0xd8, 0xff, 0xe0])), e => e.status === 415)
})

test('disclosure: capture never implies disclosure; overrides only reduce; approximate is rounded', () => {
  const o = { locationMethod: 'DEVICE', capturedLat: 54.4712345, capturedLng: -5.6012345, locationSharing: 'EXACT' }
  assert.deepEqual(disclosedLocation(o), { lat: 54.4712345, lng: -5.6012345, precision: 'DEVICE' })
  assert.equal(disclosedLocation({ ...o, locationSharing: 'PRIVATE' }), null)
  assert.deepEqual(disclosedLocation({ ...o, locationSharing: 'APPROXIMATE' }), { lat: 54.47, lng: -5.6, precision: 'APPROXIMATE_1KM' })
  assert.deepEqual(disclosedLocation({ ...o, disclosureOverride: 'APPROXIMATE_ONLY' }), { lat: 54.47, lng: -5.6, precision: 'APPROXIMATE_1KM' })
  assert.equal(disclosedLocation({ ...o, disclosureOverride: 'WITHHOLD' }), null)
  assert.equal(disclosedLocation({ ...o, locationSharing: 'PRIVATE', disclosureOverride: 'APPROXIMATE_ONLY' }), null, 'an override never raises disclosure')
  assert.equal(disclosedLocation({ locationMethod: 'NONE', capturedLat: null, capturedLng: null, locationSharing: 'PRIVATE' }), null)
  assert.equal(disclosedLocation({ ...o, locationMethod: 'MAP_APPROXIMATE' }).precision, 'MAP_APPROXIMATE', 'exact sharing of a map choice is not made more precise')
})
