import { prisma } from '@/lib/prisma'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { SearchHero } from '@/components/home/search-hero'
import { RecentlyChanged } from '@/components/home/recently-changed'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const recentEvents = await prisma.event.findMany({
    take: 8,
    orderBy: { date: 'desc' },
    include: { asset: { select: { name: true, slug: true, type: true } } },
  })

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <SearchHero />
        <RecentlyChanged events={recentEvents ?? []} />
      </main>
      <SiteFooter />
    </div>
  )
}
