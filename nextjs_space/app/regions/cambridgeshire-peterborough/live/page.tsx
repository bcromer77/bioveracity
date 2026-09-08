import { prisma } from '@/lib/prisma'
import { RegionalOperatingPicture } from '@/components/regions/cambridgeshire/operating-picture'
import type {
  OPPoint,
  OPEvent,
  OPConnection,
} from '@/components/regions/cambridgeshire/operating-picture'
import { verifiedDischargeConnections } from '@/lib/region-relations'

export const dynamic = 'force-dynamic'

const REGION_SLUG = 'cambridgeshire'

export const metadata = {
  title: 'Cambridgeshire & Peterborough — Regional view | BioVeracity',
  description:
    'The regional operating picture for Cambridgeshire & Peterborough — places, source-backed connections and an evidence chronology you can replay through time. A product concept built on the real public record.',
}

export default async function CambridgeshireLivePage() {
  const [assets, eventsRaw, relations] = await Promise.all([
    prisma.asset.findMany({
      where: { regionSlug: REGION_SLUG },
      orderBy: { priorityScore: 'desc' },
      include: {
        _count: { select: { divergences: true } },
      },
    }),
    prisma.event.findMany({
      where: { asset: { regionSlug: REGION_SLUG } },
      orderBy: { date: 'asc' },
      include: {
        asset: {
          select: { name: true, slug: true, type: true, latitude: true, longitude: true },
        },
      },
    }),
    prisma.assetRelation.findMany({
      where: {
        relationshipType: 'DISCHARGES_TO',
        verificationState: 'VERIFIED',
        sourceUrl: { startsWith: 'https://' },
        fromAsset: { regionSlug: REGION_SLUG },
        toAsset: { regionSlug: REGION_SLUG },
      },
      include: {
        fromAsset: { select: { slug: true } },
        toAsset: { select: { slug: true, name: true } },
      },
    }),
  ])

  const mapCategory = (type: string): string => {
    if (type === 'river' || type === 'lake' || type === 'monitoring') return 'environment'
    if (type === 'wastewater' || type === 'industrial') return 'operations'
    return 'other'
  }

  // Canonical places (only those with verified coordinates are plottable).
  const places: OPPoint[] = assets
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => {
      // Review belongs to individual evidence records, not an entire place.
      const evidenceState = 'neutral'
      return {
        slug: a.slug,
        name: a.name,
        type: a.type,
        lat: a.latitude as number,
        lng: a.longitude as number,
        indicative: a.type === 'river',
        category: mapCategory(a.type),
        evidenceState,
      }
    })

  // One chronology, drawn straight from the real, source-backed public record.
  const chronology: OPEvent[] = eventsRaw.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date.toISOString(),
    eventType: e.eventType,
    evidenceClass: e.evidenceClass,
    changeType: e.changeType,
    datePrecision: e.datePrecision,
    sourceUrl: e.sourceUrl,
    sourceDomain: e.sourceDomain,
    assetSlug: e.asset.slug,
    assetName: e.asset.name,
    lat: e.asset.latitude ?? null,
    lng: e.asset.longitude ?? null,
  }))

  // Source-backed connections only (WRC → receiving water), both endpoints plotted.
  const plotted = new Set(places.map((p) => p.slug))
  const connections: OPConnection[] = verifiedDischargeConnections(relations, plotted)
    .map(({ fromSlug, toSlug, label }) => ({ fromSlug, toSlug, label }))

  return (
    <RegionalOperatingPicture
      regionName="Cambridgeshire & Peterborough"
      places={places}
      chronology={chronology}
      connections={connections}
      backHref="/regions/cambridgeshire-peterborough"
    />
  )
}
