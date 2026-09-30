import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { adapter, privateHeaders } from '@/lib/workspaces/http'
import { body } from '@/lib/workspaces/request-body'
import { WorkspaceError } from '@/lib/workspaces/service'
import { listenService } from '@/lib/listens/service.mjs'
import { ListenError } from '@/lib/listens/domain.mjs'
import { resolveListeningPlace } from '@/lib/place/participation'
import { isPlaceExperienceEnabled } from '@/lib/place/shell-loader'
import type { Sql } from '@/lib/workspaces/service'
export const dynamic = 'force-dynamic'

// Read-only resolution: SQL text is fixed inside lib/place; values stay bound.
const sql: Sql = { query: <T,>(text: string, values: unknown[]) => prisma.$queryRawUnsafe<T[]>(text, ...values) }

async function request(req: Request, write: boolean) {
  try {
    if (process.env.LISTENING_PILOT_ENABLED !== 'true') throw new ListenError(503, 'The listening pilot is not open on this deployment')
    const session = await auth()
    if (!session?.user?.id) throw new ListenError(401, 'Sign in to continue')
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { emailVerified: true } })
    if (!user?.emailVerified) throw new ListenError(403, 'Verify your email to join the listening pilot')
    const service = listenService({
      ...adapter(prisma),
      transaction: (operation: (tx: ReturnType<typeof adapter>) => Promise<unknown>) => prisma.$transaction(tx => operation(adapter(tx))),
    }, session.user.id)
    // Place-linked listening: the slug is resolved server-side to the immutable Place ID.
    const placeFor = async (slug: unknown) => {
      if (!isPlaceExperienceEnabled()) throw new ListenError(404, 'Place not found')
      const resolved = await resolveListeningPlace(sql, slug)
      if (resolved.outcome === 'not_found') throw new ListenError(404, 'Place not found')
      return resolved.place
    }
    if (!write) {
      const slug = new URL(req.url).searchParams.get('place')
      if (slug === null) return Response.json(await service.home(), { headers: privateHeaders })
      const place = await placeFor(slug)
      return Response.json({ ...(await service.homeForPlace(place.placeId)), place: { slug: place.slug, title: place.name } }, { headers: privateHeaders })
    }
    // Require the configured external origin; never trust user-supplied forwarding headers.
    const origin = process.env.NEXTAUTH_URL
    if (!origin || req.headers.get('origin') !== new URL(origin).origin) throw new ListenError(403, 'Same-origin request required')
    const input = await body(req) as Record<string, unknown>
    if (!input || typeof input !== 'object') throw new ListenError(400, 'Invalid submission')
    let result: unknown
    if (input.action === 'place') result = await service.createPlot(input)
    else if (input.action === 'visit') result = await service.saveVisit(input)
    else if (input.action === 'delete') result = await service.deletePlot(input.id)
    else if (input.action === 'place_listen') {
      const place = await placeFor(input.slug)
      result = await service.listenAtPlace({ placeId: place.placeId, name: place.name, id: input.id })
    }
    else throw new ListenError(400, 'Unknown action')
    return Response.json(result, { headers: privateHeaders })
  } catch (error) {
    const known = error instanceof ListenError || error instanceof WorkspaceError
    return Response.json({ error: known ? error.message : 'The request could not be confirmed. Keep your form and retry with the same submission identifier.' }, { status: known ? error.status : 500, headers: privateHeaders })
  }
}
export const GET = (req: Request) => request(req, false)
export const POST = (req: Request) => request(req, true)
