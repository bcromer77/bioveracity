// Public venue audit ledger, designed to be reached from a QR plaque at the
// venue. Mobile-first, no authentication. It shows ONLY real stored data:
// active statutory permits and the latest sensor compliance readings, each with
// an honest empty state. Nothing is inferred or fabricated.

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SafeDate } from '@/components/safe-format'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

const ACTIVE_PERMIT_STATUSES = new Set(['active'])

function label(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function generateMetadata({ params }: { params: Promise<{ venueSlug: string }> }): Promise<Metadata> {
  const { venueSlug } = await params
  const asset = await prisma.asset.findUnique({ where: { slug: venueSlug }, select: { name: true } })
  return {
    title: asset ? `${asset.name} — BioVeracity Audit Ledger` : 'Venue audit ledger — BioVeracity',
    description: 'Verified statutory permits and the latest sensor compliance readings for this venue.',
  }
}

export default async function VenuePage({ params }: { params: Promise<{ venueSlug: string }> }) {
  const { venueSlug } = await params
  const asset = await prisma.asset.findUnique({
    where: { slug: venueSlug },
    include: {
      authorisations: { orderBy: [{ grantedDate: 'desc' }, { createdAt: 'desc' }] },
      measurements: { orderBy: { date: 'desc' }, take: 200 },
    },
  })

  if (!asset) notFound()

  const permits = asset.authorisations.filter((a) => ACTIVE_PERMIT_STATUSES.has((a.status || '').toLowerCase()))

  // Latest reading per parameter — measurements are already newest-first.
  const seen = new Set<string>()
  const latestByParameter = asset.measurements.filter((m) => {
    if (seen.has(m.parameter)) return false
    seen.add(m.parameter)
    return true
  })

  const locationLabel = asset.region ? label(asset.region) : null
  const typeLabel = label(asset.subtype || asset.type)
  const statusLabel = label(asset.statusDetail || asset.status)

  return (
    <main className="bv-venue">
      <div className="bv-venue-shell">
        <header className="bv-venue-head">
          <Link href="/" className="bv-venue-brand">BioVeracity</Link>
          <span className="bv-venue-kicker">Official Audit Ledger</span>
          <h1>{asset.name}</h1>
          <p className="bv-venue-sub">
            {typeLabel}{locationLabel ? ` · ${locationLabel}` : ''}
          </p>
          <div className="bv-venue-meta">
            <span className="bv-venue-status">{statusLabel}</span>
            {asset.operatorName ? <span>Operator: {asset.operatorName}</span> : null}
            {asset.regulatorName ? <span>Regulator: {asset.regulatorName}</span> : null}
            {asset.jurisdiction ? <span>{asset.jurisdiction}</span> : null}
          </div>
        </header>

        <a className="bv-venue-download" href={`/api/venue/${asset.slug}/audit`}>
          Official BioVeracity Audit Report (PDF)
        </a>

        <section className="bv-venue-section">
          <h2>Active statutory permits</h2>
          {permits.length === 0 ? (
            <p className="bv-venue-empty">No active statutory permits are recorded for this venue in BioVeracity.</p>
          ) : (
            <ul className="bv-venue-list">
              {permits.map((p) => (
                <li key={p.id} className="bv-venue-card">
                  <div className="bv-venue-card-head">
                    <span className="bv-venue-card-title">{label(p.type)}</span>
                    <span className="bv-venue-badge bv-venue-badge-active">Active</span>
                  </div>
                  {p.permitRef ? <p className="bv-venue-ref">Reference: {p.permitRef}</p> : null}
                  {p.authority ? <p className="bv-venue-line">Authority: {p.authority}</p> : null}
                  <p className="bv-venue-line">
                    Granted: {p.grantedDate ? <SafeDate date={p.grantedDate} options={{ dateStyle: 'medium' }} /> : 'not stated'}
                    {' · '}
                    Expires: {p.expiryDate ? <SafeDate date={p.expiryDate} options={{ dateStyle: 'medium' }} /> : 'not stated'}
                  </p>
                  {p.conditions ? <p className="bv-venue-cond">{p.conditions}</p> : null}
                  {p.sourceUrl ? (
                    <a className="bv-venue-src" href={p.sourceUrl} target="_blank" rel="noopener noreferrer">View source record</a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bv-venue-section">
          <h2>Latest sensor compliance</h2>
          {latestByParameter.length === 0 ? (
            <p className="bv-venue-empty">No sensor measurements are recorded for this venue in BioVeracity.</p>
          ) : (
            <ul className="bv-venue-readings">
              {latestByParameter.map((m) => (
                <li key={m.id} className="bv-venue-reading">
                  <div className="bv-venue-reading-top">
                    <span className="bv-venue-param">{label(m.parameter)}</span>
                    <span className={`bv-venue-badge ${m.validated ? 'bv-venue-badge-validated' : 'bv-venue-badge-pending'}`}>
                      {m.validated ? 'Validated' : 'Awaiting validation'}
                    </span>
                  </div>
                  <p className="bv-venue-value">
                    {m.value != null && Number.isFinite(m.value) ? `${m.value}${m.unit ? ` ${m.unit}` : ''}` : 'No value recorded'}
                  </p>
                  <p className="bv-venue-line">
                    Recorded: <SafeDate date={m.date} options={{ dateStyle: 'medium' }} />
                    {m.station ? ` · Station: ${m.station}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="bv-venue-foot">
          <p>
            This ledger shows the current verified record held by BioVeracity for this venue. A permit or reading only
            appears here when it is present in the source-linked record — nothing is inferred.
          </p>
          <Link href={`/asset/${asset.slug}`} className="bv-venue-full">Open the full BioVeracity record</Link>
        </footer>
      </div>
    </main>
  )
}
