import { prisma } from '@/lib/prisma'
import { enabled } from '@/lib/wild-hubs/http'

// A signed-in person can belong to more than one BioVeracity product context.
// The resolver uses this shape to send them to the right home rather than a
// single universal dashboard.
export type UserContext = {
  // Member of at least one professional investigation workspace.
  isProfessional: boolean
  // Owns at least one venue hub (Fodder, Nicholas Mosse, self-service venues).
  ownsVenue: boolean
  venueCount: number
}

// Where a single-context person should land after signing in.
export function contextHome(ctx: UserContext): string {
  // Venue owners belong in their venue studio, never the professional workspace.
  if (ctx.ownsVenue && !ctx.isProfessional) return '/wild/studio'
  // Professionals (and, for now, plain registered accounts) use the workspace.
  return '/workspace'
}

export async function resolveUserContext(userId: string): Promise<UserContext> {
  // Venue ownership only counts when the venue product is switched on; when it
  // is dark (e.g. live production) nobody is routed into the studio.
  const [memberships, venueCount] = await Promise.all([
    prisma.privateWorkspaceMember.count({
      where: { userId, revokedAt: null },
    }),
    enabled()
      ? prisma.wildHub.count({ where: { ownerId: userId } })
      : Promise.resolve(0),
  ])
  return {
    isProfessional: memberships > 0,
    ownsVenue: venueCount > 0,
    venueCount,
  }
}
