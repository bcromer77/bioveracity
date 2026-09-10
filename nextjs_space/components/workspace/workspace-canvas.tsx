'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { caseListPath, casePayload, displayDate, templates, workspaceRequest } from './workspace-client.mjs'
import { getPersona } from './personas.mjs'
import { CaseEvidence } from './case-evidence'

type Case = { id: string; workspaceId: string; title: string; template: string; createdAt: string }
type CaseDetail = Case & { sites: { id: string; name: string; latitude: number | null; longitude: number | null }[] }
type Persona = ReturnType<typeof getPersona>
const field = 'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const panel = 'rounded-lg border border-border bg-card p-5'
const message = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.'

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
  const [layers, setLayers] = useState(() => Object.fromEntries(persona.layers.map(layer => [layer.id, layer.default])))
  return <div className="space-y-6">
    <header className="space-y-1">
      <p className="text-sm"><Link href="/workspace" className="underline">← All workspaces</Link></p>
      <h1 className="font-display text-3xl font-bold tracking-tight">{persona.title}</h1>
      <p className="text-muted-foreground">{persona.tagline}</p>
    </header>
    <div className="rounded-md bg-secondary p-4 text-sm">Universal canvas — drop PDFs, audio (MP3/WAV) or text notes. The preset below only sets your default map layers, export title and suggested prompts; it does not change what you can add or how sources are stored. This workspace does not determine compliance, calculate CBAM liability or promise grant eligibility.</div>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className={panel} aria-labelledby="layers-heading">
        <h2 id="layers-heading" className="font-display text-lg font-semibold">Map layers</h2>
        <p className="mt-1 text-sm text-muted-foreground">Presets for this persona. Toggle any layer — this only sets your working view.</p>
        <div className="mt-3 flex flex-wrap gap-2">{persona.layers.map(layer => {
          const on = layers[layer.id]
          return <button key={layer.id} type="button" aria-pressed={on} onClick={() => setLayers(current => ({ ...current, [layer.id]: !current[layer.id] }))} className={`rounded-full border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? 'border-primary bg-secondary font-medium' : 'border-border text-muted-foreground'}`}>{on ? '✓ ' : ''}{layer.label}</button>
        })}</div>
      </section>
      <section className={panel} aria-labelledby="prompts-heading">
        <h2 id="prompts-heading" className="font-display text-lg font-semibold">Suggested prompts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Questions to guide your review. Your source content stays private and is not sent to an AI.</p>
        <ul className="mt-3 space-y-2">{persona.prompts.map((prompt, index) => <li key={index} className="rounded-md border border-border bg-background px-3 py-2 text-sm">{prompt}</li>)}</ul>
      </section>
    </div>

    <CaseBoard key={workspaceId} workspaceId={workspaceId} defaultTemplate={persona.template} reportTitle={persona.exportTitle} />
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
