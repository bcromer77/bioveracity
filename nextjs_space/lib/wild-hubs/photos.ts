import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { scanBytes } from '../workspaces/scan-file.mjs'
import { HubError, record, text } from './domain'
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
  return { caption, credit, bytes }
}
export async function preparePhoto(
  input: ReturnType<typeof photoInput>,
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
