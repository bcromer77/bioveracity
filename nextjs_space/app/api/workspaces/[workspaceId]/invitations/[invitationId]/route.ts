import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { adapter, privateHeaders } from '@/lib/workspaces/http'
import { institutionalInviteService } from '@/lib/workspaces/invitations'
import { WorkspaceError, type Database } from '@/lib/workspaces/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db: Database = {
  ...adapter(prisma),
  transaction: operation => prisma.$transaction(tx => operation(adapter(tx)), { isolationLevel: 'Serializable' }),
}

export async function DELETE(_request: Request, context: { params: Promise<{ workspaceId: string; invitationId: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new WorkspaceError(401, 'Authentication required')
    const { workspaceId, invitationId } = await context.params
    return Response.json(await institutionalInviteService(db, session.user.id).revoke(workspaceId, invitationId), { headers: privateHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof WorkspaceError ? error.message : 'Invitation could not be revoked' }, {
      status: error instanceof WorkspaceError ? error.status : 500,
      headers: privateHeaders,
    })
  }
}
