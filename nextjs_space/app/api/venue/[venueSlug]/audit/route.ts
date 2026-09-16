// Public "Official BioVeracity Audit Report" for a single venue, reachable from
// a QR plaque. It renders ONLY real stored data — active statutory permits and
// the latest sensor readings — with honest empty states. Nothing is invented.

import { prisma } from '@/lib/prisma'
import { renderVenueAudit, type VenueAuthItem, type VenueMeasurementItem } from '@/lib/ellona/pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ACTIVE_PERMIT_STATUSES = new Set(['active'])

function typeLabel(type: string): string {
  return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function GET(_request: Request, { params }: { params: Promise<{ venueSlug: string }> }) {
  try {
    const { venueSlug } = await params
    const asset = await prisma.asset.findUnique({
      where: { slug: venueSlug },
      include: {
        authorisations: { orderBy: [{ grantedDate: 'desc' }, { createdAt: 'desc' }] },
        measurements: { orderBy: { date: 'desc' }, take: 200 },
      },
    })
    if (!asset) {
      return new Response('Venue not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
    }

    const permits: VenueAuthItem[] = asset.authorisations
      .filter((a) => ACTIVE_PERMIT_STATUSES.has((a.status || '').toLowerCase()))
      .map((a) => ({
        permitRef: a.permitRef,
        type: a.type,
        authority: a.authority,
        status: a.status,
        grantedDate: a.grantedDate,
        expiryDate: a.expiryDate,
        conditions: a.conditions,
        sourceUrl: a.sourceUrl,
      }))

    // Latest reading per parameter — measurements are already newest-first.
    const seen = new Set<string>()
    const measurements: VenueMeasurementItem[] = []
    for (const m of asset.measurements) {
      if (seen.has(m.parameter)) continue
      seen.add(m.parameter)
      measurements.push({
        parameter: m.parameter,
        value: m.value,
        unit: m.unit,
        date: m.date,
        station: m.station,
        validated: m.validated,
      })
    }

    const base = process.env.NEXTAUTH_URL || 'https://bioveracity.com'
    const pdf = await renderVenueAudit({
      venueName: asset.name,
      venueTypeLabel: typeLabel(asset.subtype || asset.type),
      location: asset.region ? typeLabel(asset.region) : null,
      operatorName: asset.operatorName,
      regulatorName: asset.regulatorName,
      jurisdiction: asset.jurisdiction,
      statusLabel: typeLabel(asset.statusDetail || asset.status),
      permits,
      measurements,
      recordUrl: `${base}/venue/${asset.slug}`,
    })

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bioveracity-audit-${asset.slug}.pdf"`,
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    })
  } catch {
    return new Response('The audit report could not be generated.', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }
}
