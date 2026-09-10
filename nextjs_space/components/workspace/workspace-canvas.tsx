'use client'

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { caseListPath, casePayload, displayDate, templates, workspaceRequest } from './workspace-client.mjs'
import { getPersona } from './personas.mjs'
import { geocode, dataFeedsForCounty } from './geocode.mjs'
import { searchGazetteer } from './ireland-gazetteer.mjs'
import { InvestigationMap, type MapLayers } from './investigation-map'
import {
  SAMPLE_LOCATION,
  SAMPLE_EVIDENCE,
  SAMPLE_PROGRESS,
  SAMPLE_REVIEW_CARDS,
  SAMPLE_CITATION,
  SAMPLE_TIMELINE,
  SAMPLE_COMPARE,
  SAMPLE_AUDIT_PACK,
} from './investigation-data.mjs'
import { CaseEvidence } from './case-evidence'

type Case = { id: string; workspaceId: string; title: string; template: string; createdAt: string }
type CaseDetail = Case & { sites: { id: string; name: string; latitude: number | null; longitude: number | null }[] }
type Persona = ReturnType<typeof getPersona>
type Place = { name: string; county: string | null; lat: number; lng: number; zoom: number }
type Suggestion = { name: string; county: string; lat: number; lng: number; zoom: number; kind: string }
type LocalFile = { id: string; name: string; kind: 'document' | 'audio'; meta: string }
type EvidenceItem = { id: string; name: string; kind: 'document' | 'audio'; meta: string; preview?: string; locator?: string; sample?: boolean }

// The gazetteer is authored in a .mjs module, so its rows type-infer loosely as
// string | number. Coerce to a strict Suggestion for the typed UI.
function toSuggestions(rows: Array<Record<string, unknown>>): Suggestion[] {
  return rows.map(r => ({ name: String(r.name), county: String(r.county), lat: Number(r.lat), lng: Number(r.lng), zoom: Number(r.zoom), kind: String(r.kind) }))
}

const field = 'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const panel = 'rounded-lg border border-border bg-card p-5'
const message = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.'

function Failure({ text }: { text: string }) {
  return <div role="alert" className="rounded-md border border-destructive p-3 text-sm"><p>{text}</p><Link className="mt-2 inline-block underline" href="/login?callbackUrl=/workspace">Sign in again</Link></div>
}

