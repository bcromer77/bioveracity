import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { adapter, privateHeaders } from '@/lib/workspaces/http'
import { attentionService } from '@/lib/attention/service'
import { WorkspaceError, type Database } from '@/lib/workspaces/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db: Database = {
  ...adapter(prisma),
  transaction: operation => prisma.$transaction(tx => operation(adapter(tx)), { isolationLevel: 'Serializable' }),
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Authentication required' }, { status: 401, headers: privateHeaders })
  const rows = await prisma.attentionPreference.findMany({
    where: { userId: session.user.id },
    select: { scopeKey: true, actionEmail: true, importantChangeEmail: true, weeklyDigest: true, routineEmail: true },
  })
  const global = rows.find(r => r.scopeKey === 'GLOBAL') ?? {
    scopeKey: 'GLOBAL', actionEmail: true, importantChangeEmail: true, weeklyDigest: true, routineEmail: false,
  }
  return Response.json({ preference: global }, { headers: privateHeaders })
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new WorkspaceError(401, 'Authentication required')
    const input = await request.json()
    const values = {
      actionEmail: input.actionEmail === true,
      importantChangeEmail: input.importantChangeEmail === true,
      weeklyDigest: input.weeklyDigest === true,
      routineEmail: input.routineEmail === true,
    }
    const saved = await attentionService(db).updatePreference(session.user.id, 'GLOBAL', values)
    return Response.json({ preference: saved }, { headers: privateHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof WorkspaceError ? error.message : 'Preferences could not be saved' }, {
      status: error instanceof WorkspaceError ? error.status : 500,
      headers: privateHeaders,
    })
  }
}
