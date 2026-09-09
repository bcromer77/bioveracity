import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { isInstitutional } from '@/lib/access'
import { RegionalOperatingPicture } from '@/components/regions/cambridgeshire/operating-picture'
import type {
  OPPoint,
  OPEvent,
  OPConnection,
} from '@/components/regions/cambridgeshire/operating-picture'

export const dynamic = 'force-dynamic'

const REGION_SLUG = 'irish_ports'

// Free access sees a recent, curated replay window. The complete history and
// arbitrary period selection are an institutional capability — enforced here on
// the server (the data itself is limited), not merely hidden in the UI.
const FREE_WINDOW_MONTHS = 24

export const metadata = {
  title: 'Irish Ports — Regional view | BioVeracity',
  description:
    'The regional operating picture for Ireland’s ports — Cork, Dublin, Shannon Foynes, Rosslare and Waterford — with source-backed places, the projects and permits recorded against each port, and an evidence chronology you can replay through time. A product concept built on the real public record.',
}

// Small deterministic radial offset (degrees) so a port's projects and permits
// sit in a readable ring around it. This is a schematic layout for related
// records that genuinely belong to the port — not a geographic claim.
function offset(lat: number, lng: number, index: number, total: number, radius: number) {
  const angle = (2 * Math.PI * index) / Math.max(1, total) - Math.PI / 2
  // longitude scaled by cos(lat) so the ring looks circular on the map
  return {
    lat: lat + radius * Math.sin(angle),
    lng: lng + (radius * Math.cos(angle)) / Math.cos((lat * Math.PI) / 180),
  }
}

function humanPermit(type: string): string {
  const t = (type || '').toLowerCase()
  if (t.includes('dumping')) return 'Dumping-at-sea permit'
  if (t === 'mac' || t.includes('maritime area')) return 'Maritime Area Consent'
  if (t.includes('foreshore')) return 'Foreshore consent'
  if (t.includes('ippc') || t.includes('ie ') || t.includes('licence')) return 'Environmental licence'
  return 'Authorisation'
}

export default async function IrishPortsLivePage() {
  const session = await auth()
  const institutional = isInstitutional(session)

  const [assets, eventsRaw] = await Promise.all([
    prisma.asset.findMany({
      where: { regionSlug: REGION_SLUG },
      orderBy: { priorityScore: 'desc' },
      include: {
        _count: { select: { divergences: true } },
        capitalProjects: { orderBy: { startDate: 'desc' } },
        authorisations: { orderBy: { grantedDate: 'desc' } },
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
    if (type === 'river' || type === 'lake' || type === 'estuary' || type === 'monitoring') return 'environment'
    if (type === 'port' || type === 'wastewater' || type === 'industrial') return 'operations'
    return 'other'
  }

  // Canonical places (only those with verified coordinates are plottable).
  const ports: OPPoint[] = assets
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => {
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
        indicative: a.type === 'river' || a.type === 'estuary',
        category: mapCategory(a.type),
        evidenceState,
      }
    })

  // Honeycomb: for every port, add the projects and permits recorded against it
  // as related nodes, arranged in a schematic ring, and link them to the port.
  // These are source-backed parent–child relationships (the rows belong to the
  // port), never proximity inference.
  const childNodes: OPPoint[] = []
  const connections: OPConnection[] = []

  for (const a of assets) {
    if (a.latitude == null || a.longitude == null) continue
    const lat = a.latitude as number
    const lng = a.longitude as number
    const projects = a.capitalProjects
    const permits = a.authorisations
    const total = projects.length + permits.length
    if (total === 0) continue

    let i = 0
    for (const p of projects) {
      const pos = offset(lat, lng, i, total, 0.045)
      const slug = `${a.slug}__project__${p.id}`
      childNodes.push({
        slug,
        name: p.name,
        type: 'project',
        lat: pos.lat,
        lng: pos.lng,
        indicative: true,
        category: 'operations',
        evidenceState: 'neutral',
      })
      connections.push({ fromSlug: a.slug, toSlug: slug, label: 'Capital project on the public record' })
      i++
    }
    for (const pm of permits) {
      const pos = offset(lat, lng, i, total, 0.045)
      const slug = `${a.slug}__permit__${pm.id}`
      childNodes.push({
        slug,
        name: `${humanPermit(pm.type)}${pm.permitRef ? ` · ${pm.permitRef}` : ''}`,
        type: 'industrial',
        lat: pos.lat,
        lng: pos.lng,
        indicative: true,
        category: 'other',
        evidenceState: 'neutral',
      })
      connections.push({ fromSlug: a.slug, toSlug: slug, label: humanPermit(pm.type) })
      i++
    }
  }

  const places: OPPoint[] = [...ports, ...childNodes]

  // Gating: free access is limited to a recent, curated window of the record.
  // Institutional access replays the complete history and arbitrary periods.
  let events = eventsRaw
  let accessNote: string | undefined
  if (!institutional && eventsRaw.length > 0) {
    const maxTs = Math.max(...eventsRaw.map((e) => e.date.getTime()))
    const cutoff = new Date(maxTs)
    cutoff.setMonth(cutoff.getMonth() - FREE_WINDOW_MONTHS)
    const limited = eventsRaw.filter((e) => e.date.getTime() >= cutoff.getTime())
    if (limited.length < eventsRaw.length) {
      events = limited
      accessNote = `Free access replays the most recent ${FREE_WINDOW_MONTHS} months of the record. The complete history — and replay of any earlier period or project window — is an institutional capability.`
    }
  }

  const chronology: OPEvent[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date.toISOString(),
    eventType: e.eventType,
    evidenceClass: e.evidenceClass,
    changeType: e.changeType,
    sourceUrl: e.sourceUrl,
    sourceDomain: e.sourceDomain,
    assetSlug: e.asset.slug,
    assetName: e.asset.name,
    lat: e.asset.latitude ?? null,
    lng: e.asset.longitude ?? null,
  }))

  return (
    <RegionalOperatingPicture
      regionName="Irish Ports"
      places={places}
      chronology={chronology}
      connections={connections}
      backHref="/regions/irish-ports"
      relationshipNote="Lines link each port to the projects and permits recorded against it in the public record. Related-record positions around a port are schematic, not geographic."
      accessNote={accessNote}
      institutionalHref={accessNote ? '/institutional' : undefined}
    />
  )
}

// Keep a plain link in the tree for crawlers / no-JS fallback context.
function _NoscriptBack() {
  return <Link href="/regions/irish-ports">Back to the Irish Ports evidence picture</Link>
}
