import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { RegionDetail } from '@/components/regions/region-detail'

export const dynamic = 'force-dynamic'

const REGION_MAP: Record<string, { title: string; description: string; regionSlug: string; livePictureHref?: string }> = {
  'irish-ports': {
    title: 'Irish Ports',
    description: 'Evidence intelligence for Irish port development, dredging operations, offshore renewable energy infrastructure, and marine environmental effects. Covers Port of Cork/Ringaskiddy, Dublin Port, Shannon Foynes, Rosslare Europort and the Port of Waterford (Belview).',
    regionSlug: 'irish_ports',
    livePictureHref: '/regions/irish-ports/live',
  },
  'cambridgeshire': {
    title: 'Cambridgeshire',
    description: 'Evidence intelligence for Cambridgeshire wastewater infrastructure, including March WRC and Milton/Cambridge WRC. Covers Anglian Water AMP8 investment, odour attribution, capacity disputes, and regulatory scrutiny.',
    regionSlug: 'cambridgeshire',
  },
  'scotland': {
    title: 'Scottish Wastewater',
    description: 'Evidence intelligence for Scottish wastewater infrastructure, focusing on Edinburgh Seafield WWTW sludge management, odour assurance, bathing-water compliance, and overflow monitoring.',
    regionSlug: 'scotland',
  },
  'northern-ireland': {
    title: 'Northern Ireland Water',
    description: 'Evidence intelligence for Lough Neagh and the Northern Ireland catchment. Covers nutrient attribution, cyanobacterial blooms, storm overflows, treatment works compliance, and regulatory reform.',
    regionSlug: 'northern_ireland',
  },
}

export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // The Cambridgeshire & Peterborough regional evidence picture is the live showcase.
  if (slug === 'cambridgeshire' || slug === 'cambridgeshire-peterborough') {
    redirect('/regions/cambridgeshire-peterborough')
  }
  const regionInfo = REGION_MAP[slug ?? '']
  if (!regionInfo) notFound()

  const assets = await prisma.asset.findMany({
    where: { regionSlug: regionInfo.regionSlug },
    orderBy: { priorityScore: 'desc' },
    include: {
      events: { take: 3, orderBy: { date: 'desc' } },
      _count: { select: { events: true, evidenceGaps: true, capitalProjects: true } },
    },
  })

  const recentEvents = await prisma.event.findMany({
    where: { asset: { regionSlug: regionInfo.regionSlug } },
    take: 10,
    orderBy: { date: 'desc' },
    include: { asset: { select: { name: true, slug: true } } },
  })

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <RegionDetail
          title={regionInfo.title}
          description={regionInfo.description}
          assets={assets ?? []}
          events={recentEvents ?? []}
          livePictureHref={regionInfo.livePictureHref}
        />
      </main>
      <SiteFooter />
    </div>
  )
}
