import { privateHeaders } from '@/lib/workspaces/http'
import { body } from '@/lib/workspaces/request-body'
import { listenService } from '@/lib/listens/service.mjs'
import { ListenError } from '@/lib/listens/domain.mjs'
import { LIMITS, STATUS_LABEL, observationInput, observationService } from '@/lib/listens/observations.mjs'
import { prepareMedia } from '@/lib/listens/observation-media'
import { assertConfiguredOrigin, database, failure, observationPlace, participant } from '@/lib/listens/participant-request'
export const dynamic = 'force-dynamic'

// Private history at one Place: listening visits and participant observations, owner only.
// Media bytes are never included; they are fetched per observation by the owner.
export async function GET(req: Request) {
  try {
    const ownerId = await participant()
    const place = await observationPlace(new URL(req.url).searchParams.get('place'))
    const history = await listenService(database, ownerId).homeForPlace(place.placeId)
    const observations = await observationService(database, ownerId).listForPlace(place.placeId)
    return Response.json({ ...history, observations, statusLabel: STATUS_LABEL, place: { slug: place.slug, title: place.name, mapCentre: place.mapCentre } }, { headers: privateHeaders })
  } catch (error) { return failure(error) }
}

const MAX_REQUEST = LIMITS.SOUND + 64 * 1024

// multipart/form-data: meta (JSON) + optional media file -> create (idempotent by client UUID).
// application/json {action:'delete', id} -> delete one observation and its media.
export async function POST(req: Request) {
  try {
    const ownerId = await participant()
    assertConfiguredOrigin(req)
    const service = observationService(database, ownerId)
    const type = req.headers.get('content-type')?.split(';')[0].trim()
    if (type === 'application/json') {
      const input = await body(req) as Record<string, unknown>
      if (input?.action !== 'delete') throw new ListenError(400, 'Unknown action')
      return Response.json(await service.remove(input.id), { headers: privateHeaders })
    }
    if (type !== 'multipart/form-data') throw new ListenError(415, 'Unsupported request')
    const declared = Number(req.headers.get('content-length'))
    if (!Number.isFinite(declared) || declared <= 0 || declared > MAX_REQUEST) throw new ListenError(413, 'This file is too large for the demonstration (photos up to 8 MB, sounds up to 10 MB).')
    let form: FormData
    try { form = await req.formData() } catch { throw new ListenError(400, 'The upload was interrupted. Retry: it will not be saved twice.') }
    const metaRaw = form.get('meta')
    if (typeof metaRaw !== 'string' || metaRaw.length > 8192) throw new ListenError(400, 'Invalid submission')
    let meta: unknown
    try { meta = JSON.parse(metaRaw) } catch { throw new ListenError(400, 'Invalid submission') }
    const input = observationInput(meta)
    const place = await observationPlace((meta as Record<string, unknown>).slug)
    const file = form.get('media')
    let media = null
    if (input.kind === 'NOTE') { if (file !== null) throw new ListenError(400, 'A note has no media file') }
    else {
      if (!(file instanceof Blob) || !file.size) throw new ListenError(400, input.kind === 'PHOTO' ? 'Add a photo first' : 'Add a sound first')
      media = await prepareMedia(input.kind as 'PHOTO' | 'SOUND', Buffer.from(await file.arrayBuffer()))
    }
    const saved = await service.save({ placeId: place.placeId, placeName: place.name, input, media })
    return Response.json({ ...saved, status: STATUS_LABEL }, { status: saved.replayed ? 200 : 201, headers: privateHeaders })
  } catch (error) { return failure(error) }
}
