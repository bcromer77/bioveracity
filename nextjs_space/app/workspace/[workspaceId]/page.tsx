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

export default async function WorkspaceCanvasPage({ params, searchParams }: { params: Promise<{ workspaceId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { workspaceId } = await params
  const sp = await searchParams
  const session = await auth()
  if (!session?.user?.id) {
    // Preserve any deep-link query (?case=&doc=&cite=) so a shared citation link
    // reopens the exact cited passage after the viewer signs in.
    const qs = new URLSearchParams()
    for (const key of ['case', 'doc', 'cite']) { const v = sp[key]; if (typeof v === 'string' && v) qs.set(key, v) }
    const query = qs.toString()
    const target = `/workspace/${encodeURIComponent(workspaceId)}${query ? `?${query}` : ''}`
    redirect(`/login?callbackUrl=${encodeURIComponent(target)}`)
  }
  // Read the persisted workspace type so the canvas opens with the saved preset
  // (not whatever the URL happens to carry). Failure falls back to the URL param.
  let initialPersona: string | null = null
  let workspaceName: string | undefined
  try {
    const service = workspaceService({
      ...adapter(prisma),
      transaction: op => prisma.$transaction(tx => op(adapter(tx)), { isolationLevel: 'Serializable' }),
    }, session.user.id)
    const saved = await service.getWorkspace(workspaceId)
    initialPersona = saved.persona
    workspaceName = saved.name
  } catch { initialPersona = null }
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10">
        <Suspense fallback={<p role="status">Loading workspace...</p>}>
          <WorkspaceCanvas workspaceId={workspaceId} initialPersona={initialPersona} workspaceName={workspaceName} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
