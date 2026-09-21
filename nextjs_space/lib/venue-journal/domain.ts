import { createHash, randomBytes } from 'node:crypto'
import { HubError, record, text } from '../wild-hubs/domain'
export const CONSENT_VERSION = 'venue-photo-v1'
export const MAX_PHOTOS = 200
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')
export type JournalPhoto = {
 id: string; hubId: string; caption: string; credit: string; location: string;
 observedOn: string | null; createdAt: Date; status: string; revision: number; reason: string;
}
export function contributionInput(raw: unknown, now = new Date()) {
 const v = record(raw)
 if (v.adult !== true || v.venueUseConsent !== true || v.rightsConfirmed !== true || v.scannerConsent !== true)
  throw new HubError(400, 'Confirm age, photo rights, venue use and security scanning.')
 const caption = text(v.caption, 300), credit = text(v.credit, 160), location = text(v.location, 160)
 if (!caption || !credit || !location) throw new HubError(400, 'Add a description, credit and general location.')
 const observedOn = v.observedOn ? text(v.observedOn, 10) : null
 if (observedOn && (!/^\d{4}-\d{2}-\d{2}$/.test(observedOn) || !Number.isFinite(Date.parse(observedOn)) ||
  new Date(observedOn).toISOString().slice(0, 10) !== observedOn || observedOn > now.toISOString().slice(0, 10)))
  throw new HubError(400, 'Use a valid date taken, or leave it unknown.')
 return { caption, credit, location, observedOn }
}
export function completedWeek(now: Date) {
 const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
 end.setUTCDate(end.getUTCDate() - (end.getUTCDay() + 6) % 7)
 return { start: new Date(end.getTime() - 7 * 86400000), end }
}
export const photoColumns = 'p."id",p."hubId",p."caption",p."credit",p."location",p."observedOn",p."createdAt",p."status",p."revision",p."reason"'
