import { releaseInput } from '@/lib/venue-journal/release'
import { body } from '@/lib/workspaces/request-body'
import { hubRequest } from '@/lib/wild-hubs/http'
import { HubError, record, text } from '@/lib/wild-hubs/domain'
import { photoInput, preparePhoto } from '@/lib/wild-hubs/photos'
import { ScanError } from '@/lib/workspaces/scan-file.mjs'
type Context = { params: Promise<{ id: string }> }
export const runtime = 'nodejs'
export async function POST(request: Request, ctx: Context) {
  return hubRequest(async (s) => {
    const id = (await ctx.params).id
    await s.get(id) // Authorisation before reading or sending any uploaded bytes.
    const raw = await body(request, 4300000)
    const release = releaseInput(raw)
    const input = photoInput(raw)
    await s.reserveScan(id)
    try {
      return { hub: await s.addPhoto(id, {...await preparePhoto(input),...release}) }
    } catch (e) {
      if (e instanceof ScanError) throw new HubError(e.status, e.message)
      throw e
    }
  }, 201)
}
export async function DELETE(request: Request, ctx: Context) {
  return hubRequest(async (s) => {
    const v = record(await body(request))
    return {
      hub: await s.removePhoto(
        (await ctx.params).id,
        text(v.photoId, 80),
        v.revision,
      ),
    }
  })
}
