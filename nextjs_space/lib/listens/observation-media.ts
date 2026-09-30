// PILOT-001 NE demo: prepares untrusted participant media before it is stored.
// The original bytes are kept exactly as received (sha256) and are only ever served
// back to their owner. Photos also get a re-encoded display copy with all metadata
// (including EXIF GPS) removed; the display copy is what the page renders.
// Nothing here identifies a species or makes any claim about content.
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { ListenError } from './domain.mjs'
import { LIMITS, acceptedMime } from './observations.mjs'

export type PreparedMedia = { mediaType: 'PHOTO' | 'SOUND'; mime: string; original: Buffer; sha256: string; displayMime: string | null; display: Buffer | null }

export async function prepareMedia(kind: 'PHOTO' | 'SOUND', original: Buffer): Promise<PreparedMedia> {
  if (!original.length) throw new ListenError(400, 'The file was empty. Choose it again.')
  if (original.length > LIMITS[kind]) throw new ListenError(413, kind === 'PHOTO' ? 'Photos can be up to 8 MB in this demonstration.' : 'Sounds can be up to 10 MB in this demonstration.')
  const mime = acceptedMime(kind, original)
  const sha256 = createHash('sha256').update(original).digest('hex')
  if (kind === 'SOUND') return { mediaType: kind, mime, original, sha256, displayMime: null, display: null }
  let display: Buffer
  try {
    // Decoder limits guard against decompression bombs; metadata is not copied to the output.
    display = await sharp(original, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
  } catch {
    throw new ListenError(415, 'This photo could not be read. Try a JPEG or PNG, or take the photo again.')
  }
  return { mediaType: kind, mime, original, sha256, displayMime: 'image/jpeg', display }
}
