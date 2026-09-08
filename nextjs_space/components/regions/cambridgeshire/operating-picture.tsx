'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { InvestigationPanel } from './investigation-panel'
import { PlaceHistoryPanel } from './place-history-panel'
import { ArrowLeft, Play, Pause, Search, Info } from 'lucide-react'
import { getEvidenceDisplay } from '@/lib/evidence-taxonomy'

// ---------------------------------------------------------------------------
// Shared types (imported by the page and by the map inner component)
// ---------------------------------------------------------------------------
export interface OPPoint {
  slug: string
  name: string
  type: string
  lat: number
  lng: number
  indicative?: boolean
  category: string // place-space: 'environment' | 'operations' | 'other'
  evidenceState: string // 'neutral' | 'divergence' | 'verified'
}

export interface OPEvent {
  id: string
  title: string
  description: string | null
  date: string // ISO
  eventType: string // 'environmental' | 'operational' | 'planning' | 'regulatory' | 'community'
  evidenceClass: string
  changeType: string // 'event' | 'material_change' | 'divergence'
  datePrecision?: string | null
  sourceUrl: string | null
  sourceDomain: string | null
  assetSlug: string
  assetName: string
  lat: number | null
  lng: number | null
}

export interface OPConnection {
  fromSlug: string
  toSlug: string
  label: string
}

// ---------------------------------------------------------------------------
// Map is client-only (Leaflet touches window)
// ---------------------------------------------------------------------------
const OperatingMapInner = dynamic(() => import('./operating-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0b1220]">
      <span className="text-xs tracking-wide text-slate-400">Preparing the regional picture…</span>
    </div>
  ),
})

// ---------------------------------------------------------------------------
// Investigation lenses (NOT BioVeracity risk ratings — see tooltip)
// emphasis is expressed in place-space ('operations' | 'environment' | null)
// ---------------------------------------------------------------------------
const CONTEXTS: {
  id: string
  label: string
  lookbackDays: number | null
  emphasis: string | null
  blurb: string
}[] = [
  { id: 'normal', label: 'All records', lookbackDays: null, emphasis: null, blurb: 'The full evidence record for the region.' },
  { id: 'watch', label: '90 days', lookbackDays: 90, emphasis: null, blurb: 'Activity across the most recent 90 days of the record.' },
  { id: 'stress', label: 'Operations', lookbackDays: 30, emphasis: 'operations', blurb: 'A tighter 30-day window, filtered to operational evidence.' },
  { id: 'incident', label: '3 days', lookbackDays: 3, emphasis: null, blurb: 'The 72 hours around the latest evidence — rewind an event.' },
  { id: 'recovery', label: '180 days', lookbackDays: 180, emphasis: null, blurb: 'The longer arc after an event, to follow what changed.' },
]

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'environmental', label: 'Environment' },
  { id: 'community', label: 'Community' },
  { id: 'operational', label: 'Operations' },
  { id: 'regulatory', label: 'Regulatory' },
  { id: 'planning', label: 'Projects' },
]

