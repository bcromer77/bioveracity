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
import { InvestigationMap, type MapLayers } from './investigation-map'
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
// Colour-code the review prompts by urgency without inventing findings.
function findingAccent(kind: string): string {
  if (kind === 'Missing coverage') return 'border-l-[hsl(var(--evidence-gap))]'
  if (kind === 'Needs review' || kind === 'Not yet reviewed') return 'border-l-accent'
  if (kind === 'Amendment') return 'border-l-[hsl(var(--chart-3))]'
  return 'border-l-primary'
}

const IRELAND: Place = { name: 'Ireland', county: null, lat: 53.4, lng: -7.9, zoom: 7 }

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

function Failure({ text }: { text: string }) {
  return <div role="alert" className="rounded-md border border-destructive p-3 text-sm"><p>{text}</p><Link className="mt-2 inline-block underline" href="/login?callbackUrl=/workspace">Sign in again</Link></div>
}

export function WorkspaceCanvas({ workspaceId }: { workspaceId: string }) {
  const { data: session, status } = useSession()
  const params = useSearchParams()
  const persona = getPersona(params.get('persona'))
  if (status === 'loading') return <p role="status">Checking your session...</p>
  if (status !== 'authenticated' || !session?.user?.id) return <Failure text="Sign in to open your private workspace." />
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
  const [revision, setRevision] = useState(0)
  const bump = () => setRevision(x => x + 1)
  const [docs, setDocs] = useState<Doc[]>([])
  const [events, setEvents] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // Location + map
  const [place, setPlace] = useState<Place>(IRELAND)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [placeHits, setPlaceHits] = useState<Hit[] | null>(null)
  const [layers, setLayers] = useState<MapLayers>({ water: false, species: false, buffer: true })

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

  const dragRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const auditRef = useRef<HTMLDivElement>(null)
  const reviewRef = useRef<HTMLDivElement>(null)

  const feeds = useMemo(() => dataFeedsForCounty(place.county), [place.county])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    read(endpoint, { signal: controller.signal }).then(r => r.json())
      .then(data => { if (!controller.signal.aborted) { setDocs(Array.isArray(data.documents) ? data.documents : []); setEvents(Array.isArray(data.events) ? data.events : []) } })
      .catch(e => { if (!controller.signal.aborted) setError(message(e)) })
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
    if (list.length > 5) { setError('Import up to five files per batch.'); return }
    setBusy(true); setError(''); setNotice('')
    let imported = 0
    try {
      for (const file of list) {
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name}: maximum 5 MiB per file.`)
        setNotice(`Processing “${file.name}” — scanning and extracting…`)
        const bytes = toBase64(await file.arrayBuffer())
        const result = await (await read(endpoint, { method: 'POST', body: JSON.stringify({ action: 'import', name: file.name, bytes }) })).json()
        imported++
        setNotice(result.duplicate ? `“${file.name}”: an identical document was already held — reused, not duplicated.` : `Imported ${imported} of ${list.length}. Extracted entries need review below.`)
      }
    } catch (e) {
      setError(`${message(e)} (${imported} file(s) imported before this error.)`)
    } finally {
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

  async function selectPlace(next: Place) {
    setPlace(next); setSuggestions([]); setQuery(next.name); setError('')
    // A town selection retrieves the source records that actually mention it.
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
    if (accepted.length === 0) { setError('To generate an audit pack, first accept at least one source-linked entry in Detailed review below. The pack exports only accepted entries.'); reviewRef.current?.scrollIntoView({ behavior: 'smooth' }); return }
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
  const speciesFeed = feeds.feeds.find(f => f.id === 'species')
  const waterFeed = feeds.feeds.find(f => f.id === 'water')

  return <div className="space-y-6">
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
        <Button type="button" variant="outline" onClick={() => reviewRef.current?.scrollIntoView({ behavior: 'smooth' })}>Detailed review</Button>
        <Button type="button" disabled={exportBusy} onClick={generateAuditPack}>{exportBusy ? 'Preparing…' : 'Generate audit pack'}</Button>
      </div>
    </div>

    {error && <Failure text={error} />}
    {notice && <p role="status" className="animate-fade-in rounded-md border-l-4 border-l-accent bg-secondary p-3 text-sm">{notice}</p>}

    {/* Search + ingestion bar */}
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
          <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, EML, TXT/CSV notes, PNG/JPEG images, or MP3/WAV audio. Five files per batch, 5 MiB each. Scanned PDFs, images and audio are retained as originals — they are not auto-transcribed, so add a text note with the key quote to place them on the timeline.</p>
          <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.docx,.eml,.txt,.csv,.png,.jpg,.jpeg,.mp3,.wav" onChange={e => importFiles(e.target.files)} />
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

      {/* Center: map + citation + feeds */}
      <div className="space-y-4">
        <section className={panel} aria-labelledby="map-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PanelHeading id="map-heading">Aerial map</PanelHeading>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={layers.buffer} onClick={() => setLayers(c => ({ ...c, buffer: !c.buffer }))} className={`rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${layers.buffer ? 'border-primary bg-secondary font-medium' : 'border-border text-muted-foreground'}`}>{layers.buffer ? '✓ ' : ''}Search buffer ({BUFFER_METERS} m)</button>
              <button type="button" disabled aria-disabled title={`Species features are not plotted on this map. Species feed for ${feeds.county ? `Co. ${feeds.county}` : 'this area'}: ${feedLabel(speciesFeed?.status ?? 'not-wired')}. See Local data feeds below.`} className="cursor-not-allowed rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground opacity-70">Species (not plotted)</button>
              <button type="button" disabled aria-disabled title={`Water features are not plotted on this map. Water feed for ${feeds.county ? `Co. ${feeds.county}` : 'this area'}: ${feedLabel(waterFeed?.status ?? 'unverified')}. See Local data feeds below.`} className="cursor-not-allowed rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground opacity-70">Water (not plotted)</button>
            </div>
          </div>
          <div className="mt-3 h-[320px] w-full">
            <InvestigationMap lat={place.lat} lng={place.lng} zoom={place.zoom} name={place.name} layers={layers} bufferMeters={BUFFER_METERS} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">The map shows a {BUFFER_METERS} m proximity search buffer around the selected centre — a navigation aid, not a surveyed site boundary. Species and water features are not plotted on the map; their retrieval status is shown under Local data feeds below.</p>
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
        <section className={panel} aria-labelledby="feeds-heading">
          <PanelHeading id="feeds-heading">Local data feeds{feeds.county ? ` — Co. ${feeds.county}` : ''}</PanelHeading>
          <ul className="mt-3 space-y-2">
            {feeds.feeds.map(feed => (
              <li key={feed.id} className={card}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{feed.label} <span className="text-muted-foreground">· {feed.agency}</span></span>
                  <span className={badge + ' ' + feedTone(feed.status)}>{feedLabel(feed.status)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{feed.note}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Right: findings + question + prompts */}
      <div className="space-y-4">
        <section className={panel} aria-labelledby="findings-heading">
          <PanelHeading id="findings-heading">Things to review</PanelHeading>
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

    {/* Timeline */}
    <section className={panel} aria-labelledby="timeline-heading">
      <PanelHeading id="timeline-heading">Chronological timeline ({timeline.length})</PanelHeading>
      <p className="mt-1 text-xs text-muted-foreground">Ordered by stated event date; unknown dates appear last. Built only from your reviewed and draft entries.</p>
      {timeline.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No entries yet. Import a source to populate the timeline.</p> : <ol className="mt-4 space-y-3">
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

    {/* Audit pack */}
    <section ref={auditRef} className={panel} aria-labelledby="audit-heading">
      <PanelHeading id="audit-heading">{reportTitle}</PanelHeading>
      <p className="mt-1 text-sm text-muted-foreground">Exports every accepted entry with its source-linked quote, including unknown dates and labelled superseded sources. Draft and rejected entries and originals are excluded. This is not a redaction tool — review personal information before sharing.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={exportBusy} onClick={enableExport}>Case owner: enable my exports</Button>
        <Button type="button" disabled={exportBusy || accepted.length === 0} onClick={produceExport}>{exportBusy ? 'Preparing…' : 'Create reviewed PDF'}</Button>
      </div>
      {accepted.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Accept at least one source-linked entry (in Detailed review below) before exporting.</p>}
      {exportId && <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => download(`${endpoint}?action=export&id=${encodeURIComponent(exportId)}`, 'audit-pack.pdf')}>Download PDF</Button>
        <Button type="button" variant="outline" onClick={() => download(`${endpoint}?action=export&id=${encodeURIComponent(exportId)}&format=json`, 'source-manifest.json')}>Download source manifest</Button>
      </div>}
    </section>

    {/* Detailed review & amendments (full backend workflow) */}
    <div ref={reviewRef} className="space-y-3">
      <div className="rounded-md bg-secondary p-3 text-sm">Detailed review &amp; amendments — accept or reject each extracted entry against its exact source passage, record amendments, and inspect revision history. Changes here update the overview above.</div>
      <CaseSummary key={caseId} workspaceId={workspaceId} caseId={caseId} onSelectCase={onSelectCase} reportTitle={reportTitle} externalRevision={revision} onChanged={bump} />
    </div>
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
