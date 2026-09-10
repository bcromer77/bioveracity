import { Suspense } from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { WorkspaceCanvas } from '@/components/workspace/workspace-canvas'

export const dynamic = 'force-dynamic'

export default async function WorkspaceCanvasPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/workspace/${encodeURIComponent(workspaceId)}`)
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10">
        <Suspense fallback={<p role="status">Loading workspace...</p>}>
          <WorkspaceCanvas workspaceId={workspaceId} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
