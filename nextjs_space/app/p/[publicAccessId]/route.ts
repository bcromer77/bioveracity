import { isPlaceExperienceEnabled } from '@/lib/place/shell-loader'
import { ACCESS_NOT_FOUND, publicAccessResponse, resolvePublicAccessPoint } from '@/lib/place/access-points'
import { placeAccessDb } from '@/lib/place/access-db'

// Place Experience PR E: opaque physical entry point (for example a printed QR
// code). Dark unless PLACE_EXPERIENCE_ENABLED is exactly 'true'. An active,
// publicly resolvable access point is a bodiless 307 to the Place's CURRENT
// canonical /place/{slug} (no HTML, no JS); malformed, unknown, revoked,
// private, unpublished, unresolved and flag-off requests are one identical 404.
// A route handler, not a page, so no React/RSC payload rides on the redirect.
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ publicAccessId: string }> }) {
  if (!isPlaceExperienceEnabled()) return send(publicAccessResponse(ACCESS_NOT_FOUND))
  const { publicAccessId } = await params
  return send(publicAccessResponse(await resolvePublicAccessPoint(placeAccessDb, publicAccessId)))
}

function send(res: ReturnType<typeof publicAccessResponse>): Response {
  return new Response(res.body, { status: res.status, headers: res.headers })
}
