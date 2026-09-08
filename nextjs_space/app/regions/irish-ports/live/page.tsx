import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { hasPortProvenance, portDatePrecision, portReplayWindow } from '@/lib/port-provenance'
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

  // Stored place coordinates; location presence does not verify the place.
  const ports: OPPoint[] = assets
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => {
      const evidenceState = 'neutral' // No place-wide verdict from unreviewed legacy counts.

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
  const milestoneCards: OPEvent[] = []

  for (const a of assets) {
    if (a.latitude == null || a.longitude == null) continue
    const lat = a.latitude as number
    const lng = a.longitude as number
    const projects = a.capitalProjects.filter(p => hasPortProvenance(p) && p.startDate)
    const permits = a.authorisations.filter(p => hasPortProvenance(p) && p.grantedDate)
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
      milestoneCards.push({
        id: `project:${p.id}`, title: `${p.name} · ${p.status}`,
        description: p.description, date: p.startDate!.toISOString(),
        datePrecision: portDatePrecision(p as typeof p & { datePrecision?: string | null }),
        eventType: 'planning', evidenceClass: p.evidenceClass, changeType: 'event',
        sourceUrl: p.sourceUrl, sourceDomain: new URL(p.sourceUrl!).hostname,
        assetSlug: slug, assetName: a.name, lat: pos.lat, lng: pos.lng,
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
      milestoneCards.push({
        id: `permit:${pm.id}`, title: `${humanPermit(pm.type)} · ${pm.status}`,
        description: pm.description, date: pm.grantedDate!.toISOString(),
        datePrecision: portDatePrecision(pm as typeof pm & { datePrecision?: string | null }),
        eventType: 'regulatory', evidenceClass: pm.evidenceClass, changeType: 'event',
        sourceUrl: pm.sourceUrl, sourceDomain: new URL(pm.sourceUrl!).hostname,
        assetSlug: slug, assetName: a.name, lat: pos.lat, lng: pos.lng,
      })
      connections.push({ fromSlug: a.slug, toSlug: slug, label: humanPermit(pm.type) })
      i++
    }
  }

  // The same server-side window governs both cards and their related markers.
  // Missing provenance is withheld, never repaired with invented metadata.
  const supportedEvents = eventsRaw.filter(hasPortProvenance)
  const allChronology: OPEvent[] = [
    ...supportedEvents.map((e) => ({
      id: e.id, title: e.title, description: e.description,
      date: e.date.toISOString(), datePrecision: portDatePrecision(e),
      eventType: e.eventType, evidenceClass: e.evidenceClass, changeType: e.changeType,
      sourceUrl: e.sourceUrl, sourceDomain: e.sourceDomain,
      assetSlug: e.asset.slug, assetName: e.asset.name,
      lat: e.asset.latitude ?? null, lng: e.asset.longitude ?? null,
    })),
    ...milestoneCards,
  ].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const chronology = portReplayWindow(allChronology, institutional, FREE_WINDOW_MONTHS)
  const visibleSlugs = new Set(chronology.map(e => e.assetSlug))
  const places: OPPoint[] = [...ports, ...childNodes.filter(p => visibleSlugs.has(p.slug))]
  const visibleConnections = connections.filter(c => visibleSlugs.has(c.toSlug))
  const accessNote = chronology.length < allChronology.length
    ? `Free access replays the most recent ${FREE_WINDOW_MONTHS} months of the eligible record. Institutional access includes earlier eligible records.`
    : undefined
  const withheld = eventsRaw.length - supportedEvents.length
    + assets.reduce((sum, a) => sum + a.capitalProjects.length + a.authorisations.length, 0)
    - milestoneCards.length

  return (
    <RegionalOperatingPicture
      regionName="Irish Ports"
      places={places}
      chronology={chronology}
      connections={visibleConnections}
      backHref="/regions/irish-ports"
      relationshipNote={`Related-record positions around a port are schematic, not geographic. ${withheld} records are withheld pending source metadata or a usable milestone date. Source links support inspection; they do not independently establish a claim.`}
      accessNote={accessNote}
      institutionalHref={accessNote ? '/institutional' : undefined}
    />
  )
}

// Keep a plain link in the tree for crawlers / no-JS fallback context.
export function _NoscriptBack() {
  return <Link href="/regions/irish-ports">Back to the Irish Ports evidence picture</Link>
}
