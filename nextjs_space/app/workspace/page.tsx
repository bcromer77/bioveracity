import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { WorkspaceDashboard } from '@/components/workspace/workspace-dashboard'

export const dynamic = 'force-dynamic'

export default async function WorkspacePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=/workspace')
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10">
        <WorkspaceDashboard />
      </main>
      <SiteFooter />
    </div>
  )
}
