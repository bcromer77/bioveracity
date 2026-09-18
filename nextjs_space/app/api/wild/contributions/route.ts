import { body } from '@/lib/workspaces/request-body'
import { contributeRequest } from '@/lib/wild-hubs/contribution-http'
import { HubError, record, text } from '@/lib/wild-hubs/domain'
import { contributionInput } from '@/lib/wild-hubs/contributions'
import { contributionPhotoInput, preparePhoto } from '@/lib/wild-hubs/photos'
import { ScanError } from '@/lib/workspaces/scan-file.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public: a visitor shares something they noticed. Unauthenticated but flag- and
// origin-gated. The photo is security-scanned and EXIF/GPS-stripped exactly like
// an owner's photo; the contribution is stored PENDING and never auto-published.
export async function POST(request: Request) {
  return contributeRequest(async (s) => {
    const raw = await body(request, 4300000)
    const v = record(raw)
    const hubId = text(v.hubId, 80)
    const fields = contributionInput(v)
    const photo = contributionPhotoInput(v)
    try {
      const prepared = await preparePhoto(photo)
      return s.submit(hubId, prepared, fields)
    } catch (e) {
      if (e instanceof ScanError) throw new HubError(e.status, e.message)
      throw e
    }
  }, 201)
}
