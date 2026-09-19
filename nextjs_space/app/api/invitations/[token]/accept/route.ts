import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { adapter, privateHeaders } from '@/lib/workspaces/http'
import { invitationAcceptanceService } from '@/lib/workspaces/invitations'
import { WorkspaceError, type Database } from '@/lib/workspaces/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db: Database = {
  ...adapter(prisma),
  transaction: operation => prisma.$transaction(tx => operation(adapter(tx)), { isolationLevel: 'Serializable' }),
}

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.email) throw new WorkspaceError(401, 'Sign in with the invited email address')
    const { token } = await context.params
    const accepted = await invitationAcceptanceService(db, session.user.id, session.user.email).accept(token)
    return Response.json(accepted, { headers: privateHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof WorkspaceError ? error.message : 'Invitation could not be accepted' }, {
      status: error instanceof WorkspaceError ? error.status : 500,
      headers: privateHeaders,
    })
  }
}
