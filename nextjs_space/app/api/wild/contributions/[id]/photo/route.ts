import { enabled, hubDb, privateHeaders } from '@/lib/wild-hubs/http'
import { contributionService } from '@/lib/wild-hubs/contributions'

export const dynamic = 'force-dynamic'

// Public: serve the photograph of a PUBLISHED contribution. Anything not
// published (PENDING or REJECTED) is indistinguishable from not existing.
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!enabled())
    return new Response('Not found', { status: 404, headers: privateHeaders })
  try {
    const bytes = await contributionService(hubDb).publicPhoto((await params).id)
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
