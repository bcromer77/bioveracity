import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { MyPlacesList } from '@/components/my-places/my-places-list'
import { pickLastChange } from '@/lib/search'

export const dynamic = 'force-dynamic'

export default async function MyPlacesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=/my-places')

  const watchlists = await prisma.watchlist.findMany({
    where: { userId: session?.user?.id },
    include: {
      asset: {
        include: {
          events: { orderBy: { date: 'desc' }, take: 20 },
          _count: { select: { evidenceGaps: true, divergences: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const places = (watchlists ?? [])
    .filter((w: any) => w?.asset)
    .map((w: any) => {
      const lc = pickLastChange(w?.asset?.events ?? [])
      return {
        watchlistId: w?.id,
        assetId: w?.assetId,
        slug: w?.asset?.slug,
        name: w?.asset?.name,
        type: w?.asset?.type,
        region: w?.asset?.region,
        status: w?.asset?.status,
        reason: w?.reason ?? null,
        gapCount: w?.asset?._count?.evidenceGaps ?? 0,
        divergenceCount: w?.asset?._count?.divergences ?? 0,
        lastChange: lc
          ? { title: lc.title, date: lc.date?.toISOString?.() ?? String(lc.date), changeType: lc.changeType, evidenceClass: lc.evidenceClass }
          : null,
      }
    })

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[1100px] px-4 py-10">
          <div className="mb-8">
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">My Picture</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              The places you are following. When the evidence around one of them changes, this is where it surfaces first.
            </p>
          </div>
          <MyPlacesList initialPlaces={places} />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
