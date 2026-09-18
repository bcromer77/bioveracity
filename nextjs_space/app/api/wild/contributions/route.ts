import { body } from '@/lib/workspaces/request-body'
import { contributeRequest } from '@/lib/wild-hubs/contribution-http'
import { HubError, record, text } from '@/lib/wild-hubs/domain'
import { contributionInput } from '@/lib/wild-hubs/contributions'
import { contributionPhotoInput, preparePhoto } from '@/lib/wild-hubs/photos'
import { ScanError } from '@/lib/workspaces/scan-file.mjs'
import { notifyOwnerOfNewContribution } from '@/lib/wild-hubs/contribution-notification'

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
      const result = await s.submit(hubId, prepared, fields)
      // The observation is now committed. Tell the owner one is waiting —
      // best-effort and awaited so the attempt completes while the function is
      // alive; the helper swallows every failure, so a mail problem can never
      // affect the stored contribution.
      await notifyOwnerOfNewContribution(hubId)
      return result
    } catch (e) {
      if (e instanceof ScanError) throw new HubError(e.status, e.message)
      throw e
    }
  }, 201)
}
