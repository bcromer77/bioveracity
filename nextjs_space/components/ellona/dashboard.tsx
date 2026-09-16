'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { EllonaMap } from './ellona-map'
import type { MapPoint } from './ellona-map-inner'
import type { OpportunityDTO } from './types'
import {
  CLOSED_STATUSES as CLOSED,
  filterOpportunities,
  buildScopeLabel,
  buildPortfolioPdfQuery,
  type EllonaFilters,
  type FilterableOpportunity,
} from '@/lib/ellona/filter-opportunities'

function OppCard({ o }: { o: OpportunityDTO }) {
  return (
    <article className="bv-opp-card">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className="bv-tag bv-tag-status">{o.status}</span>
        <span className="bv-tag bv-tag-class">{o.classification}</span>
        {o.following ? <span className="bv-tag bv-tag-cat">Following</span> : null}
        {o.isSeed ? <span className="bv-tag bv-tag-cat">Trial seed — previously published</span> : null}
        {o.accessLimited ? <span className="bv-tag bv-tag-warn">Source access limited</span> : null}
      </div>
      <h3>
        <Link href={`/ellona/opportunity/${o.id}`}>{o.title}</Link>
      </h3>
      <div className="bv-opp-meta">
        {o.buyer}
        <br />
        {[o.region, o.country].filter(Boolean).join(', ')}
      </div>
      {o.measurementNeed ? <p className="bv-opp-need">{o.measurementNeed}</p> : null}
      <div className="bv-opp-foot">
        <span className="bv-opp-meta">
          {o.tenderDeadline ? `Submission: ${o.tenderDeadline}` : o.clarificationDeadline ? `Clarification: ${o.clarificationDeadline}` : 'No dated deadline'}
        </span>
        <Link href={`/ellona/opportunity/${o.id}`} style={{ fontWeight: 700, fontSize: 13 }}>
          Open record →
        </Link>
      </div>
    </article>
  )
}

function Section({ title, items }: { title: string; items: OpportunityDTO[] }) {
  if (items.length === 0) return null
  return (
    <>
      <h2>
        {title} <span style={{ fontSize: 15, color: '#7d7148' }}>({items.length})</span>
      </h2>
      <div className="bv-ellona-grid">
        {items.map((o) => (
          <OppCard key={o.id} o={o} />
        ))}
      </div>
    </>
  )
}

// Adapt the client DTO onto the shared filter shape so the dashboard and the
// PDF route filter with identical semantics.
function toFilterable(o: OpportunityDTO): FilterableOpportunity {
  return {
    id: o.id,
    status: o.status,
    classification: o.classification,
    buyer: o.buyer,
    title: o.title,
    country: o.country,
    region: o.region,
    themes: o.themes,
    capabilities: o.capabilities,
    measurementNeed: o.measurementNeed,
    nextAction: o.nextAction,
    supportedClaim: null,
    deadlineEpoch: o.deadlineSort,
    following: o.following,
  }
}

