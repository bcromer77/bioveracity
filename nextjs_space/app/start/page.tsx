import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function StartPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=/start')

  const [workspaces, hubs] = await Promise.all([
    prisma.privateWorkspaceMember.findMany({
      where: { userId: session.user.id, revokedAt: null },
      select: {
        workspaceId: true,
        cases: {
          where: { revokedAt: null },
          select: { caseId: true },
          take: 3,
        },
      },
      take: 3,
    }),
    prisma.wildHub.findMany({ where: { ownerId: session.user.id }, select: { id: true }, take: 3 }),
  ])

  if (workspaces.length === 1 && hubs.length === 0) {
    const workspace = workspaces[0]
    if (workspace.cases.length === 1) redirect(`/workspace/${encodeURIComponent(workspace.workspaceId)}?case=${encodeURIComponent(workspace.cases[0].caseId)}`)
    redirect(`/workspace/${encodeURIComponent(workspace.workspaceId)}`)
  }
  if (workspaces.length === 0 && hubs.length > 0) redirect('/wild/studio')
  if (workspaces.length === 0 && hubs.length === 0) redirect('/workspace')
  redirect('/workspace')
}
