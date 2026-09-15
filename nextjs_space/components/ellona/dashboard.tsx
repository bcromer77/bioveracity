'use client'

import { useMemo, useState } from 'react'
import { EllonaMap } from './ellona-map'
import type { MapPoint } from './ellona-map-inner'
import type { OpportunityDTO } from './types'

function OppCard({ o }: { o: OpportunityDTO }) {
  return (
    <article className="bv-opp-card">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className="bv-tag bv-tag-status">{o.status}</span>
        <span className="bv-tag bv-tag-class">{o.classification}</span>
        {o.following ? <span className="bv-tag bv-tag-cat">Following</span> : null}
      </div>
      <h3>
        <a href={`/ellona/opportunity/${o.id}`}>{o.title}</a>
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
        <a href={`/ellona/opportunity/${o.id}`} style={{ fontWeight: 700, fontSize: 13 }}>
          Open record →
        </a>
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

const CLOSED = new Set(['CLOSED', 'NOT RELEVANT', 'SUPERSEDED'])

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
  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      if (q) {
        const hay = `${o.title} ${o.buyer} ${o.measurementNeed || ''}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      if (country && o.country !== country) return false
      if (classification && o.classification !== classification) return false
      if (theme && !o.themes.includes(theme)) return false
      if (capability && !o.capabilities.includes(capability)) return false
      if (status === 'open' && CLOSED.has(o.status)) return false
      if (status === 'closed' && !CLOSED.has(o.status)) return false
      if (followedOnly && !o.following) return false
      if (deadlineWindow) {
        if (o.deadlineSort == null) return false
        const days = (o.deadlineSort - now) / (24 * 60 * 60 * 1000)
        if (deadlineWindow === '14' && (days < 0 || days > 14)) return false
        if (deadlineWindow === '30' && (days < 0 || days > 30)) return false
      }
      return true
    })
  }, [opportunities, q, country, classification, theme, capability, status, followedOnly, deadlineWindow, now])

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

  const actionRequired = filtered.filter((o) => o.status === 'ACTION REQUIRED')
  const newQualified = filtered.filter((o) => o.status === 'NEW' || o.status === 'QUALIFIED' || o.status === 'UNDER REVIEW')
  const following = filtered.filter((o) => o.following && !CLOSED.has(o.status))
  const earlySignals = filtered.filter(
    (o) =>
      o.classification === 'EARLY SIGNAL — REQUIRES QUALIFICATION' || o.classification === 'PRE-MARKET ENGAGEMENT',
  )
  const corrections = filtered.filter((o) => o.hasCorrection || o.classification === 'CORRECTION OR DEADLINE CHANGE')
  const closed = filtered.filter((o) => CLOSED.has(o.status))

  return (
    <>
      <div className="bv-ellona-filters">
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="f-q">Search buyer, title or measurement need</label>
          <input id="f-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. air emissions, EPA, catchment" />
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
      <EllonaMap points={points} />
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

      <Section title="Action required" items={actionRequired} />
      <Section title="New and qualified opportunities" items={newQualified} />
      <Section title="Following" items={following} />
      <Section title="Early signals" items={earlySignals} />
      <Section title="Corrections and changes" items={corrections} />
      <Section title="Recently closed" items={closed} />

      {filtered.length === 0 ? <p className="bv-ellona-count">No opportunities match the current filters.</p> : null}
    </>
  )
}
