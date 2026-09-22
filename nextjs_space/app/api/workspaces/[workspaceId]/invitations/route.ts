import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { adapter, body, privateHeaders } from '@/lib/workspaces/http'
import { institutionalInviteService, type InviteRole } from '@/lib/workspaces/invitations'
import { WorkspaceError, type Database } from '@/lib/workspaces/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db: Database = {
  ...adapter(prisma),
  transaction: operation => prisma.$transaction(tx => operation(adapter(tx)), { isolationLevel: 'Serializable' }),
}

export async function POST(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new WorkspaceError(401, 'Authentication required')
    if (process.env.PRIVATE_WORKSPACES_ENABLED !== 'true') throw new WorkspaceError(503, 'Private workspaces are unavailable')
    const { workspaceId } = await context.params
    const input = await body(request) as Record<string, unknown>
    const invitation = await institutionalInviteService(db, session.user.id).create({
      workspaceId,
      caseId: typeof input.caseId === 'string' && input.caseId ? input.caseId : null,
      email: input.email,
      role: String(input.role || 'VIEWER') as InviteRole,
      canExport: input.canExport === true,
      expiresInHours: typeof input.expiresInHours === 'number' ? input.expiresInHours : undefined,
    })
    const url = `/join/${encodeURIComponent(invitation.token)}`
    return Response.json({ invitation: { id: invitation.id, expiresAt: invitation.expiresAt, url } }, { status: 201, headers: privateHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof WorkspaceError ? error.message : 'Invitation could not be created' }, {
      status: error instanceof WorkspaceError ? error.status : 500,
      headers: privateHeaders,
    })
  }
}