const DAY = 86_400_000

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const DATE_FMT_MONTH = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'long', timeZone: 'UTC' })
const DATE_FMT_YEAR = new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: 'UTC' })
// Precision-aware so an approximate date is never shown as day-exact.
function fmtDate(iso: string, precision?: string | null): string {
  const d = new Date(iso)
  if (precision === 'year') return DATE_FMT_YEAR.format(d)
  if (precision === 'month') return DATE_FMT_MONTH.format(d)
  return DATE_FMT.format(d)
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

// ---------------------------------------------------------------------------
// Deterministic natural-language → filter/time compiler.
// This never sends text to a model; it maps phrases to concrete operations so
// language can never become evidence.
// ---------------------------------------------------------------------------
function compileSearch(
  raw: string,
  maxTs: number,
): { lookbackDays: number | null; category: string; matched: boolean; note: string } {
  const q = raw.toLowerCase().trim()
  let lookbackDays: number | null | undefined = undefined
  let category = 'all'
  const notes: string[] = []

  // Time expressions
  if (/(everything|all evidence|all time|full timeline|entire record|full record)/.test(q)) {
    lookbackDays = null
    notes.push('full timeline')
  } else if (/(72\s*hours|previous 72|last 3 days|last three days|past 3 days|3 days)/.test(q)) {
    lookbackDays = 3
    notes.push('last 72 hours')
  } else if (/(last week|past week|last 7|past 7|7 days|seven days)/.test(q)) {
    lookbackDays = 7
    notes.push('last 7 days')
  } else if (/(last month|past month|last 30|past 30|30 days|thirty days)/.test(q)) {
    lookbackDays = 30
    notes.push('last 30 days')
  } else if (/(last quarter|past quarter|90 days|last 90|ninety days)/.test(q)) {
    lookbackDays = 90
    notes.push('last 90 days')
  } else {
    const nDays = q.match(/last (\d{1,4}) days/)
    if (nDays) {
      lookbackDays = Math.max(1, parseInt(nDays[1], 10))
      notes.push(`last ${lookbackDays} days`)
    } else {
      const sinceMonth = q.match(/since (\w+)/)
      if (sinceMonth) {
        const mi = MONTHS.indexOf(sinceMonth[1])
        if (mi >= 0) {
          // Anchor to the most recent occurrence of that month at/or before maxTs.
          const maxD = new Date(maxTs)
          let year = maxD.getUTCFullYear()
          let anchor = Date.UTC(year, mi, 1)
          if (anchor > maxTs) anchor = Date.UTC(year - 1, mi, 1)
          lookbackDays = Math.max(1, Math.round((maxTs - anchor) / DAY))
          notes.push(`since ${MONTHS[mi]}`)
        }
      }
    }
  }

  // Category expressions
  if (/(environment|river|water body|watercourse|ecolog)/.test(q)) category = 'environmental'
  else if (/(community|resident|odour|smell|complaint|allegation)/.test(q)) category = 'community'
  else if (/(operation|discharge|treatment|works|wrc|wastewater|sewage)/.test(q)) category = 'operational'
  else if (/(regulat|classification|permit|enforcement)/.test(q)) category = 'regulatory'
  else if (/(project|planning|relocation|development|scheme|capital)/.test(q)) category = 'planning'
  if (category !== 'all') notes.push(CATEGORIES.find((c) => c.id === category)?.label.toLowerCase() ?? '')

  const matched = lookbackDays !== undefined || category !== 'all'
  return {
    lookbackDays: lookbackDays === undefined ? null : lookbackDays,
    category,
    matched,
    note: notes.filter(Boolean).join(' · '),
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function RegionalOperatingPicture({
  regionName,
  places,
  chronology,
  connections,
  backHref,
  relationshipNote,
  accessNote,
  institutionalHref,
}: {
  regionName: string
  places: OPPoint[]
  chronology: OPEvent[]
  connections: OPConnection[]
  backHref: string
  // Optional, additive. When omitted the component behaves exactly as before.
  relationshipNote?: string
  accessNote?: string
  institutionalHref?: string
}) {
  // Deterministic timeline bounds from the real record (SSR-safe: from props).
  const { minTs, maxTs } = useMemo(() => {
    const ts = chronology.map((e) => Date.parse(e.date)).filter((n) => !Number.isNaN(n))
    if (!ts.length) {
      // Stable fallback window; page still renders if the record is empty.
      return { minTs: Date.UTC(2025, 0, 1), maxTs: Date.UTC(2025, 11, 31) }
    }
    return { minTs: Math.min(...ts), maxTs: Math.max(...ts) }
  }, [chronology])

  const [contextId, setContextId] = useState('normal')
  const [category, setCategory] = useState('all')
  const isCambridge = backHref === '/regions/cambridgeshire-peterborough'
  const [selectedSlug, setSelectedSlug] = useState<string | null>(isCambridge && places.some(p => p.slug === 'river-cam') ? 'river-cam' : null)
  const [cursorTs, setCursorTs] = useState<number>(maxTs)
  const [lookbackDays, setLookbackDays] = useState<number | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchNote, setSearchNote] = useState('')
  const [playing, setPlaying] = useState(false)
  const [historyAnchorId, setHistoryAnchorId] = useState<string | null>(null)

  const context = CONTEXTS.find((c) => c.id === contextId) ?? CONTEXTS[0]
  const emphasisCategory = context.emphasis

  // Applying a context sets the time lens and resets the cursor to "now" (the
  // most recent evidence), never to a real-world clock the record can't support.
  const applyContext = useCallback(
    (id: string) => {
      const c = CONTEXTS.find((x) => x.id === id) ?? CONTEXTS[0]
      setContextId(id)
      setLookbackDays(c.lookbackDays)
      setCursorTs(maxTs)
      setPlaying(false)
    },
    [maxTs],
  )

  // Window predicate — events at or before the cursor, within the lookback.
  const inWindow = useCallback(
    (e: OPEvent) => {
      const t = Date.parse(e.date)
      if (Number.isNaN(t)) return false
      if (t > cursorTs) return false
      if (lookbackDays != null && t < cursorTs - lookbackDays * DAY) return false
      return true
    },
    [cursorTs, lookbackDays],
  )

  // Events inside the current time window (drives the pulsing rings on the map).
  const windowEvents = useMemo(() => chronology.filter(inWindow), [chronology, inWindow])

  // Chronology rail = window + category chip, newest first.
  const railEvents = useMemo(() => {
    const list = windowEvents.filter((e) => (category === 'all' || e.eventType === category) && (!selectedSlug || e.assetSlug === selectedSlug))
    return [...list].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  }, [windowEvents, category, selectedSlug])

  // Places to pulse: those with at least one event in the rail set (map ↔ rail in sync).
  const activeSlugs = useMemo(() => new Set(railEvents.map((e) => e.assetSlug)), [railEvents])

  // Selecting a place (from map or a card) moves the cursor to that place's most
  // recent in-record event, so the timeline follows the selection.
  const selectPlace = useCallback(
    (slug: string) => {
      setSelectedSlug((prev) => (prev === slug ? null : slug))
    },
    [],
  )

  const selectEvent = useCallback((e: OPEvent) => {
    setSelectedSlug(e.assetSlug)
    setHistoryAnchorId(e.id)
    const t = Date.parse(e.date)
    if (!Number.isNaN(t)) setCursorTs(t)
    setPlaying(false)
  }, [])

  // Search submit → deterministic compile → apply time + category.
  const runSearch = useCallback(
    (text: string) => {
      const { lookbackDays: lb, category: cat, matched, note } = compileSearch(text, maxTs)
      setLookbackDays(lb)
      setCategory(cat)
      setCursorTs(maxTs)
      setContextId('normal')
      setPlaying(false)
      setSearchNote(matched ? `Showing ${note}` : 'No time or topic recognised — showing the full record')
      if (!matched) setLookbackDays(null)
    },
    [maxTs],
  )

  // Replay animation (client-only; no clock reaches SSR markup).
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const from = minTs
    const to = maxTs
    const dur = 9000
    const start = performance.now()
    // Begin from the start of the record for a clean sweep.
    setCursorTs(from)
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      setCursorTs(from + (to - from) * t)
      if (t < 1) {
        raf = requestAnimationFrame(step)
      } else {
        setPlaying(false)
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, minTs, maxTs])

  const cursorPct = maxTs > minTs ? ((cursorTs - minTs) / (maxTs - minTs)) * 100 : 100

  // ---- Replay track interaction ------------------------------------------
  const trackRef = useRef<HTMLDivElement | null>(null)
  const setCursorFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      setCursorTs(minTs + (maxTs - minTs) * ratio)
    },
    [minTs, maxTs],
  )
  const draggingRef = useRef(false)
  const onTrackPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true
    setPlaying(false)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setCursorFromClientX(e.clientX)
  }
  const onTrackPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    setCursorFromClientX(e.clientX)
  }
  const onTrackPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  const changeColor = (ct: string) =>
    ct === 'divergence' ? '#f87171' : ct === 'material_change' ? '#E9AD20' : '#7dd3fc'

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0b1220] text-slate-100">
      {/* ----------------------------------------------------------------- Header */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/10 bg-[#0b1220]/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Reference view
          </Link>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-[0.18em] text-slate-100">BIOVERACITY</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
              Places and evidence
            </div>
          </div>
        </div>

        {/* Investigation lenses */}
        <div className="flex items-center gap-2">
          <div
            className="group relative flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5"
            title="Investigation context — not a BioVeracity risk rating"
          >
            {CONTEXTS.map((c) => (
              <button
                key={c.id}
                onClick={() => applyContext(c.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition ${
                  c.id === contextId
                    ? 'bg-[#E9AD20] text-[#0b1220]'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <span className="hidden items-center gap-1 text-[10px] text-slate-500 lg:flex">
            <Info className="h-3 w-3" />
            Investigation lens — not a risk rating
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden max-w-[280px] text-right text-[11px] leading-tight text-slate-400 md:block">
            {context.blurb}
          </span>
          <span className="rounded-full border border-[#E9AD20]/40 bg-[#E9AD20]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#E9AD20]">
            Concept · Illustrative presentation
          </span>
        </div>
      </header>

      {/* ----------------------------------------------------------------- Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        {/* Map */}
        <div className="relative min-h-[320px] min-w-0 shrink-0 md:min-h-0 md:flex-1">
          <OperatingMapInner
            points={places}
            connections={connections}
            activeSlugs={activeSlugs}
            selectedSlug={selectedSlug}
            onSelect={selectPlace}
            emphasisCategory={emphasisCategory}
          />

          {/* Search overlay */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] flex justify-center p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                runSearch(searchText)
              }}
              className="pointer-events-auto w-full max-w-xl"
            >
              <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-[#0b1220]/90 px-3 py-2 shadow-lg backdrop-blur">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder='Filter timeline — e.g. "community reports in the last 90 days"'
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-md bg-[#E9AD20] px-2.5 py-1 text-[11px] font-semibold text-[#0b1220] transition hover:brightness-110"
                >
                  Apply
                </button>
              </div>
              <div className="mt-1 flex justify-between gap-3 px-1 text-[11px] text-slate-300">
                <span>Topic and time filters · windows end at the latest stored record</span>
                <Link className="shrink-0 underline" href={`/evidence?q=${encodeURIComponent(selectedSlug ? places.find(p => p.slug === selectedSlug)?.name ?? searchText : searchText || 'River Cam')}`}>Search reviewed sources</Link>
              </div>
              {searchNote && (
                <div className="mt-1 px-1 text-[11px] text-slate-400">{searchNote}</div>
              )}
            </form>
          </div>

          {/* Legend / honesty note */}
          <div className="absolute bottom-3 left-3 z-[600] max-w-[260px] rounded-lg border border-white/10 bg-[#0b1220]/85 p-3 text-[10px] leading-relaxed text-slate-400 backdrop-blur">
            <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#f87171' }} />
                Divergence
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#4ade80' }} />
                Reviewed record
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#cbd5e1' }} />
                On record
              </span>
            </div>
            Places pulse when they hold evidence inside the current time window.{' '}
            {relationshipNote ??
              'Lines are shown only where the public record states a direct discharge relationship.'}
          </div>
        </div>

        {/* Chronology rail */}
        <aside className="flex w-full shrink-0 flex-col md:w-[42%] md:min-w-[290px] md:max-w-[440px] md:overflow-y-auto border-l border-white/10 bg-[#0a0f1a]">
          <PlaceHistoryPanel records={chronology} slug={selectedSlug}
            placeName={places.find(p => p.slug === selectedSlug)?.name ?? regionName}
            anchorId={historyAnchorId} onAnchor={selectEvent} />
          {isCambridge && <InvestigationPanel records={chronology} selectedSlug={selectedSlug}
            placeName={places.find(p => p.slug === selectedSlug)?.name ?? 'Cambridge & Peterborough'}
            onChoose={cat => { setCategory(cat); setLookbackDays(null); setCursorTs(maxTs); setPlaying(false); setContextId('normal') }}
            onReset={() => { setSelectedSlug(null); setCategory('all'); setLookbackDays(null); setCursorTs(maxTs); setPlaying(false); setContextId('normal') }} />}
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
              Evidence chronology
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {railEvents.length} {railEvents.length === 1 ? 'record' : 'records'} in the current window
            </div>
            {accessNote && (
              <div className="mt-2 rounded-md border border-[#E9AD20]/30 bg-[#E9AD20]/[0.06] px-2.5 py-1.5 text-[10px] leading-relaxed text-[#E9AD20]">
                {accessNote}
                {institutionalHref && (
                  <>
                    {' '}
                    <Link href={institutionalHref} className="underline underline-offset-2 hover:text-white">
                      Request institutional access
                    </Link>
                  </>
                )}
              </div>
            )}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
                    c.id === category
                      ? 'bg-[#E9AD20] text-[#0b1220]'
                      : 'border border-white/10 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {railEvents.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12px] text-slate-500">
                No loaded records match this place, topic and period. This does not establish that no event occurred.
                <button className="mt-3 block w-full text-amber-200 underline" onClick={() => { setCategory('all'); setLookbackDays(null); setCursorTs(maxTs); setSelectedSlug(null) }}>View all available records</button>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {railEvents.map((e) => {
                  const ev = getEvidenceDisplay(e.evidenceClass)
                  const isSel = selectedSlug === e.assetSlug
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => selectEvent(e)}
                        className={`block w-full px-4 py-3 text-left transition hover:bg-white/[0.03] ${
                          isSel ? 'bg-[#E9AD20]/[0.06] ring-1 ring-inset ring-[#E9AD20]/40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] uppercase tracking-wide text-slate-500">
                            {fmtDate(e.date, e.datePrecision)}
                          </span>
                          <span
                            className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400"
                            title={ev.description}
                          >
                            <span aria-hidden>{ev.symbol}</span>
                            {ev.label}
                          </span>
                        </div>
                        <div className="mt-1 text-[13px] font-medium leading-snug text-slate-100">
                          {e.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                          <span className="text-slate-300">{e.assetName}</span>
                          {e.sourceDomain && (
                            <>
                              <span className="text-slate-600">·</span>
                              {e.sourceUrl ? (
                                <a
                                  href={e.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(ev2) => ev2.stopPropagation()}
                                  className="underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
                                >
                                  {e.sourceDomain}
                                </a>
                              ) : (
                                <span>{e.sourceDomain}</span>
                              )}
                            </>
                          )}
                          {e.changeType === 'divergence' && (
                            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-300">
                              Divergence
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-2.5 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Evidence retains its source
            </div>
            <div className="mt-0.5 text-[10px] text-slate-600">Time · Location · Provenance</div>
          </div>
        </aside>
      </div>

      {/* ----------------------------------------------------------------- Replay */}
      <footer className="border-t border-white/10 bg-[#0a0f1a] px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#E9AD20] px-3 py-1.5 text-[11px] font-semibold text-[#0b1220] transition hover:brightness-110"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? 'Pause' : 'Replay'}
          </button>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
              <span>{fmtDate(new Date(minTs).toISOString())}</span>
              <span className="text-slate-300">
                Cursor · {fmtDate(new Date(cursorTs).toISOString())}
              </span>
              <span>{fmtDate(new Date(maxTs).toISOString())}</span>
            </div>

            {/* Track */}
            <div
              ref={trackRef}
              onPointerDown={onTrackPointerDown}
              onPointerMove={onTrackPointerMove}
              onPointerUp={onTrackPointerUp}
              className="relative h-8 cursor-pointer select-none rounded-md border border-white/10 bg-white/[0.03]"
            >
              {/* Filled region up to cursor */}
              <div
                className="pointer-events-none absolute inset-y-0 left-0 rounded-l-md bg-[#E9AD20]/10"
                style={{ width: `${cursorPct}%` }}
              />
              {/* Event ticks */}
              {chronology.map((e) => {
                const t = Date.parse(e.date)
                if (Number.isNaN(t)) return null
                const pct = maxTs > minTs ? ((t - minTs) / (maxTs - minTs)) * 100 : 50
                const on = inWindow(e)
                return (
                  <span
                    key={e.id}
                    title={`${fmtDate(e.date, e.datePrecision)} — ${e.title}`}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      selectEvent(e)
                    }}
                    className="absolute top-1/2 z-10 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${pct}%`,
                      background: changeColor(e.changeType),
                      opacity: on ? 1 : 0.35,
                    }}
                  />
                )
              })}
              {/* Cursor handle */}
              <div
                className="pointer-events-none absolute top-1/2 z-20 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E9AD20] shadow"
                style={{ left: `${cursorPct}%` }}
              />
            </div>
          </div>

          <div className="hidden shrink-0 text-right text-[10px] leading-tight text-slate-500 sm:block">
            <div className="font-semibold uppercase tracking-[0.15em] text-slate-400">Replay</div>
            <div>Map and chronology move together</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