function classifyFile(name: string): 'document' | 'audio' {
  return /\.(mp3|wav|m4a|aac|ogg)$/i.test(name) ? 'audio' : 'document'
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
  const [caseTitle, setCaseTitle] = useState(SAMPLE_LOCATION.caseTitle)
  const [place, setPlace] = useState<Place>({ name: SAMPLE_LOCATION.place, county: SAMPLE_LOCATION.county, lat: SAMPLE_LOCATION.lat, lng: SAMPLE_LOCATION.lng, zoom: SAMPLE_LOCATION.zoom })
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [layers, setLayers] = useState<MapLayers>(() => ({
    water: persona.layers.some(l => (l.id === 'rivers' || l.id === 'foreshore') && l.default),
    species: persona.layers.some(l => l.id === 'species' && l.default),
    boundary: true,
  }))
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [activePrompt, setActivePrompt] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const caseSectionRef = useRef<HTMLDivElement>(null)

  const feeds = useMemo(() => dataFeedsForCounty(place.county), [place.county])

  async function runSearch(event?: FormEvent) {
    event?.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true); setSearchError(''); setSuggestions([])
    try {
      const result = await geocode(q)
      if (!result) { setSearchError(`No Irish location found for “${q}”. Try a town or county name.`); return }
      setPlace({ name: String(result.name), county: result.county == null ? null : String(result.county), lat: Number(result.lat), lng: Number(result.lng), zoom: Number(result.zoom) })
    } catch (e) {
      setSearchError(message(e))
    } finally {
      setSearching(false)
    }
  }

  function onQueryChange(value: string) {
    setQuery(value)
    setSuggestions(value.trim() ? toSuggestions(searchGazetteer(value, 5)) : [])
  }

  function pickSuggestion(s: Suggestion) {
    setPlace({ name: s.name, county: s.county, lat: s.lat, lng: s.lng, zoom: s.zoom })
    setQuery(s.name); setSuggestions([]); setSearchError('')
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return
    const next: LocalFile[] = Array.from(files).map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      kind: classifyFile(file.name),
      meta: classifyFile(file.name) === 'audio' ? 'Audio · retained, not auto-transcribed' : 'Document · staged for import',
    }))
    setLocalFiles(current => [...next, ...current])
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  const evidence: EvidenceItem[] = [
    ...localFiles.map(f => ({ ...f })),
    ...SAMPLE_EVIDENCE.map(e => ({ id: String(e.id), name: String(e.name), kind: (String(e.kind) === 'audio' ? 'audio' : 'document') as 'document' | 'audio', meta: String(e.meta), preview: String(e.preview), locator: String(e.locator), sample: true })),
  ]

  return <div className="space-y-6">
    {/* Header */}
    <header className="space-y-3">
      <p className="text-sm"><Link href="/workspace" className="underline">← All workspaces</Link></p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <input
              aria-label="Case title"
              value={caseTitle}
              onChange={e => setCaseTitle(e.target.value)}
              className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent font-display text-3xl font-bold tracking-tight focus:border-border focus-visible:outline-none"
            />
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-secondary px-3 py-1 text-xs font-medium">🔒 Private workspace</span>
          </div>
          <p className="text-muted-foreground">{place.name}{place.county ? `, Co. ${place.county}` : ''} · {persona.title}</p>
        </div>
        <Button type="button" onClick={() => caseSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}>Generate audit pack</Button>
      </div>
      <div className="rounded-md bg-secondary p-3 text-sm">This is a private evidence workspace — it organises sources and shows what still needs review. It does not determine compliance, calculate CBAM liability or promise grant eligibility. The Slaney Valley content below is a labelled sample; add your own sources in the case panel to build a real audit pack.</div>
    </header>

    {/* Universal search + ingestion bar */}
    <section className={panel} aria-label="Find a location and add evidence">
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={runSearch} className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="place-search">Search any Irish town or county</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input id="place-search" className={field} style={{ marginTop: 0 }} value={query} onChange={e => onQueryChange(e.target.value)} placeholder="e.g. Kilkenny, Carlow, Wexford, Waterford, Dublin" autoComplete="off" />
              {suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-md">
                  {suggestions.map(s => (
                    <li key={`${s.kind}-${s.name}`}>
                      <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => pickSuggestion(s)}>
                        {s.name} <span className="text-muted-foreground">· Co. {s.county}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button type="submit" disabled={searching}>{searching ? 'Searching...' : 'Go'}</Button>
          </div>
          {searchError && <p className="text-sm text-destructive" role="alert">{searchError}</p>}
          <p className="text-xs text-muted-foreground">The map recenters and the data-feed status updates for the county you choose. Coordinates are approximate centres for navigation.</p>
        </form>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-center text-sm transition-colors ${dragging ? 'border-primary bg-secondary' : 'border-border'}`}
        >
          <p className="font-medium">Drop anything to add evidence</p>
          <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, text notes, or MP3/WAV audio. Audio is retained as the original — not auto-transcribed.</p>
          <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.docx,.eml,.txt,.csv,.png,.jpg,.jpeg,.mp3,.wav,.m4a" onChange={e => addFiles(e.target.files)} />
          <Button type="button" variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()}>Choose files</Button>
          <p className="mt-2 text-xs text-muted-foreground">Staged here for review — import them in the case panel below to place them on the audit timeline.</p>
        </div>
      </div>
    </section>

    {/* Three-column investigative workspace */}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
      {/* Left: evidence + progress */}
      <div className="space-y-4">
        <section className={panel} aria-labelledby="evidence-heading">
          <h2 id="evidence-heading" className="font-display text-lg font-semibold">Your evidence</h2>
          <ul className="mt-3 space-y-2">
            {evidence.map(item => (
              <li key={item.id} className="rounded-md border border-border bg-background p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium break-words">{item.kind === 'audio' ? '🎧 ' : '📄 '}{item.name}</span>
                  {item.sample && <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs">sample</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
                {item.preview && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer">{item.kind === 'audio' ? 'About this audio' : 'Preview passage'}</summary>
                    <p className="mt-1 whitespace-pre-wrap break-words">“{item.preview}”{item.locator ? ` — ${item.locator}` : ''}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className={panel} aria-labelledby="progress-heading">
          <h2 id="progress-heading" className="font-display text-lg font-semibold">Investigation progress</h2>
          <p className="mt-1 text-xs text-muted-foreground">Illustrative checklist for the sample review.</p>
          <ul className="mt-3 space-y-2">
            {SAMPLE_PROGRESS.map(step => (
              <li key={step.id} className="flex items-center gap-2 text-sm">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${step.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>{step.done ? '✓' : ''}</span>
                <span className={step.done ? '' : 'text-muted-foreground'}>{step.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Center: map + citation + feeds */}
      <div className="space-y-4">
        <section className={panel} aria-labelledby="map-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="map-heading" className="font-display text-lg font-semibold">Aerial map</h2>
            <div className="flex flex-wrap gap-2">
              {([['water', 'Water'], ['species', 'Species'], ['boundary', 'Site boundary']] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={layers[key]} onClick={() => setLayers(c => ({ ...c, [key]: !c[key] }))} className={`rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${layers[key] ? 'border-primary bg-secondary font-medium' : 'border-border text-muted-foreground'}`}>{layers[key] ? '✓ ' : ''}{label}</button>
              ))}
            </div>
          </div>
          <div className="mt-3 h-[360px] w-full">
            <InvestigationMap lat={place.lat} lng={place.lng} zoom={place.zoom} name={place.name} layers={layers} />
          </div>
          {/* Source citation preview */}
          <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source citation preview</p>
            <p className="mt-1">“{SAMPLE_CITATION.quote}”</p>
            <p className="mt-1 text-xs text-muted-foreground">{SAMPLE_CITATION.locator}</p>
          </div>
        </section>
        <section className={panel} aria-labelledby="feeds-heading">
          <h2 id="feeds-heading" className="font-display text-lg font-semibold">Local data feeds{feeds.county ? ` — Co. ${feeds.county}` : ''}</h2>
          <ul className="mt-3 space-y-2">
            {feeds.feeds.map(feed => (
              <li key={feed.id} className="rounded-md border border-border bg-background p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{feed.label} <span className="text-muted-foreground">· {feed.agency}</span></span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${feed.status === 'available' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>{feed.status === 'available' ? 'available' : feed.status === 'unverified' ? 'unverified' : 'not wired'}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{feed.note}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Right: review cards + prompts + audit pack */}
      <div className="space-y-4">
        <section className={panel} aria-labelledby="review-heading">
          <h2 id="review-heading" className="font-display text-lg font-semibold">3 things to review</h2>
          <div className="mt-3 space-y-3">
            {SAMPLE_REVIEW_CARDS.map(card => (
              <article key={card.id} className="rounded-md border border-border bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.kind}</p>
                <h3 className="mt-1 text-sm font-semibold">{card.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
                <button type="button" onClick={() => setActivePrompt(card.prompt)} className="mt-2 rounded-full border border-primary/50 bg-secondary px-3 py-1 text-xs font-medium hover:bg-secondary/70">Use this prompt</button>
              </article>
            ))}
          </div>
        </section>
        <section className={panel} aria-labelledby="prompts-heading">
          <h2 id="prompts-heading" className="font-display text-lg font-semibold">Suggested prompts</h2>
          <p className="mt-1 text-xs text-muted-foreground">Questions to guide your review. Your source content stays private and is not sent to an AI.</p>
          <ul className="mt-3 space-y-2">
            {persona.prompts.map((prompt, index) => (
              <li key={index}><button type="button" onClick={() => setActivePrompt(prompt)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:bg-secondary">{prompt}</button></li>
            ))}
          </ul>
          {activePrompt && <p className="mt-3 rounded-md bg-secondary p-3 text-sm">Working prompt: “{activePrompt}”</p>}
        </section>
        <section className={panel} aria-labelledby="audit-heading">
          <h2 id="audit-heading" className="font-display text-lg font-semibold">{SAMPLE_AUDIT_PACK.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{SAMPLE_AUDIT_PACK.summary}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {SAMPLE_AUDIT_PACK.includes.map((line, index) => <li key={index} className="flex gap-2"><span aria-hidden>•</span><span>{line}</span></li>)}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{SAMPLE_AUDIT_PACK.excludes}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => caseSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}>Build in case panel</Button>
        </section>
      </div>
    </div>

    {/* Timeline rail + compare */}
    <section className={panel} aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="font-display text-lg font-semibold">Chronological timeline</h2>
      <p className="mt-1 text-xs text-muted-foreground">Sample sequence linking the key events in this review.</p>
      <ol className="mt-4 flex flex-col gap-3 md:flex-row md:items-stretch md:gap-0">
        {SAMPLE_TIMELINE.map((event, index) => (
          <li key={event.id} className="flex items-start gap-3 md:flex-1 md:flex-col">
            <div className="flex items-center gap-2 md:w-full">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary bg-secondary text-xs font-semibold">{index + 1}</span>
              {index < SAMPLE_TIMELINE.length - 1 && <span className="hidden h-px flex-1 bg-border md:block" aria-hidden />}
            </div>
            <div className="rounded-md border border-border bg-background p-3 md:mr-3 md:mt-2">
              <p className="text-xs font-medium text-muted-foreground">{event.date}</p>
              <p className="text-sm font-semibold">{event.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6">
        <h3 className="text-sm font-semibold">Compare source passages</h3>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {[SAMPLE_COMPARE.left, SAMPLE_COMPARE.right].map((side, index) => (
            <blockquote key={index} className="rounded-md border-l-4 border-primary/50 bg-background p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">{side.source}</p>
              <p className="mt-1 whitespace-pre-wrap break-words">“{side.text}”</p>
            </blockquote>
          ))}
        </div>
      </div>
    </section>

    {/* Real backend: cases + private evidence */}
    <div ref={caseSectionRef} className="space-y-3">
      <div className="rounded-md bg-secondary p-3 text-sm">Add and review your own sources here. This is where evidence is imported privately, placed on the timeline, and exported as a reviewed audit pack. Nothing above replaces this — it is a worked sample.</div>
      <CaseBoard key={workspaceId} workspaceId={workspaceId} defaultTemplate={persona.template} reportTitle={persona.exportTitle} />
    </div>
  </div>
}

function CaseBoard({ workspaceId, defaultTemplate, reportTitle }: { workspaceId: string; defaultTemplate: string; reportTitle: string }) {
  const [cases, setCases] = useState<Case[]>([])
  const [title, setTitle] = useState('')
  const [template, setTemplate] = useState(defaultTemplate)
  const [sites, setSites] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setCases([]); setSelected(''); setError('')
    workspaceRequest(caseListPath(workspaceId), { signal: controller.signal })
      .then((data: { cases: Case[] }) => { if (!controller.signal.aborted) { if (!Array.isArray(data.cases)) throw new Error('Unexpected case response. Please retry.'); setCases(data.cases) } })
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
      setCases(current => [data.case, ...current]); setSelected(data.case.id); setTitle(''); setSites('')
    } catch (e) { setError(message(e)) } finally { setSaving(false) }
  }
  return <div className="space-y-6">
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
        {loading ? <p className="mt-4" role="status">Loading cases...</p> : cases.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{error ? 'Cases could not be loaded.' : 'No cases available to your account in this workspace. Create the first one when you are ready.'}</p> : <ul className="mt-4 space-y-3">{cases.map(item => <li key={item.id}><button type="button" className={`w-full rounded-md border p-3 text-left focus-visible:ring-2 focus-visible:ring-ring ${selected === item.id ? 'border-primary bg-secondary' : 'border-border'}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><span className="block font-medium break-words">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{templates.find(template => template.id === item.template)?.label ?? 'Case'} · Created {displayDate(item.createdAt)}</span></button></li>)}</ul>}
      </section>
    </div>
    {selected && <CaseSummary key={selected} workspaceId={workspaceId} caseId={selected} onSelectCase={setSelected} reportTitle={reportTitle} />}
  </div>
}

function CaseSummary({ workspaceId, caseId, onSelectCase, reportTitle }: { workspaceId: string; caseId: string; onSelectCase:(id:string)=>void; reportTitle: string }) {
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
  return <section className={panel} aria-labelledby="case-detail-heading"><h2 id="case-detail-heading" className="font-display text-xl font-semibold break-words">{item.title}</h2><p className="mt-1 text-xs text-muted-foreground">Case created {displayDate(item.createdAt)} — not an event date.</p><details className="mt-4"><summary className="cursor-pointer font-medium">Sites and facilities ({item.sites.length})</summary>{item.sites.length ? <ul className="mt-2 space-y-2">{item.sites.map(site => <li key={site.id} className="rounded bg-secondary p-3 text-sm break-words">{site.name}<span className="block text-xs text-muted-foreground">{site.latitude !== null && site.longitude !== null ? `${site.latitude}, ${site.longitude} — supplied coordinates` : 'Coordinates not supplied'}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No sites were added to this case.</p>}</details><CaseEvidence key={caseId} workspaceId={workspaceId} caseId={caseId} onSelectCase={onSelectCase} reportTitle={reportTitle}/></section>
}
