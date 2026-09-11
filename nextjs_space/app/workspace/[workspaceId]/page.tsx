import { Suspense } from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { adapter } from '@/lib/workspaces/http'
import { workspaceService } from '@/lib/workspaces/service'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { WorkspaceCanvas } from '@/components/workspace/workspace-canvas'

export const dynamic = 'force-dynamic'

export default async function WorkspaceCanvasPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/workspace/${encodeURIComponent(workspaceId)}`)
  // Read the persisted workspace type so the canvas opens with the saved preset
  // (not whatever the URL happens to carry). Failure falls back to the URL param.
  let initialPersona: string | null = null
  try {
    const service = workspaceService({
      ...adapter(prisma),
      transaction: op => prisma.$transaction(tx => op(adapter(tx)), { isolationLevel: 'Serializable' }),
    }, session.user.id)
    initialPersona = (await service.getWorkspace(workspaceId)).persona
  } catch { initialPersona = null }
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10">
        <Suspense fallback={<p role="status">Loading workspace...</p>}>
          <WorkspaceCanvas workspaceId={workspaceId} initialPersona={initialPersona} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
