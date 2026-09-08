import { prisma } from '@/lib/prisma'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { AssetsGrid } from '@/components/assets/assets-grid'

export const dynamic = 'force-dynamic'

export default async function AssetsPage() {
  const assets = await prisma.asset.findMany({
    orderBy: { priorityScore: 'desc' },
    include: {
      _count: { select: { events: true, evidenceGaps: true, capitalProjects: true } },
    },
  })

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[1200px] px-4 py-8">
          <h1 className="font-display text-2xl font-bold tracking-tight mb-2">All Assets</h1>
          <p className="text-sm text-muted-foreground mb-6">Environmental infrastructure under evidence review</p>
          <AssetsGrid assets={assets ?? []} />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
