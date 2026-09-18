import { auth } from '@/auth'
import { enabled, hubDb, privateHeaders } from '@/lib/wild-hubs/http'
import { ownerContributionService } from '@/lib/wild-hubs/contributions'

export const dynamic = 'force-dynamic'

// Owner: view the photo of a contribution to a hub they own, at any status, so
// they can moderate it. Ownership is enforced inside ownerContributionService.
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string; cid: string }> },
) {
  if (!enabled())
    return new Response('Not found', { status: 404, headers: privateHeaders })
  const session = await auth()
  if (!session?.user?.id)
    return new Response('Not found', { status: 404, headers: privateHeaders })
  try {
    const { id, cid } = await params
    const bytes = await ownerContributionService(hubDb, session.user.id).photo(id, cid)
    if (!bytes)
      return new Response('Not found', { status: 404, headers: privateHeaders })
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...privateHeaders,
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline',
      },
    })
  } catch {
    return new Response('Photo unavailable', {
      status: 503,
      headers: privateHeaders,
    })
  }
}
