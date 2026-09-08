import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { isInstitutional } from '@/lib/access'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PlacePage } from '@/components/asset/place-page'

export const dynamic = 'force-dynamic'

export default async function AssetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const asset = await prisma.asset.findUnique({
    where: { slug },
    include: {
      events: { orderBy: { date: 'desc' } },
      authorisations: { orderBy: { grantedDate: 'desc' } },
      capitalProjects: { orderBy: { startDate: 'desc' } },
      regulatoryItems: { orderBy: { date: 'desc' } },
      measurements: { orderBy: { date: 'desc' }, take: 20 },
      communityItems: { orderBy: { date: 'desc' } },
      newsItems: { orderBy: { date: 'desc' }, take: 10 },
      evidenceGaps: { orderBy: { priority: 'asc' } },
      divergences: { orderBy: { date: 'desc' } },
      unresolvedQuestions: {
        orderBy: { openedAt: 'desc' },
        include: { resolutionPaths: { orderBy: { createdAt: 'asc' } } },
      },
      changeRecords: {
        where: { published: true },
        orderBy: [{ eventDate: 'desc' }, { detectedAt: 'desc' }],
      },
      relationsFrom: { include: { toAsset: { select: { name: true, slug: true, type: true } } } },
      relationsTo: { include: { fromAsset: { select: { name: true, slug: true, type: true } } } },
    },
  })

  if (!asset) notFound()

  const session = await auth()
  const isAuthed = !!session?.user
  const institutional = isInstitutional(session)
  let isFollowing = false
  if (isAuthed && session?.user?.id) {
    const existing = await prisma.watchlist.findFirst({
      where: { userId: session.user.id, assetId: asset.id },
    })
    isFollowing = !!existing
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <PlacePage asset={asset} isAuthed={isAuthed} isFollowing={isFollowing} isInstitutional={institutional} />
      </main>
      <SiteFooter />
    </div>
  )
}
