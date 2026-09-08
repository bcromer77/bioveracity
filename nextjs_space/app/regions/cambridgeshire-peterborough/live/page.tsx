import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { RegionalOperatingPicture } from '@/components/regions/cambridgeshire/operating-picture'
import type {
  OPPoint,
  OPEvent,
  OPConnection,
} from '@/components/regions/cambridgeshire/operating-picture'

export const dynamic = 'force-dynamic'

const REGION_SLUG = 'cambridgeshire'

// Receiving-water relationships are asserted ONLY where the public record supports
// a direct discharge relationship. Everything else stays null (never inferred).
const RECEIVING_WATER: Record<string, string> = {
  'march-wrc': 'River Nene',
  'milton-wrc': 'River Cam',
}

export const metadata = {
  title: 'Cambridgeshire & Peterborough — Regional view | BioVeracity',
  description:
    'The regional operating picture for Cambridgeshire & Peterborough — places, source-backed connections and an evidence chronology you can replay through time. A product concept built on the real public record.',
}

export default async function CambridgeshireLivePage() {
  const [assets, eventsRaw] = await Promise.all([
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
      // Honest evidence posture — no scores. 'verified' is reserved for places
      // where an official regulator classification has been located and attached.
      let evidenceState = 'neutral'
      if (a._count.divergences > 0) evidenceState = 'divergence'
      else if (a.statusDetail && /\bclassification\b|\bverified\b/i.test(a.statusDetail)) {
        evidenceState = 'verified'
      }
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
  const waterSlugByName: Record<string, string> = {}
  for (const a of assets) {
    if (a.type === 'river' || a.type === 'lake') waterSlugByName[a.name] = a.slug
  }
  const connections: OPConnection[] = Object.entries(RECEIVING_WATER)
    .map(([fromSlug, waterName]) => ({
      fromSlug,
      toSlug: waterSlugByName[waterName] ?? '',
      label: 'discharges to',
    }))
    .filter((c) => c.toSlug && plotted.has(c.fromSlug) && plotted.has(c.toSlug))

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

// Keep a plain link in the tree for crawlers / no-JS fallback context.
export function _NoscriptBack() {
  return <Link href="/regions/cambridgeshire-peterborough">Back to the regional evidence picture</Link>
}
