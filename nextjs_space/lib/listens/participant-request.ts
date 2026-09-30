// PILOT-001 NE demo: shared guard for participant-observation API routes.
// Both server-only flags must be exactly 'true'; the participant must be signed in
// with a verified email. The Place is always resolved server-side from its slug.
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { adapter, privateHeaders } from '@/lib/workspaces/http'
import { WorkspaceError } from '@/lib/workspaces/service'
import type { Sql } from '@/lib/workspaces/service'
import { ListenError } from '@/lib/listens/domain.mjs'
import { isObservationPilotEnabled, resolveObservationPlace } from '@/lib/place/participation'
import { isPlaceExperienceEnabled } from '@/lib/place/shell-loader'

export const sql: Sql = { query: <T,>(text: string, values: unknown[]) => prisma.$queryRawUnsafe<T[]>(text, ...values) }
export const database = {
  ...adapter(prisma),
  transaction: (operation: (tx: ReturnType<typeof adapter>) => Promise<unknown>) => prisma.$transaction(tx => operation(adapter(tx)), { timeout: 20000 }),
}

export async function participant(): Promise<string> {
  if (!isObservationPilotEnabled() || !isPlaceExperienceEnabled()) throw new ListenError(503, 'Observations are not open on this deployment')
  const session = await auth()
  if (!session?.user?.id) throw new ListenError(401, 'Sign in to continue')
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { emailVerified: true } })
  if (!user?.emailVerified) throw new ListenError(403, 'Verify your email to make observations')
  return session.user.id
}

export async function observationPlace(slug: unknown) {
  const resolved = await resolveObservationPlace(sql, slug)
  if (resolved.outcome === 'not_found') throw new ListenError(404, 'Place not found')
  return resolved.place
}

/** Writes require the configured external origin; forwarding headers are never trusted. */
export function assertConfiguredOrigin(req: Request) {
  const origin = process.env.NEXTAUTH_URL
  if (!origin || req.headers.get('origin') !== new URL(origin).origin) throw new ListenError(403, 'Same-origin request required')
}

export function failure(error: unknown) {
  const known = error instanceof ListenError || error instanceof WorkspaceError
  if (!known) console.error('participant observation request failed', error instanceof Error ? error.name : 'unknown')
  return Response.json({ error: known ? (error as Error).message : 'The save could not be confirmed. Your observation is kept on this screen: retry and it will not be saved twice.' }, { status: known ? (error as ListenError).status : 500, headers: privateHeaders })
}
