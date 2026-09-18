import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { scanBytes } from '../workspaces/scan-file.mjs'
import { HubError, record, text } from './domain'

// A panorama's editorial points. These are quiet invitations to notice, never
// claims about what is present. Coordinates are percentages within the image so
// the same data renders responsively on any screen.
export const PANORAMA_POINTS = [
  'look-closer',
  'listen',
  'whats-living',
  'after-dark',
  'seen-something',
] as const
export type PanoramaPoint = {
  x: number
  y: number
  kind: (typeof PANORAMA_POINTS)[number]
  label: string
}
export type PanoramaMeta = { points: PanoramaPoint[] }
function panoramaMeta(raw: unknown): PanoramaMeta {
  const v = record(raw)
  if (!Array.isArray(v.points) || v.points.length > 8)
    throw new HubError(400, 'A panorama can carry up to eight points.')
  const allowed = new Set<string>(PANORAMA_POINTS)
  const points = v.points.map((p) => {
    const o = record(p)
    const x = Number(o.x),
      y = Number(o.y)
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100)
      throw new HubError(400, 'Panorama points must sit within the image.')
    const kind = text(o.kind, 30)
    if (!allowed.has(kind)) throw new HubError(400, 'Unknown panorama point.')
    return { x, y, kind: kind as PanoramaPoint['kind'], label: text(o.label, 120, false) }
  })
  return { points }
}
export function photoInput(raw: unknown) {
  const v = record(raw)
  if (v.rightsConfirmed !== true || v.scannerConsent !== true)
    throw new HubError(
      400,
      'Confirm photo rights and security scanning before uploading.',
    )
  const caption = text(v.caption, 300),
    credit = text(v.credit, 160),
    encoded = text(v.base64, 4200000)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new HubError(400, 'Invalid photo data.')
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.length > 3 * 1024 * 1024 || bytes.toString('base64') !== encoded)
    throw new HubError(413, 'Choose a JPEG or PNG up to 3 MB.')
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (!jpeg && !png)
    throw new HubError(415, 'Only JPEG and PNG photographs are accepted.')
  const kind = v.kind === undefined ? 'photo' : text(v.kind, 20)
  if (kind !== 'photo' && kind !== 'panorama')
    throw new HubError(400, 'Unknown media kind.')
  const meta = kind === 'panorama' ? panoramaMeta(v.meta ?? { points: [] }) : null
  return { caption, credit, bytes, kind, meta }
}

// A visitor's contribution photo. No caption or credit is collected — a
// contribution is an observation, not curated media — but the same security
// scan and EXIF/GPS-stripping pipeline (preparePhoto) is reused.
export function contributionPhotoInput(raw: unknown) {
  const v = record(raw)
  if (v.rightsConfirmed !== true || v.scannerConsent !== true)
    throw new HubError(
      400,
      'Confirm the photo is yours and may be safely scanned before uploading.',
    )
  const encoded = text(v.base64, 4200000)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new HubError(400, 'Invalid photo data.')
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.length > 3 * 1024 * 1024 || bytes.toString('base64') !== encoded)
    throw new HubError(413, 'Choose a JPEG or PNG up to 3 MB.')
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (!jpeg && !png)
    throw new HubError(415, 'Only JPEG and PNG photographs are accepted.')
  return { caption: '', credit: '', bytes }
}
export async function preparePhoto(
  input: { caption: string; credit: string; bytes: Buffer },
  scanner = (bytes: Buffer) =>
    scanBytes(bytes, process.env.CLOUDMERSIVE_API_KEY || ''),
) {
  await scanner(input.bytes)
  try {
    const image = sharp(input.bytes, {
      limitInputPixels: 20000000,
      failOn: 'warning',
      animated: false,
    })
    const info = await image.metadata()
    if (!['jpeg', 'png'].includes(info.format || '') || (info.pages || 1) > 1)
      throw Error()
    // Re-encode to a single image; strip EXIF/GPS, text chunks, profiles and originals.
    const bytes = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer()
    if (bytes.length > 1500000) throw Error()
    return {
      caption: input.caption,
      credit: input.credit,
      bytes,
      hash: createHash('sha256').update(bytes).digest('hex'),
    }
  } catch {
    throw new HubError(
      422,
      'This photo could not be safely processed. Try a smaller JPEG or PNG.',
    )
  }
}
