'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { caseListPath, casePayload, displayDate, templates, workspaceRequest } from './workspace-client.mjs'

type Workspace = { id: string; name: string; createdAt: string }
type Case = { id: string; workspaceId: string; title: string; template: string; createdAt: string }
type CaseDetail = Case & { sites: { id: string; name: string; latitude: number | null; longitude: number | null }[] }
const field = 'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const panel = 'rounded-lg border border-border bg-card p-5'
const message = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.'

function Failure({ text }: { text: string }) {
  return <div role="alert" className="rounded-md border border-destructive p-3 text-sm"><p>{text}</p><Link className="mt-2 inline-block underline" href="/login?callbackUrl=/workspace">Sign in again</Link></div>
}

export function WorkspaceDashboard() {
  const { data: session, status } = useSession()
  if (status === 'loading') return <p role="status">Checking your session…</p>
  if (status !== 'authenticated' || !session?.user?.id) return <Failure text="Sign in to open your private workspace." />
  return <AccountWorkspace key={session.user.id} />
}

function AccountWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setWorkspaces([]); setSelected('')
    workspaceRequest('/api/workspaces', { signal: controller.signal })
      .then((data: { workspaces: Workspace[] }) => {
        if (controller.signal.aborted) return
        if (!Array.isArray(data.workspaces)) throw new Error('Unexpected workspace response. Please retry.')
        setWorkspaces(data.workspaces); setSelected(data.workspaces[0]?.id ?? '')
      }).catch((e: unknown) => { if (!controller.signal.aborted) setError(message(e)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !name.trim()) return
    setSaving(true); setError('')
    try {
      const data = await workspaceRequest('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
      if (!data.workspace?.id) throw new Error('Unexpected save response. Refresh before trying again.')
      setWorkspaces(current => [...current, data.workspace]); setSelected(data.workspace.id); setName('')
    } catch (e) { setError(message(e)) } finally { setSaving(false) }
  }

  return <div className="space-y-6">
    <header><p className="text-sm text-muted-foreground">Private case organisation · early release</p><h1 className="font-display text-3xl font-bold tracking-tight">My workspace</h1><p className="mt-2 max-w-2xl text-muted-foreground">Give each decision a home. Organise cases and sites now; evidence import, source-linked timelines and reviewed exports are not available in this release.</p></header>
    <div className="rounded-md bg-secondary p-4 text-sm">Do not paste confidential evidence or identifiable child material into case titles or site names. This release stores case metadata only. It does not calculate CBAM liability, verify compliance or promise grant eligibility.</div>
    {error && <Failure text={error} />}
    {loading ? <p role="status">Loading your workspaces…</p> : <>
      <section className={panel} aria-labelledby="workspace-heading">
        <h2 id="workspace-heading" className="font-display text-xl font-semibold">Choose a workspace</h2>
        {workspaces.length > 0 ? <label className="mt-3 block text-sm">Workspace<select className={field} value={selected} onChange={e => setSelected(e.target.value)}>{workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : !error && <p className="mt-2 text-sm text-muted-foreground">No workspaces yet. Create one for your own cases; team invitations are not available yet.</p>}
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={createWorkspace}>
          <label className="min-w-0 flex-1 text-sm">New workspace name<input className={field} value={name} onChange={e => setName(e.target.value)} required maxLength={120} placeholder="For example, Development review" disabled={saving} /></label>
          <Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Creating…' : 'Create workspace'}</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => setRevision(value => value + 1)}>Refresh</Button>
        </form>
      </section>
      {selected && <CaseBoard key={selected} workspaceId={selected} />}
    </>}
  </div>
}

function CaseBoard({ workspaceId }: { workspaceId: string }) {
  const [cases, setCases] = useState<Case[]>([])
  const [title, setTitle] = useState('')
  const [template, setTemplate] = useState('PLANNING')
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
          <Button type="submit" disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Create case'}</Button>
        </form>
      </section>
      <section className={panel} aria-labelledby="cases-heading"><div className="flex items-center justify-between gap-3"><h2 id="cases-heading" className="font-display text-xl font-semibold">Your cases</h2><Button variant="outline" type="button" disabled={loading || saving} onClick={() => setRevision(value => value + 1)}>Refresh</Button></div>
        {loading ? <p className="mt-4" role="status">Loading cases…</p> : cases.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{error ? 'Cases could not be loaded.' : 'No cases available to your account in this workspace. Create the first one when you are ready.'}</p> : <ul className="mt-4 space-y-3">{cases.map(item => <li key={item.id}><button type="button" className={`w-full rounded-md border p-3 text-left focus-visible:ring-2 focus-visible:ring-ring ${selected === item.id ? 'border-primary bg-secondary' : 'border-border'}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><span className="block font-medium break-words">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{templates.find(template => template.id === item.template)?.label ?? 'Case'} · Created {displayDate(item.createdAt)}</span></button></li>)}</ul>}
      </section>
    </div>
    {selected && <CaseSummary key={selected} workspaceId={workspaceId} caseId={selected} />}
  </div>
}

function CaseSummary({ workspaceId, caseId }: { workspaceId: string; caseId: string }) {
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
  if (!item) return <p role="status">Loading case details…</p>
  return <section className={panel} aria-labelledby="case-detail-heading"><h2 id="case-detail-heading" className="font-display text-xl font-semibold break-words">{item.title}</h2><p className="mt-1 text-xs text-muted-foreground">Case created {displayDate(item.createdAt)} — not an event date.</p><h3 className="mt-5 font-medium">Sites and facilities</h3>{item.sites.length ? <ul className="mt-2 space-y-2">{item.sites.map(site => <li key={site.id} className="rounded bg-secondary p-3 text-sm break-words">{site.name}<span className="block text-xs text-muted-foreground">{site.latitude !== null && site.longitude !== null ? `${site.latitude}, ${site.longitude} — supplied coordinates` : 'Coordinates not supplied'}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No sites were added to this case.</p>}<p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">Evidence import, email attachments, search, timeline, map comparisons and PDF export are not enabled here yet. No evidence has been assessed by creating this case.</p></section>
}
