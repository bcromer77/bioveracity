'use client'

import { DragEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { caseListPath, casePayload, displayDate, templates, workspaceRequest } from './workspace-client.mjs'
import { getPersona } from './personas.mjs'
import { geocode, dataFeedsForCounty } from './geocode.mjs'
import { searchGazetteer } from './ireland-gazetteer.mjs'
import { expandQuery, rankResults } from './retrieval.mjs'
import { InvestigationMap, type MapLayers, type MapPoint } from './investigation-map'
import { pairPlanningNearBats, countImprecise, haversineMeters } from './proximity.mjs'
import type { MapLayerResult } from '@/lib/ingest/connectors-ireland'
import { CaseEvidence } from './case-evidence'

// Metre-scale proximity buffer drawn on the map (a search buffer, not a boundary).
const BUFFER_METERS = 500

type Case = { id: string; workspaceId: string; title: string; template: string; createdAt: string }
type CaseDetail = Case & { sites: { id: string; name: string; latitude: number | null; longitude: number | null }[] }
type Persona = ReturnType<typeof getPersona>
type Place = { name: string; county: string | null; lat: number; lng: number; zoom: number }
type Suggestion = { name: string; county: string; lat: number; lng: number; zoom: number; kind: string }
type Entry = { id: string; passageId: string; documentId: string; name: string; locator: string; title: string; quote: string; eventDate: string | null; precision: string; status: string; evidenceType: string; note: string; revision: number; superseded: boolean }
type Doc = { id: string; name: string; hash: string; status: string; warnings: string[]; importedAt: string; parentId: string | null; supersedesId: string | null; sourceUrl: string | null; publicationDate: string | null }
type Hit = { id: string; caseId: string; documentId: string; name: string; caseTitle: string; locator: string; text: string }
// A hit enriched by term-expansion retrieval: which query terms it matched and a score.
type RankedHit = Hit & { matchedTerms: string[]; score: number }
type Retrieval = { ranked: RankedHit[]; matchedConcepts: string[]; unmatchedConcepts: string[] }

// The gazetteer/feeds modules are authored in .mjs, so rows type-infer loosely as
// string | number. Coerce to strict shapes for the typed UI.
function toSuggestions(rows: Array<Record<string, unknown>>): Suggestion[] {
  return rows.map(r => ({ name: String(r.name), county: String(r.county), lat: Number(r.lat), lng: Number(r.lng), zoom: Number(r.zoom), kind: String(r.kind) }))
}

const field = 'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const panel = 'rounded-lg border border-border bg-card p-5 shadow-sm'
const card = 'rounded-md border border-border bg-background p-3 text-sm transition-colors'
const badge = 'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium'
const message = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.'

// Human-readable distance: metres under 1 km, otherwise kilometres to two places.
function formatMeters(m: number): string { return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(2)} km` }

// The plain-language steps of a case, shown as an at-a-glance journey banner.
const CASE_STEPS = ['Open case', 'Review the public records returned', 'Add a document or note', 'Review extracted entries', 'Build the chronology', 'Create the evidence report'] as const

// A gold rule to the left of every panel title gives the dense workspace visual rhythm.
function PanelHeading({ id, children, size = 'text-lg' }: { id?: string; children: ReactNode; size?: string }) {
  return <h2 id={id} className={`flex items-center gap-2 font-display font-semibold ${size}`}><span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-accent" />{children}</h2>
}
// Consistent, semantically-coloured status pills across documents, entries and feeds.
function statusTone(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACCEPTED': return 'bg-primary text-primary-foreground'
    case 'DRAFT': return 'bg-accent text-accent-foreground'
    case 'REJECTED': return 'bg-destructive/10 text-destructive'
    default: return 'bg-secondary text-muted-foreground'
  }
}
function feedTone(status: string): string {
  if (status === 'available') return 'bg-primary text-primary-foreground'
  if (status === 'unverified') return 'bg-accent text-accent-foreground'
  return 'bg-secondary text-muted-foreground'
}
function feedLabel(status: string): string {
  return status === 'available' ? 'available' : status === 'unverified' ? 'unverified' : 'not wired'
}
// Plain-language explanation of what a feed status means for this result, so an
// unavailable or unverified source is never mistaken for "no relevant record exists".
function feedStateNote(status: string, note: string): string {
  if (status === 'unverified') return 'This source has been identified but its queryable data connection has not been verified. No result has been imported.'
  if (status !== 'available') return 'This source could not be checked. Its coverage is not included in this result.'
  return note
}
// Colour-code the review prompts by urgency without inventing findings.
function findingAccent(kind: string): string {
  if (kind === 'Missing coverage') return 'border-l-[hsl(var(--evidence-gap))]'
  if (kind === 'Needs review' || kind === 'Not yet reviewed') return 'border-l-accent'
  if (kind === 'Amendment') return 'border-l-[hsl(var(--chart-3))]'
  return 'border-l-primary'
}

const IRELAND: Place = { name: 'Ireland', county: null, lat: 53.4, lng: -7.9, zoom: 7 }
// The prominent starting investigation. Coordinates are the Enniscorthy town
// centre from the Irish gazetteer (approximate navigation centre only).
const ENNISCORTHY: Place = { name: 'Enniscorthy', county: 'Wexford', lat: 52.5017, lng: -6.5658, zoom: 13 }
// "Near" for the review-only proximity comparison. A prompt to review, not a
// finding: distances are measured only between planning points and precisely
// located bat observations (generalised records are excluded).
const PROXIMITY_METERS = 2000

async function read(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...init.headers } })
  if (!response.ok) { let msg = 'The request could not be completed.'; try { const data = await response.json(); if (typeof data.error === 'string') msg = data.error } catch {} throw new Error(msg) }
  return response
}
function toBase64(bytes: ArrayBuffer) { let raw = ''; const values = new Uint8Array(bytes); for (let i = 0; i < values.length; i += 8192) raw += String.fromCharCode(...values.subarray(i, i + 8192)); return btoa(raw) }

function sortByEventDate(a: Entry, b: Entry) {
  if (!a.eventDate && !b.eventDate) return 0
  if (!a.eventDate) return 1
  if (!b.eventDate) return -1
  return a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0
}

function Failure({ text, signIn = false }: { text: string; signIn?: boolean }) {
  return <div role="alert" className="rounded-md border border-destructive p-3 text-sm"><p>{text}</p>{signIn && <Link className="mt-2 inline-block underline" href="/login?callbackUrl=/workspace">Sign in again</Link>}</div>
}

export function WorkspaceCanvas({ workspaceId, initialPersona }: { workspaceId: string; initialPersona?: string | null }) {
  const { data: session, status } = useSession()
  const params = useSearchParams()
  // The saved workspace type wins. The ?persona= URL param is only a fallback for
  // records with no reliable stored preset (kept so older shared links still open).
  const personaKey = initialPersona && initialPersona !== 'custom' ? initialPersona : (params.get('persona') || initialPersona || 'custom')
  const persona = getPersona(personaKey)
  if (status === 'loading') return <p role="status">Loading your workspace…</p>
  if (status !== 'authenticated' || !session?.user?.id) return <Failure text="Sign in to open your private workspace." signIn />
  return <CanvasBody key={session.user.id} workspaceId={workspaceId} persona={persona} />
}

function CanvasBody({ workspaceId, persona }: { workspaceId: string; persona: Persona }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  // The open case is persisted in the URL (?case=...) so a reload restores it.
  const [selected, setSelected] = useState(() => params.get('case') || '')
  const [selectedTitle, setSelectedTitle] = useState('')

  const setSelectedId = useCallback((id: string) => {
    setSelected(id)
    const sp = new URLSearchParams(Array.from(params.entries()))
    if (id) sp.set('case', id); else sp.delete('case')
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [params, pathname, router])
  const selectCase = useCallback((id: string, title: string) => { setSelectedTitle(title); setSelectedId(id) }, [setSelectedId])

  return <div className="space-y-6">
    <header className="space-y-3">
      <p className="text-sm"><Link href="/workspace" className="underline">← All workspaces</Link></p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">{selectedTitle || persona.title}</h1>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-secondary px-3 py-1 text-xs font-medium">🔒 Private workspace</span>
      </div>
      <p className="text-sm text-muted-foreground">Workspace type: <span className="font-medium text-foreground">{persona.key === 'custom' ? 'Custom workspace' : persona.title}</span>{selectedTitle ? <> · Current case: <span className="font-medium text-foreground">{selectedTitle}</span></> : ''}</p>
      <div className="rounded-md bg-secondary p-3 text-sm">This is a private evidence workspace — it organises the sources you upload and shows what still needs review. It does not determine compliance, calculate CBAM liability or promise grant eligibility. Everything below is driven by the sources in the case you select; nothing is pre-filled with sample findings.</div>
    </header>

    <CaseBoard key={workspaceId} workspaceId={workspaceId} defaultTemplate={persona.template} selected={selected} onSelect={selectCase} onResolved={(_id, title) => setSelectedTitle(title)} />

    {selected
      ? <Investigation key={selected} workspaceId={workspaceId} caseId={selected} persona={persona} onSelectCase={setSelectedId} reportTitle={persona.exportTitle} />
      : <section className={panel} aria-label="Getting started">
          <h2 className="font-display text-lg font-semibold">Select or create a case to open the investigation</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose a case above (or create one) to load its real evidence, search its source passages, cross-check claims across your own uploads, and build a reviewed audit pack. This workspace never shows sample findings as if they were your analysis.</p>
        </section>}
  </div>
}

function CaseBoard({ workspaceId, defaultTemplate, selected, onSelect, onResolved }: { workspaceId: string; defaultTemplate: string; selected: string; onSelect: (id: string, title: string) => void; onResolved?: (id: string, title: string) => void }) {
  const [cases, setCases] = useState<Case[]>([])
  const [title, setTitle] = useState('')
  const [template, setTemplate] = useState(defaultTemplate)
  const [sites, setSites] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setCases([]); setError('')
    workspaceRequest(caseListPath(workspaceId), { signal: controller.signal })
      .then((data: { cases: Case[] }) => { if (!controller.signal.aborted) { if (!Array.isArray(data.cases)) throw new Error('Unexpected case response. Please retry.'); setCases(data.cases); if (selected) { const match = data.cases.find(c => c.id === selected); if (match) onResolved?.(match.id, match.title) } } })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(message(e)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [workspaceId, revision])

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return
    setError(''); setSaving(true)
    try {
      const payload = casePayload(title, template, sites)
      const data = await workspaceRequest(caseListPath(workspaceId), { method: 'POST', body: JSON.stringify(payload) })
      if (!data.case?.id) throw new Error('Unexpected save response. Refresh before trying again.')
      setCases(current => [data.case, ...current]); onSelect(data.case.id, data.case.title); setTitle(''); setSites('')
    } catch (e) { setError(message(e)) } finally { setSaving(false) }
  }
  return <div className="space-y-4">
    {error && <Failure text={error} />}
    <div className="grid gap-6 md:grid-cols-2">
      <section className={panel} aria-labelledby="new-case-heading"><h2 id="new-case-heading" className="font-display text-xl font-semibold">Start with the decision</h2>
        <form className="mt-4 space-y-4" onSubmit={createCase}>
          <label className="block text-sm">Case type<select className={field} value={template} onChange={e => setTemplate(e.target.value)} disabled={saving}>{templates.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <p className="text-sm text-muted-foreground">{templates.find(item => item.id === template)?.question}</p>
          {template === 'FREIGHT' && <p className="text-sm">Freight evidence organisation only. A template is not a CBAM calculation, customs filing or determination of who is responsible.</p>}
          <label className="block text-sm">Case title<input className={field} value={title} onChange={e => setTitle(e.target.value)} required maxLength={160} placeholder="What decision are you working towards?" disabled={saving} /></label>
          <label className="block text-sm">Sites or facilities — optional<textarea className={field} rows={4} value={sites} onChange={e => setSites(e.target.value)} maxLength={3220} placeholder="One name per line" disabled={saving} aria-describedby="site-help" /></label>
          <p id="site-help" className="text-xs text-muted-foreground">Up to 20 named places. Names are not geocoded; no location is inferred.</p>
          <Button type="submit" disabled={saving || !title.trim()}>{saving ? 'Saving...' : 'Create case'}</Button>
        </form>
      </section>
      <section className={panel} aria-labelledby="cases-heading"><div className="flex items-center justify-between gap-3"><h2 id="cases-heading" className="font-display text-xl font-semibold">Your cases</h2><Button variant="outline" type="button" disabled={loading || saving} onClick={() => setRevision(value => value + 1)}>Refresh</Button></div>
        {loading ? <p className="mt-4" role="status">Loading cases...</p> : cases.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{error ? 'Cases could not be loaded.' : 'No cases available to your account in this workspace. Create the first one when you are ready.'}</p> : <ul className="mt-4 space-y-3">{cases.map(item => <li key={item.id}><button type="button" className={`w-full rounded-md border p-3 text-left focus-visible:ring-2 focus-visible:ring-ring ${selected === item.id ? 'border-primary bg-secondary' : 'border-border'}`} aria-pressed={selected === item.id} onClick={() => onSelect(item.id, item.title)}><span className="block font-medium break-words">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{templates.find(template => template.id === item.template)?.label ?? 'Case'} · Created {displayDate(item.createdAt)}</span></button></li>)}</ul>}
      </section>
    </div>
  </div>
}

function Investigation({ workspaceId, caseId, persona, onSelectCase, reportTitle }: { workspaceId: string; caseId: string; persona: Persona; onSelectCase: (id: string) => void; reportTitle: string }) {
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/cases/${encodeURIComponent(caseId)}/evidence`
  const publicEndpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/cases/${encodeURIComponent(caseId)}/public-records`
  const [revision, setRevision] = useState(0)
  const bump = () => setRevision(x => x + 1)
  const [docs, setDocs] = useState<Doc[]>([])
  const [events, setEvents] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // Location + map
  const [place, setPlace] = useState<Place>(IRELAND)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [placeHits, setPlaceHits] = useState<Hit[] | null>(null)
  const [layers, setLayers] = useState<MapLayers>({ buffer: true, species: false, planning: false })

  // Public records for the map (bat occurrences + planning applications). These
  // are retrieved read-only and kept STRICTLY SEPARATE from private uploaded
  // evidence — they are never added to the case, accepted, or exported.
  const [speciesResult, setSpeciesResult] = useState<MapLayerResult | null>(null)
  const [planningResult, setPlanningResult] = useState<MapLayerResult | null>(null)
  const [publicBusy, setPublicBusy] = useState(false)
  const [publicError, setPublicError] = useState('')
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [compared, setCompared] = useState(false)
  const publicSeq = useRef(0)

  // Question search (term-expansion retrieval)
  const [question, setQuestion] = useState('')
  const [questionHits, setQuestionHits] = useState<Retrieval | null>(null)
  const [asking, setAsking] = useState(false)

  // Cross-check (internal vs external)
  const [claim, setClaim] = useState('')
  const [claimHits, setClaimHits] = useState<Retrieval | null>(null)
  const [checking, setChecking] = useState(false)

  // Monotonic sequence guards so a slower earlier request can never overwrite a newer result.
  const placeSeq = useRef(0)
  const askSeq = useRef(0)
  const claimSeq = useRef(0)

  // Export
  const [exportId, setExportId] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  // Advanced tools stay collapsed by default so the primary journey reads simply.
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const dragRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const auditRef = useRef<HTMLDivElement>(null)
  const reviewRef = useRef<HTMLDivElement>(null)

  const feeds = useMemo(() => dataFeedsForCounty(place.county), [place.county])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setLoadError('')
    read(endpoint, { signal: controller.signal }).then(r => r.json())
      .then(data => { if (!controller.signal.aborted) { setDocs(Array.isArray(data.documents) ? data.documents : []); setEvents(Array.isArray(data.events) ? data.events : []) } })
      .catch(e => { if (!controller.signal.aborted) setLoadError(message(e)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [endpoint, revision])

  const accepted = events.filter(e => e.status === 'ACCEPTED')
  const drafts = events.filter(e => e.status === 'DRAFT')
  const superseded = events.filter(e => e.superseded)
  const undated = events.filter(e => !e.eventDate || e.precision === 'UNKNOWN')
  const timeline = [...events].sort(sortByEventDate)
  const latestReviewed = accepted[0] || drafts[0] || null

  const findings = useMemo(() => {
    const cards: { kind: string; title: string; detail: string }[] = []
    if (events.length === 0) cards.push({ kind: 'Start here', title: 'No evidence in this case yet', detail: 'Import a source above. Text is extracted into draft entries that appear here for review — nothing is invented.' })
    if (drafts.length) cards.push({ kind: 'Needs review', title: `${drafts.length} extracted ${drafts.length === 1 ? 'entry' : 'entries'} awaiting review`, detail: 'Auto-extracted from your uploaded sources. Confirm each faithfully represents its source before it counts as evidence.' })
    if (undated.length) cards.push({ kind: 'Missing coverage', title: `${undated.length} ${undated.length === 1 ? 'entry has' : 'entries have'} no confirmed date`, detail: 'These stay at the end of the timeline until a date is confirmed from the source text.' })
    if (superseded.length) cards.push({ kind: 'Amendment', title: `${superseded.length} source ${superseded.length === 1 ? 'has' : 'have'} a later version`, detail: 'Compare both versions; the earlier original is retained, not deleted.' })
    if (events.length > 0 && accepted.length === 0) cards.push({ kind: 'Not yet reviewed', title: 'No entries accepted yet', detail: 'Accept at least one source-linked entry before you can build an audit pack.' })
    return cards
  }, [events.length, drafts.length, undated.length, superseded.length, accepted.length])

  async function runSearch(q: string): Promise<Hit[]> {
    const data = await (await read(`${endpoint}?action=search&q=${encodeURIComponent(q)}&earlier=false`)).json()
    return Array.isArray(data.results) ? data.results : []
  }

  // Term-expansion retrieval: expand the question into related terms, run the existing
  // permissioned substring search for each, and merge/rank the hits. Private content is
  // never sent to an AI — only the same backend search endpoint is used, multiple times.
  async function retrieve(q: string): Promise<Retrieval> {
    const { tokens, terms } = expandQuery(q)
    const perTerm = await Promise.all(terms.map(async (term: string) => ({ term, hits: await runSearch(term) })))
    return rankResults(perTerm, tokens) as Retrieval
  }

  async function importFiles(files: FileList | null) {
    if (!files?.length || busy) return
    const list = Array.from(files)
    setBusy(true); setError(''); setNotice('')
    let imported = 0
    try {
      if (list.length > 5) throw new Error('Import up to five files per batch.')
      for (const file of list) {
        if (file.size > 3_000_000) throw new Error(`${file.name}: maximum 3 MB per file during this evaluation.`)
        const ext = (file.name.split('.').pop() || '').toLowerCase()
        if (!['pdf', 'txt', 'csv'].includes(ext)) throw new Error(`${file.name}: only PDF, TXT and CSV files are accepted during this evaluation. DOCX/EML and media files are blocked because the scanner cannot fully verify their embedded contents — convert to PDF and re-upload.`)
        setNotice(`Scanning and reading “${file.name}” — the file is sent to an external security-scanning provider before any text is read…`)
        const bytes = toBase64(await file.arrayBuffer())
        const result = await (await read(endpoint, { method: 'POST', body: JSON.stringify({ action: 'import', name: file.name, bytes }) })).json()
        imported++
        setNotice(result.duplicate ? `“${file.name}”: an identical document was already held — reused, not duplicated.` : `Imported ${imported} of ${list.length}. Extracted entries need review below.`)
      }
    } catch (e) {
      setNotice('')
      setError(`${message(e)} (${imported} file(s) imported before this error.)`)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setBusy(false); bump()
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); dragRef.current = false; setDragging(false)
    importFiles(event.dataTransfer.files)
  }

  function onQueryChange(value: string) {
    setQuery(value)
    setSuggestions(value.trim() ? toSuggestions(searchGazetteer(value, 5)) : [])
  }

  // Retrieve PUBLIC records (bats + planning) for the map. Read-only, kept
  // separate from private evidence. A layer is only switched on AFTER its own
  // retrieval returns status 'ok'; empty/error results leave the layer off and
  // surface an explanation in the cards below.
  async function retrievePublicRecords(next: Place) {
    const seq = ++publicSeq.current
    setPublicBusy(true); setPublicError(''); setSpeciesResult(null); setPlanningResult(null); setSelectedRecordId(null); setCompared(false)
    setLayers(c => ({ ...c, species: false, planning: false }))
    try {
      const data = await (await read(`${publicEndpoint}?lat=${encodeURIComponent(next.lat)}&lng=${encodeURIComponent(next.lng)}&radius=20`)).json()
      if (seq !== publicSeq.current) return
      const sp: MapLayerResult | null = data.species ?? null
      const pl: MapLayerResult | null = data.planning ?? null
      setSpeciesResult(sp); setPlanningResult(pl)
      setLayers(c => ({ ...c, species: sp?.status === 'ok', planning: pl?.status === 'ok' }))
    } catch (e) {
      if (seq === publicSeq.current) setPublicError(message(e))
    } finally {
      if (seq === publicSeq.current) setPublicBusy(false)
    }
  }

  async function selectPlace(next: Place) {
    setPlace(next); setSuggestions([]); setQuery(next.name); setError('')
    // Public map records run alongside, but stay SEPARATE from, private passages.
    retrievePublicRecords(next)
    // A town selection also retrieves the private source records that mention it.
    const seq = ++placeSeq.current
    setPlaceHits(null)
    try { const hits = await runSearch(next.name); if (seq === placeSeq.current) setPlaceHits(hits) } catch (e) { if (seq === placeSeq.current) setError(message(e)) }
  }

  async function submitPlaceSearch(event: FormEvent) {
    event.preventDefault()
    const q = query.trim(); if (!q) return
    setSearching(true); setError(''); setSuggestions([])
    try {
      const result = await geocode(q)
      if (!result) { setError(`No Irish location found for “${q}”. Try a town or county name.`); return }
      await selectPlace({ name: String(result.name), county: result.county == null ? null : String(result.county), lat: Number(result.lat), lng: Number(result.lng), zoom: Number(result.zoom) })
    } catch (e) { setError(message(e)) } finally { setSearching(false) }
  }

  async function submitQuestion(event: FormEvent) {
    event.preventDefault()
    const q = question.trim(); if (!q) return
    const seq = ++askSeq.current
    setAsking(true); setError(''); setQuestionHits(null)
    try { const r = await retrieve(q); if (seq === askSeq.current) setQuestionHits(r) } catch (e) { if (seq === askSeq.current) setError(message(e)) } finally { if (seq === askSeq.current) setAsking(false) }
  }

  async function submitClaim(event: FormEvent) {
    event.preventDefault()
    const q = claim.trim(); if (!q) return
    const seq = ++claimSeq.current
    setChecking(true); setError(''); setClaimHits(null)
    try { const r = await retrieve(q); if (seq === claimSeq.current) setClaimHits(r) } catch (e) { if (seq === claimSeq.current) setError(message(e)) } finally { if (seq === claimSeq.current) setChecking(false) }
  }

  async function enableExport() {
    setExportBusy(true); setError('')
    try { await (await read(endpoint, { method: 'POST', body: JSON.stringify({ action: 'exportPermission', enabled: true }) })).json(); setNotice('Exports enabled for your case-owner account. Create the audit pack now.') }
    catch (e) { setError(message(e)) } finally { setExportBusy(false) }
  }

  async function produceExport() {
    setExportBusy(true); setError('')
    try { const result = await (await read(endpoint, { method: 'POST', body: JSON.stringify({ action: 'export', reportTitle }) })).json(); setExportId(result.id); setNotice('Reviewed audit pack created from accepted entries. Download it below.') }
    catch (e) { setError(message(e)) } finally { setExportBusy(false) }
  }

  // The header "Generate audit pack" button runs the real export (not just a scroll):
  // it requires an accepted entry, jumps to the audit-pack panel, and produces the PDF.
  async function generateAuditPack() {
    if (accepted.length === 0) { setError('To generate an audit pack, first accept at least one source-linked entry in Detailed review (under Advanced investigation tools). The pack exports only accepted entries.'); setAdvancedOpen(true); setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth' }), 60); return }
    auditRef.current?.scrollIntoView({ behavior: 'smooth' })
    await produceExport()
  }

  async function download(url: string, name: string) {
    setError('')
    try { const blob = await (await read(url)).blob(); const object = URL.createObjectURL(blob), a = document.createElement('a'); a.href = object; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(object), 1000) }
    catch (e) { setError(message(e)) }
  }

  const claimDocs = claimHits ? Array.from(new Set(claimHits.ranked.map(h => h.documentId))) : []
  const externalWired = feeds.feeds.filter(f => f.status === 'available')

  // Plottable public records (only when a retrieval actually succeeded).
  const speciesPoints: MapPoint[] = speciesResult?.status === 'ok' ? (speciesResult.records as MapPoint[]) : []
  const planningPoints: MapPoint[] = planningResult?.status === 'ok' ? (planningResult.records as MapPoint[]) : []
  // Review-only proximity: planning applications near precisely-located bats.
  const proximityPairs = useMemo(() => pairPlanningNearBats(planningPoints, speciesPoints, PROXIMITY_METERS), [planningResult, speciesResult])
  // Bats left out of the distances: generalised OR precision not stated. A
  // record whose precision is "not stated" is never treated as precise.
  const impreciseExcluded = useMemo(() => countImprecise(speciesPoints), [speciesResult])
  const canCompare = speciesPoints.length > 0 && planningPoints.length > 0

  return <div className="space-y-6">
    {/* Case journey — the six-step sequence, shown prominently at the top of an opened case. */}
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm" aria-labelledby="journey-heading">
      <h2 id="journey-heading" className="font-display text-sm font-semibold">Your case in six steps</h2>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {CASE_STEPS.map((step, i) => (
          <li key={i} className="flex items-start gap-2 rounded-md border border-border bg-background p-2 text-sm">
            <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary bg-secondary text-xs font-semibold">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>

    {/* Actions header */}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-foreground"><span aria-hidden>📍</span>{place.name}{place.county ? `, Co. ${place.county}` : ''}</span>
        <span aria-hidden className="text-border">|</span>
        <span>{persona.title}</span>
        <span aria-hidden className="text-border">|</span>
        <span className={badge + ' bg-secondary text-secondary-foreground'}>{docs.length} source{docs.length === 1 ? '' : 's'}</span>
        <span className={badge + ' bg-secondary text-secondary-foreground'}>{events.length} entr{events.length === 1 ? 'y' : 'ies'}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => { setAdvancedOpen(true); setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth' }), 60) }}>Detailed review</Button>
        <Button type="button" disabled={exportBusy} onClick={generateAuditPack}>{exportBusy ? 'Preparing…' : 'Generate audit pack'}</Button>
      </div>
    </div>

    {/* Prominent starting action: the flagship public-evidence investigation. It
        needs no upload — it retrieves REAL bat occurrences and planning
        applications around Enniscorthy and plots them on the map. */}
    <section className="rounded-lg border-2 border-accent/60 bg-accent/5 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Start here — no upload needed</p>
          <h2 className="mt-0.5 font-display text-lg font-semibold">🦇 Bats and planning around Enniscorthy</h2>
          <p className="mt-1 text-sm text-muted-foreground">Retrieve genuine bat occurrence records and planning applications around Enniscorthy, Co. Wexford from public sources, plotted on the map with their source dates and links. These public records stay separate from your private case evidence — they are never accepted or exported.</p>
        </div>
        <Button type="button" disabled={publicBusy} onClick={() => selectPlace(ENNISCORTHY)}>{publicBusy && place.name === 'Enniscorthy' ? 'Retrieving…' : 'Open case'}</Button>
      </div>
    </section>

    {error && <Failure text={error} />}
    {loadError && <Failure text={`Could not refresh evidence: ${loadError}`} />}
    {notice && <p role="status" className="animate-fade-in rounded-md border-l-4 border-l-accent bg-secondary p-3 text-sm">{notice}</p>}

    {/* Add evidence: search a place + import sources (PRIMARY) */}
    <section className={panel} aria-label="Find a location and add evidence">
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={submitPlaceSearch} className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="place-search">Search any Irish town or county</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input id="place-search" className={field} style={{ marginTop: 0 }} value={query} onChange={e => onQueryChange(e.target.value)} placeholder="e.g. Enniscorthy, Kilkenny, Waterford" autoComplete="off" />
              {suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-md">
                  {suggestions.map(s => (
                    <li key={`${s.kind}-${s.name}`}>
                      <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => selectPlace({ name: s.name, county: s.county, lat: s.lat, lng: s.lng, zoom: s.zoom })}>
                        {s.name} <span className="text-muted-foreground">· Co. {s.county}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button type="submit" disabled={searching}>{searching ? 'Searching...' : 'Go'}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Selecting a place recenters the map and retrieves the source passages in this case that mention it. Coordinates are approximate centres for navigation only.</p>
        </form>

        <div
          onDragOver={e => { e.preventDefault(); if (!dragRef.current) { dragRef.current = true; setDragging(true) } }}
          onDragLeave={() => { dragRef.current = false; setDragging(false) }}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-center text-sm transition-colors ${dragging ? 'border-primary bg-secondary' : 'border-border'}`}
        >
          <p className="font-medium">{busy ? 'Importing…' : 'Drop anything to add evidence'}</p>
          <p className="mt-1 text-xs text-muted-foreground">PDF, TXT or CSV only during this evaluation (3 MB each, five per batch). DOCX, EML, images and audio are temporarily blocked because the scanner cannot fully verify their embedded contents. Convert DOCX/EML to PDF before uploading. Each file is sent to an external security-scanning provider (Cloudmersive) before any text is read; nothing is stored unless the scan passes.</p>
          <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.txt,.csv" onChange={e => importFiles(e.target.files)} />
          <Button type="button" variant="outline" className="mt-3" disabled={busy} onClick={() => fileInputRef.current?.click()}>{busy ? 'Processing…' : 'Choose files'}</Button>
          <p className="mt-2 text-xs text-muted-foreground">Imported privately to this case. No document content is sent to an AI or external parser.</p>
        </div>
      </div>
    </section>

    {/* Three-column investigative workspace */}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
      {/* Left: evidence + progress */}
      <div className="space-y-4">
        <section className={panel} aria-labelledby="evidence-heading">
          <PanelHeading id="evidence-heading">Your evidence ({docs.length})</PanelHeading>
          {loading ? <p className="mt-3 text-sm" role="status">Loading evidence…</p> : docs.length === 0 ? <p className="mt-3 rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No sources yet. Drop a file above to import your first one.</p> : <ul className="mt-3 space-y-2">
            {docs.map(item => (
              <li key={item.id} className={card + ' hover:border-primary/40'}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium break-words">📄 {item.name}</span>
                  <span className={badge + ' ' + statusTone(item.status)}>{item.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Imported {item.importedAt} · Published {item.publicationDate ?? 'unknown'}</p>
                {item.supersedesId && <p className="mt-1 text-xs">Amends an earlier document; the original is retained.</p>}
                {item.warnings.map((w, i) => <p key={i} className="mt-1 text-xs text-destructive">{w}</p>)}
                <Button variant="outline" className="mt-2" onClick={() => download(`${endpoint}?action=original&id=${encodeURIComponent(item.id)}`, item.name)}>Download original</Button>
              </li>
            ))}
          </ul>}
        </section>
        <section className={panel} aria-labelledby="progress-heading">
          <PanelHeading id="progress-heading">Investigation progress</PanelHeading>
          {(() => {
            const steps = [
              { label: 'Import at least one source', done: docs.length > 0 },
              { label: 'Review the extracted entries', done: events.length > 0 && drafts.length === 0 },
              { label: 'Accept a source-linked entry', done: accepted.length > 0 },
              { label: 'Create a reviewed audit pack', done: Boolean(exportId) },
            ]
            const complete = steps.filter(s => s.done).length
            return <>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${(complete / steps.length) * 100}%` }} /></div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">{complete}/{steps.length}</span>
              </div>
              <ul className="mt-3 space-y-2">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition-colors ${step.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>{step.done ? '✓' : i + 1}</span>
                    <span className={step.done ? 'font-medium' : 'text-muted-foreground'}>{step.label}</span>
                  </li>
                ))}
              </ul>
            </>
          })()}
        </section>
      </div>

      {/* Center: map + public records + proximity */}
      <div className="space-y-4">
        <section className={panel} aria-labelledby="map-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PanelHeading id="map-heading">Aerial map</PanelHeading>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={layers.buffer} onClick={() => setLayers(c => ({ ...c, buffer: !c.buffer }))} className={`rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${layers.buffer ? 'border-primary bg-secondary font-medium' : 'border-border text-muted-foreground'}`}>{layers.buffer ? '✓ ' : ''}Search buffer ({BUFFER_METERS} m)</button>
              {(() => {
                const ok = speciesResult?.status === 'ok'
                const reason = publicBusy ? 'Retrieving bat records…' : speciesResult == null ? 'Search a town to retrieve bat records.' : speciesResult.status === 'empty' ? 'No bat records were returned for this area.' : speciesResult.status === 'error' ? (speciesResult.error ?? 'Bat records could not be retrieved.') : ''
                return <button type="button" disabled={!ok} aria-disabled={!ok} aria-pressed={ok && layers.species} title={reason || undefined} onClick={() => ok && setLayers(c => ({ ...c, species: !c.species }))} className={`rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ok && layers.species ? 'border-primary bg-secondary font-medium' : ok ? 'border-border text-muted-foreground' : 'cursor-not-allowed border-dashed border-border text-muted-foreground opacity-70'}`}>{ok && layers.species ? '✓ ' : ''}Bats{ok ? ` (${speciesPoints.length})` : ''}</button>
              })()}
              {(() => {
                const ok = planningResult?.status === 'ok'
                const reason = publicBusy ? 'Retrieving planning applications…' : planningResult == null ? 'Search a town to retrieve planning applications.' : planningResult.status === 'empty' ? 'No planning applications were returned for this area.' : planningResult.status === 'error' ? (planningResult.error ?? 'Planning applications could not be retrieved.') : ''
                return <button type="button" disabled={!ok} aria-disabled={!ok} aria-pressed={ok && layers.planning} title={reason || undefined} onClick={() => ok && setLayers(c => ({ ...c, planning: !c.planning }))} className={`rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ok && layers.planning ? 'border-primary bg-secondary font-medium' : ok ? 'border-border text-muted-foreground' : 'cursor-not-allowed border-dashed border-border text-muted-foreground opacity-70'}`}>{ok && layers.planning ? '✓ ' : ''}Planning{ok ? ` (${planningPoints.length})` : ''}</button>
              })()}
            </div>
          </div>
          <div className="mt-3 h-[320px] w-full">
            <InvestigationMap lat={place.lat} lng={place.lng} zoom={place.zoom} name={place.name} layers={layers} bufferMeters={BUFFER_METERS} species={speciesPoints} planning={planningPoints} selectedId={selectedRecordId} onSelectRecord={id => setSelectedRecordId(prev => prev === id ? null : id)} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">The map shows a {BUFFER_METERS} m proximity search buffer around the selected centre — a navigation aid, not a surveyed site boundary. Retrieved bat occurrences (green) and planning applications (amber) are plotted only after each public source returns records; a generalised bat location is drawn as its stated uncertainty area, not a precise pin. Public records are shown separately from your private case evidence. Select a record on the map or in the list below to highlight it in both.</p>
          {/* Records mentioning the selected place */}
          <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Records mentioning {place.name}</p>
            {placeHits === null ? <p className="mt-1 text-muted-foreground">Select a town or county to retrieve source passages that mention it.</p>
              : placeHits.length === 0 ? <p className="mt-1 text-muted-foreground">No uploaded source in this case mentions “{place.name}”. Missing coverage.</p>
              : <ul className="mt-2 space-y-2">{placeHits.slice(0, 5).map(h => <li key={h.id}><p className="font-medium break-words">{h.name} · <span className="text-muted-foreground">{h.locator}</span></p><p className="whitespace-pre-wrap break-words text-xs">“{h.text}”</p></li>)}</ul>}
          </div>
          {/* Latest reviewed citation */}
          {latestReviewed && <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest {latestReviewed.status === 'ACCEPTED' ? 'reviewed' : 'draft'} citation</p>
            <p className="mt-1 whitespace-pre-wrap break-words">“{latestReviewed.quote}”</p>
            <p className="mt-1 text-xs text-muted-foreground">{latestReviewed.name} · {latestReviewed.locator}</p>
          </div>}
        </section>

        {/* Public records retrieved for the map — STRICTLY SEPARATE from private
            evidence. Each card cross-highlights its map marker; the whole card
            toggles selection, and the source link opens the provider record. */}
        <section className={panel} aria-labelledby="public-heading">
          <PanelHeading id="public-heading">Public records returned for the wider search area</PanelHeading>
          <p className="mt-1 text-xs text-muted-foreground">Retrieved live from public sources — bat occurrences from GBIF and planning applications from the national planning layer — for the wider search area around {place.name}. They may include records some distance away, including in an adjoining county. Shown for context only: they are never added to your private evidence, accepted, or included in an audit pack. Select a card to highlight it on the map.</p>
          {publicBusy && <p className="mt-3 text-sm text-muted-foreground" role="status">Retrieving public records and preserving their source details…</p>}
          {publicError && <p className="mt-3 rounded-md border border-destructive p-3 text-sm" role="alert">{publicError}</p>}
          {!publicBusy && !publicError && speciesResult == null && planningResult == null && <p className="mt-3 rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Open the Enniscorthy case above, or search any town, to retrieve bat records and planning records for the wider search area.</p>}

          {(speciesResult || planningResult) && <>
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: '#2f6f4f' }} />
                <h3 className="text-sm font-semibold">Bat occurrences{speciesResult?.status === 'ok' ? ` (${speciesPoints.length})` : ''}</h3>
              </div>
              {speciesResult == null ? <p className="mt-2 text-xs text-muted-foreground">Not retrieved.</p>
                : speciesResult.status === 'error' ? <p className="mt-2 text-xs text-destructive">{speciesResult.error}</p>
                : speciesResult.status === 'empty' ? <p className="mt-2 text-xs text-muted-foreground">No matching records were returned from the connected sources. This does not establish that no relevant record exists.</p>
                : <ul className="mt-2 space-y-2">{speciesPoints.slice(0, 12).map(r => (
                    <li key={r.id}>
                      <button type="button" aria-pressed={selectedRecordId === r.id} onClick={() => setSelectedRecordId(prev => prev === r.id ? null : r.id)} className={`w-full rounded-md border p-2 text-left text-xs transition-colors ${selectedRecordId === r.id ? 'border-primary bg-secondary' : 'border-border hover:border-primary/40'}`}>
                        <span className="block font-medium break-words">{r.title}</span>
                        <span className="mt-0.5 block text-muted-foreground">{r.subtitle} · {r.eventDate ?? 'date unknown'}</span>
                        <span className="mt-0.5 block text-muted-foreground">{r.generalised ? 'Generalised location (area shown, not a precise point)' : r.precisionMeters ? `Location precision ±${r.precisionMeters} m` : 'Location precision not stated'}</span>
                        <a href={r.sourceUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="mt-1 inline-block underline">View source record</a>
                      </button>
                    </li>))}</ul>}
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: '#b7791f' }} />
                <h3 className="text-sm font-semibold">Planning records returned for the wider search area{planningResult?.status === 'ok' ? ` (${planningPoints.length})` : ''}</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">These records were returned for the wider search area and may include applications some distance away — for example in an adjoining county. The distance from the selected centre is shown for each; a record is never described as nearby without a calculated distance.</p>
              {planningResult == null ? <p className="mt-2 text-xs text-muted-foreground">Not retrieved.</p>
                : planningResult.status === 'error' ? <p className="mt-2 text-xs text-destructive">{planningResult.error}</p>
                : planningResult.status === 'empty' ? <p className="mt-2 text-xs text-muted-foreground">No matching records were returned from the connected sources. This does not establish that no relevant record exists.</p>
                : <ul className="mt-2 space-y-2">{planningPoints.slice(0, 12).map(r => {
                    const distance = Number.isFinite(r.lat) && Number.isFinite(r.lng) ? Math.round(haversineMeters({ lat: place.lat, lng: place.lng }, { lat: r.lat, lng: r.lng })) : null
                    const inside = distance !== null && distance <= PROXIMITY_METERS
                    const appNumber = r.id.startsWith('planning:') ? r.id.slice('planning:'.length) : r.title
                    return (
                    <li key={r.id}>
                      <button type="button" aria-pressed={selectedRecordId === r.id} onClick={() => setSelectedRecordId(prev => prev === r.id ? null : r.id)} className={`w-full rounded-md border p-2 text-left text-xs transition-colors ${selectedRecordId === r.id ? 'border-primary bg-secondary' : 'border-border hover:border-primary/40'}`}>
                        <span className="block font-medium break-words">{r.title}</span>
                        <dl className="mt-1 space-y-0.5 text-muted-foreground">
                          <div className="flex flex-wrap gap-x-1"><dt className="font-medium text-foreground/80">Planning authority:</dt><dd className="break-words">{r.subtitle || 'Not stated'}</dd></div>
                          <div className="flex flex-wrap gap-x-1"><dt className="font-medium text-foreground/80">Application number:</dt><dd className="break-words">{appNumber}</dd></div>
                          <div className="flex flex-wrap gap-x-1"><dt className="font-medium text-foreground/80">Received date:</dt><dd>{r.eventDate ?? 'Not stated'}</dd></div>
                          {r.status && <div className="flex flex-wrap gap-x-1"><dt className="font-medium text-foreground/80">Status:</dt><dd className="break-words">{r.status}</dd></div>}
                          {r.detail && <div className="flex flex-wrap gap-x-1"><dt className="font-medium text-foreground/80">Development:</dt><dd className="break-words">{r.detail}</dd></div>}
                          <div className="flex flex-wrap gap-x-1"><dt className="font-medium text-foreground/80">Distance from centre:</dt><dd>{distance !== null ? formatMeters(distance) : 'Distance not calculated'}</dd></div>
                          <div className="flex flex-wrap gap-x-1"><dt className="font-medium text-foreground/80">Comparison distance:</dt><dd>{distance === null ? 'Not calculated' : inside ? `Inside the ${(PROXIMITY_METERS / 1000).toFixed(1)} km comparison distance` : `Outside the ${(PROXIMITY_METERS / 1000).toFixed(1)} km comparison distance`}</dd></div>
                        </dl>
                        <a href={r.sourceUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="mt-1 inline-block underline">View source record</a>
                      </button>
                    </li>)
                  })}</ul>}
            </div>
          </>}
        </section>

        {/* The ONE review question comparing the two public layers geographically.
            Framed as something to review, never a finding of ecological conflict;
            distances use only precisely-located bat records. */}
        <section className={panel} aria-labelledby="proximity-heading">
          <PanelHeading id="proximity-heading" size="text-base">Which planning applications are near recorded bat observations?</PanelHeading>
          <p className="mt-1 text-xs text-muted-foreground">Compares the retrieved public records geographically, within {(PROXIMITY_METERS / 1000).toFixed(1)} km. Proximity is something to review — not evidence of ecological conflict — and this does not use your private case evidence.</p>
          <p className="mt-1 text-xs text-muted-foreground">The comparison below tests calculated proximity. The wider record list above is contextual and may include records outside the comparison distance.</p>
          <Button type="button" className="mt-3" disabled={!canCompare} onClick={() => setCompared(true)}>Compare proximity</Button>
          {!canCompare && <p className="mt-2 text-xs text-muted-foreground">Retrieve both bat records and planning applications (open the case or search a town) to enable this comparison.</p>}
          {compared && canCompare && <div className="mt-3 space-y-2">
            {proximityPairs.length === 0
              ? <p className="text-sm text-muted-foreground">No planning application is within {(PROXIMITY_METERS / 1000).toFixed(1)} km of a precisely-located bat observation.</p>
              : <>
                  <p className="text-xs text-muted-foreground">{proximityPairs.length} pair{proximityPairs.length === 1 ? '' : 's'} within {(PROXIMITY_METERS / 1000).toFixed(1)} km, nearest first. Distance is measured only to bat observations with a precise location.</p>
                  {proximityPairs.slice(0, 10).map(pair => (
                    <article key={`${pair.planningId}|${pair.batId}`} className="rounded-md border border-border bg-background p-3 text-sm">
                      <p className="font-medium">≈ {formatMeters(pair.distanceMeters)} apart — to review</p>
                      <p className="mt-1 text-xs"><span className="font-medium">{pair.planning.title}</span>{pair.planning.status ? ` · ${pair.planning.status}` : ''} · {pair.planning.date ?? 'date unknown'} · <a className="underline" href={pair.planning.sourceUrl} target="_blank" rel="noreferrer">source</a></p>
                      <p className="mt-1 text-xs"><span className="font-medium">{pair.bat.title}</span> · {pair.bat.date ?? 'date unknown'} · <a className="underline" href={pair.bat.sourceUrl} target="_blank" rel="noreferrer">source</a></p>
                    </article>))}
                </>}
            {impreciseExcluded > 0 && <p className="text-xs text-muted-foreground">{impreciseExcluded} bat record{impreciseExcluded === 1 ? ' was' : 's were'} excluded from the distance comparison because {impreciseExcluded === 1 ? 'its' : 'their'} location is not precise — either generalised or with no stated precision.</p>}
            <p className="text-xs text-muted-foreground">Proximity is something to review, not evidence of ecological conflict.</p>
          </div>}
        </section>
      </div>

      {/* Right: evidence requiring review (PRIMARY) */}
      <div className="space-y-4">
        <section className={panel} aria-labelledby="findings-heading">
          <PanelHeading id="findings-heading">Evidence requiring review</PanelHeading>
          <p className="mt-1 text-xs text-muted-foreground">Derived from the sources in this case — never sample analysis.</p>
          <div className="mt-3 space-y-3">
            {findings.map((item, i) => (
              <article key={i} className={`rounded-md border border-l-4 border-border bg-background p-3 ${findingAccent(item.kind)}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.kind}</p>
                <h3 className="mt-1 text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>

    {/* Timeline (PRIMARY: Chronology) */}
    <section className={panel} aria-labelledby="timeline-heading">
      <PanelHeading id="timeline-heading">Chronology ({timeline.length})</PanelHeading>
      <p className="mt-1 text-xs text-muted-foreground">Ordered by stated event date; unknown dates appear last. Built only from your reviewed and draft entries.</p>
      {timeline.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No entries yet. Import a source to populate the chronology.</p> : <ol className="mt-4 space-y-3">
        {timeline.slice(0, 30).map((event, index) => (
          <li key={`${event.id}/${event.revision}`} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary bg-secondary text-xs font-semibold">{index + 1}</span>
            <div className="flex-1 rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{event.eventDate ?? 'Date unknown'} · {event.precision}</p>
                <span className={badge + ' ' + statusTone(event.status)}>{event.status}</span>
              </div>
              <p className="mt-1 text-sm font-semibold break-words">{event.title}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs">“{event.quote}”</p>
              <p className="mt-1 text-xs text-muted-foreground">{event.name} · {event.locator}{event.superseded ? ' · superseded' : ''}</p>
            </div>
          </li>
        ))}
      </ol>}
    </section>

    {/* Create report (PRIMARY: audit pack) */}
    <section ref={auditRef} className={panel} aria-labelledby="audit-heading">
      <PanelHeading id="audit-heading">{reportTitle}</PanelHeading>
      <p className="mt-1 text-sm text-muted-foreground">Exports every accepted entry with its source-linked quote, including unknown dates and labelled superseded sources. Draft and rejected entries and originals are excluded. This is not a redaction tool — review personal information before sharing.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={exportBusy} onClick={enableExport}>Case owner: enable my exports</Button>
        <Button type="button" disabled={exportBusy || accepted.length === 0} onClick={produceExport}>{exportBusy ? 'Preparing…' : 'Create reviewed PDF'}</Button>
      </div>
      {accepted.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Accept at least one source-linked entry (in Detailed review, under Advanced investigation tools) before exporting.</p>}
      {exportId && <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => download(`${endpoint}?action=export&id=${encodeURIComponent(exportId)}`, 'audit-pack.pdf')}>Download PDF</Button>
        <Button type="button" variant="outline" onClick={() => download(`${endpoint}?action=export&id=${encodeURIComponent(exportId)}&format=json`, 'source-manifest.json')}>Download source manifest</Button>
      </div>}
    </section>

    {/* Advanced investigation tools — collapsed. All existing capabilities remain
        available; nothing is removed, only tucked away to simplify the primary journey. */}
    <details open={advancedOpen} onToggle={e => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)} className={panel}>
      <summary className="flex cursor-pointer items-center gap-2 font-display text-lg font-semibold"><span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-accent" />Advanced investigation tools</summary>
      <p className="mt-2 text-xs text-muted-foreground">All capabilities remain available here: ask your evidence, suggested prompts, cross-check a claim, feed diagnostics, and detailed review and amendments.</p>
      <div className="mt-4 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <section className={panel} aria-labelledby="ask-heading">
            <PanelHeading id="ask-heading">Ask your evidence</PanelHeading>
            <p className="mt-1 text-xs text-muted-foreground">Keyword + term-expansion retrieval across this case’s source passages — it expands wording (e.g. bats → Pipistrelle, flooding → inundation) to find relevant passages. Not a semantic or AI answer; nothing is sent to an external service.</p>
            <form className="mt-3 space-y-2" onSubmit={submitQuestion}>
              <input className={field} style={{ marginTop: 0 }} value={question} maxLength={160} onChange={e => setQuestion(e.target.value)} placeholder="Find a phrase, permit number or name" />
              <Button type="submit" disabled={asking}>{asking ? 'Searching...' : 'Search evidence'}</Button>
            </form>
            {questionHits !== null && <div className="mt-3 space-y-2">
              {questionHits.ranked.length === 0 ? <div className="text-sm text-muted-foreground"><p>No source passage matches. Missing coverage for this question.</p>{questionHits.unmatchedConcepts.length > 0 && <p className="mt-1">No coverage for: {questionHits.unmatchedConcepts.join(', ')}.</p>}</div>
                : <>
                    <p className="text-xs text-muted-foreground">Term-expansion retrieval — {questionHits.ranked.length} passage{questionHits.ranked.length === 1 ? '' : 's'}, ranked by how many query terms each matched.{questionHits.unmatchedConcepts.length > 0 && ` No coverage for: ${questionHits.unmatchedConcepts.join(', ')}.`}</p>
                    {questionHits.ranked.slice(0, 6).map(h => <article key={h.id} className="rounded-md border border-border bg-background p-3 text-sm"><p className="font-medium break-words">{h.name} · <span className="text-muted-foreground">{h.locator}</span></p><p className="mt-1 whitespace-pre-wrap break-words text-xs">“{h.text}”</p>{h.matchedTerms.length > 0 && <p className="mt-1 text-xs text-muted-foreground">matched: {h.matchedTerms.slice(0, 4).join(', ')}</p>}</article>)}
                  </>}
            </div>}
          </section>
          <section className={panel} aria-labelledby="prompts-heading">
            <PanelHeading id="prompts-heading">Suggested prompts</PanelHeading>
            <ul className="mt-3 space-y-2">
              {persona.prompts.map((prompt, index) => (
                <li key={index}><button type="button" onClick={() => { setQuestion(prompt) }} className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:bg-secondary">{prompt}</button></li>
              ))}
            </ul>
          </section>
        </div>

        {/* Cross-check: internal contradictions vs external records */}
        <section className={panel} aria-labelledby="crosscheck-heading">
          <PanelHeading id="crosscheck-heading">Cross-check a claim</PanelHeading>
          <p className="mt-1 text-xs text-muted-foreground">Enter a claim, figure or date to see every source that mentions it. This distinguishes contradictions <em>between your own uploaded documents</em> from conflicts with <em>external agency records</em>. It surfaces the passages for you to judge — it does not decide which is correct.</p>
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={submitClaim}>
            <input className={field} style={{ marginTop: 0, maxWidth: 420 }} value={claim} maxLength={160} onChange={e => setClaim(e.target.value)} placeholder="e.g. a date, permit number or measurement" />
            <Button type="submit" disabled={checking}>{checking ? 'Checking...' : 'Cross-check'}</Button>
          </form>
          {claimHits !== null && <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">Internal — your own sources</h3>
              {claimHits.ranked.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No uploaded source mentions this. Missing coverage.</p>
                : claimDocs.length < 2 ? <div className="mt-2 space-y-2"><p className="text-sm text-muted-foreground">Only one of your sources mentions this — no internal corroboration (missing coverage).</p>{claimHits.ranked.slice(0, 3).map(h => <blockquote key={h.id} className="rounded-md border-l-4 border-primary/50 bg-background p-3 text-sm"><p className="text-xs font-medium text-muted-foreground">{h.name} · {h.locator}</p><p className="mt-1 whitespace-pre-wrap break-words">“{h.text}”</p></blockquote>)}</div>
                : <div className="mt-2 space-y-2"><p className="text-sm">{claimDocs.length} of your sources mention this — compare the supporting passages below for agreement or contradiction.</p>{claimHits.ranked.slice(0, 6).map(h => <blockquote key={h.id} className="rounded-md border-l-4 border-primary/50 bg-background p-3 text-sm"><p className="text-xs font-medium text-muted-foreground">{h.name} · {h.locator}</p><p className="mt-1 whitespace-pre-wrap break-words">“{h.text}”</p></blockquote>)}</div>}
            </div>
            <div>
              <h3 className="text-sm font-semibold">External — agency records</h3>
              <p className="mt-2 text-sm text-muted-foreground">Automated conflict detection against external records is not available. Cross-check these manually against the wired feeds below.</p>
              <ul className="mt-2 space-y-2">
                {feeds.feeds.map(f => <li key={f.id} className={card}><div className="flex items-center justify-between gap-2"><span className="font-medium">{f.label} · <span className="text-muted-foreground">{f.agency}</span></span><span className={badge + ' ' + feedTone(f.status)}>{feedLabel(f.status)}</span></div></li>)}
              </ul>
              {externalWired.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No external feed is wired or verified for {feeds.county ? `Co. ${feeds.county}` : 'this location'} — conflicts with external records cannot be auto-detected here. Missing external coverage.</p>}
            </div>
          </div>}
        </section>

        {/* Feed diagnostics */}
        <section className={panel} aria-labelledby="feeds-heading">
          <PanelHeading id="feeds-heading">Feed diagnostics{feeds.county ? ` — Co. ${feeds.county}` : ''}</PanelHeading>
          <p className="mt-1 text-xs text-muted-foreground">Which local data sources are wired and verified for this location. A source shown as unverified or not wired has not returned data and nothing has been imported from it.</p>
          <ul className="mt-3 space-y-2">
            {feeds.feeds.map(feed => (
              <li key={feed.id} className={card}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{feed.label} <span className="text-muted-foreground">· {feed.agency}</span></span>
                  <span className={badge + ' ' + feedTone(feed.status)}>{feedLabel(feed.status)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{feedStateNote(feed.status, feed.note)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Detailed review & amendments (full backend workflow) */}
        <div ref={reviewRef} className="space-y-3">
          <div className="rounded-md bg-secondary p-3 text-sm">Detailed review &amp; amendments — accept or reject each extracted entry against its exact source passage, record amendments, and inspect revision history. Changes here update the overview above.</div>
          <CaseSummary key={caseId} workspaceId={workspaceId} caseId={caseId} onSelectCase={onSelectCase} reportTitle={reportTitle} externalRevision={revision} onChanged={bump} />
        </div>
      </div>
    </details>
  </div>
}

function CaseSummary({ workspaceId, caseId, onSelectCase, reportTitle, externalRevision, onChanged }: { workspaceId: string; caseId: string; onSelectCase: (id: string) => void; reportTitle: string; externalRevision: number; onChanged: () => void }) {
  const [item, setItem] = useState<CaseDetail | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    workspaceRequest(`${caseListPath(workspaceId)}/${encodeURIComponent(caseId)}`, { signal: controller.signal })
      .then((data: { case: CaseDetail }) => { if (!controller.signal.aborted) { if (!data.case || !Array.isArray(data.case.sites)) throw new Error('Unexpected case detail response.'); setItem(data.case) } })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(message(e)) })
    return () => controller.abort()
  }, [workspaceId, caseId])
  if (error) return <Failure text={error} />
  if (!item) return <p role="status">Loading case details...</p>
  return <section className={panel} aria-labelledby="case-detail-heading"><h2 id="case-detail-heading" className="font-display text-xl font-semibold break-words">{item.title}</h2><p className="mt-1 text-xs text-muted-foreground">Case created {displayDate(item.createdAt)} — not an event date.</p><details className="mt-4"><summary className="cursor-pointer font-medium">Sites and facilities ({item.sites.length})</summary>{item.sites.length ? <ul className="mt-2 space-y-2">{item.sites.map(site => <li key={site.id} className="rounded bg-secondary p-3 text-sm break-words">{site.name}<span className="block text-xs text-muted-foreground">{site.latitude !== null && site.longitude !== null ? `${site.latitude}, ${site.longitude} — supplied coordinates` : 'Coordinates not supplied'}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No sites were added to this case.</p>}</details><CaseEvidence key={caseId} workspaceId={workspaceId} caseId={caseId} onSelectCase={onSelectCase} reportTitle={reportTitle} externalRevision={externalRevision} onChanged={onChanged} /></section>
}