export function EllonaDashboard({ opportunities }: { opportunities: OpportunityDTO[] }) {
  const [q, setQ] = useState('')
  const [country, setCountry] = useState('')
  const [classification, setClassification] = useState('')
  const [theme, setTheme] = useState('')
  const [capability, setCapability] = useState('')
  const [status, setStatus] = useState('')
  const [deadlineWindow, setDeadlineWindow] = useState('')
  const [followedOnly, setFollowedOnly] = useState(false)

  const countries = useMemo(() => Array.from(new Set(opportunities.map((o) => o.country))).sort(), [opportunities])
  const classes = useMemo(() => Array.from(new Set(opportunities.map((o) => o.classification))).sort(), [opportunities])
  const themes = useMemo(() => Array.from(new Set(opportunities.flatMap((o) => o.themes))).sort(), [opportunities])
  const capabilities = useMemo(
    () => Array.from(new Set(opportunities.flatMap((o) => o.capabilities))).sort(),
    [opportunities],
  )

  const now = Date.now()
  const filters: EllonaFilters = { q, country, classification, theme, capability, status, deadlineWindow, followedOnly }
  const filtered = useMemo(
    () => filterOpportunities(opportunities, toFilterable, filters, now),
    [opportunities, q, country, classification, theme, capability, status, followedOnly, deadlineWindow, now],
  )

  // Build the portfolio PDF URL from the exact current filter state so the
  // generated document matches what is on screen. The scope label mirrors the
  // heading the PDF will carry.
  const portfolioPdfUrl = useMemo(
    () => buildPortfolioPdfQuery(filters),
    [q, country, classification, theme, capability, status, deadlineWindow, followedOnly],
  )
  const scopeLabel = useMemo(
    () => buildScopeLabel(filters),
    [q, country, classification, theme, capability, status, deadlineWindow, followedOnly],
  )

  const points: MapPoint[] = filtered
    .filter((o) => o.latitude != null && o.longitude != null)
    .map((o) => ({
      id: o.id,
      lat: o.latitude as number,
      lng: o.longitude as number,
      title: o.title,
      classification: o.classification,
      buyer: o.buyer,
      location: [o.region, o.country].filter(Boolean).join(', '),
      precision: o.precision || 'regional',
      deadline: o.tenderDeadline || o.clarificationDeadline,
      nextAction: o.nextAction || '',
    }))

  const corrections = filtered.filter((o) => o.hasCorrection || o.classification === 'CORRECTION OR DEADLINE CHANGE')
  const correctionIds = new Set(corrections.map((o) => o.id))
  const following = filtered.filter((o) => o.following && !correctionIds.has(o.id))
  const followingIds = new Set(following.map((o) => o.id))
  const seedRecords = filtered.filter((o) => o.isSeed && !correctionIds.has(o.id) && !followingIds.has(o.id))
  const seedIds = new Set(seedRecords.map((o) => o.id))
  const closed = filtered.filter((o) => CLOSED.has(o.status) && !correctionIds.has(o.id) && !followingIds.has(o.id) && !seedIds.has(o.id))
  const closedIds = new Set(closed.map((o) => o.id))
  const newlyRouted = filtered.filter((o) =>
    o.newSinceLastPortfolio &&
    !correctionIds.has(o.id) && !followingIds.has(o.id) && !seedIds.has(o.id) && !closedIds.has(o.id),
  )
  const allocated = new Set([...correctionIds, ...followingIds, ...seedIds, ...closedIds, ...newlyRouted.map((o) => o.id)])
  const unchangedOpen = filtered.filter((o) => !allocated.has(o.id) && !CLOSED.has(o.status))
  const accessGaps = filtered.filter((o) => o.accessLimited)

  return (
    <>
      <div className="bv-ellona-filters">
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="f-q">Search title, buyer, need, region or action</label>
          <input id="f-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. air emissions, EPA, catchment, wastewater" />
        </div>
        <div>
          <label htmlFor="f-country">Country</label>
          <select id="f-country" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-class">Classification</label>
          <select id="f-class" value={classification} onChange={(e) => setClassification(e.target.value)}>
            <option value="">All</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-theme">Environmental theme</label>
          <select id="f-theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="">All</option>
            {themes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-cap">Measurement capability</label>
          <select id="f-cap" value={capability} onChange={(e) => setCapability(e.target.value)}>
            <option value="">All</option>
            {capabilities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-status">Status</label>
          <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-deadline">Deadline window</label>
          <select id="f-deadline" value={deadlineWindow} onChange={(e) => setDeadlineWindow(e.target.value)}>
            <option value="">Any</option>
            <option value="14">Next 14 days</option>
            <option value="30">Next 30 days</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
            <input
              type="checkbox"
              checked={followedOnly}
              onChange={(e) => setFollowedOnly(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            Followed by Natalia
          </label>
        </div>
      </div>

      <h2>Opportunities across the United Kingdom and Ireland</h2>
      <EllonaMap points={points} matchingCount={filtered.length} />
      <div className="bv-ellona-legend">
        <span>
          <i style={{ background: '#1d6fb8' }} /> Exact coordinate (pin)
        </span>
        <span>
          <i style={{ background: '#e0a53a' }} /> Approximate / area / regional (indicative circle)
        </span>
        <span>National-scope opportunities are not pinned; open the record for scope.</span>
      </div>

      <p className="bv-ellona-count" style={{ marginTop: 20 }}>
        Showing {filtered.length} of {opportunities.length} opportunities.
      </p>

      <div
        className="bv-ellona-portfolio-action"
        style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '4px 0 8px' }}
      >
        <a className="bv-button bv-green" href={portfolioPdfUrl}>
          Generate opportunity portfolio (PDF)
        </a>
        <span className="bv-opp-meta" aria-live="polite">
          {scopeLabel}
        </span>
      </div>

      <Section title="Corrections and changes" items={corrections} />
      <Section title="Newly routed opportunities" items={newlyRouted} />
      <Section title="Open and unchanged" items={unchangedOpen} />
      <Section title="Following" items={following} />
      <Section title="Closed or superseded" items={closed} />
      <Section title="Trial seed records — previously published" items={seedRecords} />
      <Section title="Source-access gaps requiring review" items={accessGaps} />

      {filtered.length === 0 ? <p className="bv-ellona-count">No opportunities match the current filters.</p> : null}
    </>
  )
}
