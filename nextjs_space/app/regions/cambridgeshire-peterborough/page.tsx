import { CamSourceContext } from '@/components/regions/cambridgeshire/cam-source-context'
import { prisma } from '@/lib/prisma'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import {
  CambridgeshireShowcase,
  type ShowAsset,
  type ShowEvent,
  type ShowDivergence,
  type ShowGap,
  type ShowCounts,
} from '@/components/regions/cambridgeshire/showcase'
import type { MapPoint } from '@/components/regions/cambridgeshire/regional-map-inner'

export const dynamic = 'force-dynamic'

const REGION_SLUG = 'cambridgeshire'

// Receiving-water relationships are asserted ONLY where the public record supports
// a direct discharge relationship. Everything else stays null (not inferred).
const RECEIVING_WATER: Record<string, string> = {
  'march-wrc': 'River Nene',
  'milton-wrc': 'River Cam',
}

export const metadata = {
  title: 'Cambridgeshire & Peterborough — Regional evidence picture | BioVeracity',
  description:
    'The environmental memory of Cambridgeshire & Peterborough — what was measured, reported, authorised and done around its rivers, wastewater assets and projects, assembled from the public record.',
}

export default async function CambridgeshirePeterboroughPage() {
  const assets = await prisma.asset.findMany({
    where: { regionSlug: REGION_SLUG },
    orderBy: { priorityScore: 'desc' },
    include: {
      events: { orderBy: { date: 'desc' } },
      capitalProjects: { orderBy: { createdAt: 'desc' } },
      _count: {
        select: {
          events: true,
          evidenceGaps: true,
          divergences: true,
          capitalProjects: true,
          regulatoryItems: true,
        },
      },
    },
  })

  const [
    measurementCount,
    regulatoryCount,
    projectCount,
    openGapCount,
    recentEventsRaw,
    divergencesRaw,
    gapsRaw,
  ] = await Promise.all([
    prisma.measurement.count({ where: { asset: { regionSlug: REGION_SLUG } } }),
    prisma.regulatoryActivity.count({ where: { asset: { regionSlug: REGION_SLUG } } }),
    prisma.capitalProject.count({ where: { asset: { regionSlug: REGION_SLUG } } }),
    prisma.evidenceGap.count({ where: { asset: { regionSlug: REGION_SLUG }, status: 'open' } }),
    prisma.event.findMany({
      where: { asset: { regionSlug: REGION_SLUG } },
      orderBy: { date: 'desc' },
      take: 14,
      include: { asset: { select: { name: true, slug: true } } },
    }),
    prisma.divergence.findMany({
      where: { asset: { regionSlug: REGION_SLUG } },
      orderBy: { date: 'desc' },
      include: { asset: { select: { name: true, slug: true } } },
    }),
    prisma.evidenceGap.findMany({
      where: { asset: { regionSlug: REGION_SLUG }, status: 'open' },
      orderBy: { priority: 'asc' },
      include: { asset: { select: { name: true, slug: true } } },
    }),
  ])

  const waterTypes = new Set(['river', 'lake'])
  const wastewaterTypes = new Set(['wastewater', 'industrial'])

  const toShowAsset = (a: (typeof assets)[number]): ShowAsset => ({
    slug: a.slug,
    name: a.name,
    type: a.type,
    subtype: a.subtype,
    status: a.status,
    statusDetail: a.statusDetail,
    summary: a.summary,
    operatorName: a.operatorName,
    regulatorName: a.regulatorName,
    receivingWater: RECEIVING_WATER[a.slug] ?? null,
    projectCount: a._count.capitalProjects,
    regulatoryCount: a._count.regulatoryItems,
    gapCount: a._count.evidenceGaps,
    divergenceCount: a._count.divergences,
    latestProject: a.capitalProjects[0]?.name ?? null,
  })

  const counts: ShowCounts = {
    waterBodies: assets.filter((a) => waterTypes.has(a.type)).length,
    wastewater: assets.filter((a) => wastewaterTypes.has(a.type)).length,
    monitoringRecords: measurementCount,
    regulatoryChanges: regulatoryCount,
    projects: projectCount,
    openGaps: openGapCount,
  }

  const wastewater = assets.filter((a) => wastewaterTypes.has(a.type)).map(toShowAsset)
  const waters = assets.filter((a) => waterTypes.has(a.type)).map(toShowAsset)

  const flagshipRaw = assets.find((a) => a.slug === 'river-cam') ?? null
  const flagship = flagshipRaw ? toShowAsset(flagshipRaw) : null

  const recentEvents: ShowEvent[] = recentEventsRaw.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date.toISOString(),
    eventType: e.eventType,
    evidenceClass: e.evidenceClass,
    changeType: e.changeType,
    datePrecision: e.datePrecision,
    assetSlug: e.asset.slug,
    assetName: e.asset.name,
  }))

  const divergences: ShowDivergence[] = divergencesRaw.map((d) => ({
    id: d.id,
    title: d.title,
    date: d.date.toISOString(),
    summary: d.summary,
    before: d.before,
    theChange: d.theChange,
    theDifference: d.theDifference,
    whatHappenedNext: d.whatHappenedNext,
    assetSlug: d.asset.slug,
    assetName: d.asset.name,
  }))

  const gaps: ShowGap[] = gapsRaw.map((g) => ({
    id: g.id,
    description: g.description,
    consequence: g.consequence,
    dataRequired: g.dataRequired,
    priority: g.priority,
    assetSlug: g.asset.slug,
    assetName: g.asset.name,
  }))

  const mapCategory = (type: string): string => {
    if (type === 'river' || type === 'lake' || type === 'monitoring') return 'water'
    if (type === 'wastewater' || type === 'industrial') return 'sewage'
    return 'other'
  }

  const mapPoints: MapPoint[] = assets
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => {
      // Honest evidence posture — no scores, no inference.
      // 'verified' is reserved for places where an official regulator
      // classification has been located and attached — not the mere word
      // "located" in prose. Anything else stays neutral (never over-claimed).
      let evidenceState = 'neutral'
      if (a._count.divergences > 0) evidenceState = 'divergence'
      else if (a.statusDetail && /\bclassification\b|\bverified\b/i.test(a.statusDetail)) {
        evidenceState = 'verified'
      }
      const latest = a.events[0]
      return {
        slug: a.slug,
        name: a.name,
        type: a.type,
        lat: a.latitude as number,
        lng: a.longitude as number,
        indicative: a.type === 'river',
        category: mapCategory(a.type),
        latestChange: latest?.title ?? null,
        latestChangeDate: latest ? latest.date.toISOString() : null,
        evidenceState,
      }
    })

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <CamSourceContext />
        <CambridgeshireShowcase
          counts={counts}
          wastewater={wastewater}
          waters={waters}
          recentEvents={recentEvents}
          divergences={divergences}
          gaps={gaps}
          mapPoints={mapPoints}
          flagship={flagship}
        />
      </main>
      <SiteFooter />
    </div>
  )
}
