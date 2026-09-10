'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { displayDate, workspaceRequest } from './workspace-client.mjs'
import { personas } from './personas.mjs'

type Workspace = { id: string; name: string; createdAt: string }
type Persona = (typeof personas)[number]
const panel = 'rounded-lg border border-border bg-card p-5'
const message = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.'

function Failure({ text }: { text: string }) {
  return <div role="alert" className="rounded-md border border-destructive p-3 text-sm"><p>{text}</p><Link className="mt-2 inline-block underline" href="/login?callbackUrl=/workspace">Sign in again</Link></div>
}

export function WorkspaceDashboard() {
  const { data: session, status } = useSession()
  if (status === 'loading') return <p role="status">Checking your session...</p>
  if (status !== 'authenticated' || !session?.user?.id) return <Failure text="Sign in to open your private workspace." />
  return <AccountWorkspace key={session.user.id} />
}

function AccountWorkspace() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setWorkspaces([])
    workspaceRequest('/api/workspaces', { signal: controller.signal })
      .then((data: { workspaces: Workspace[] }) => {
        if (controller.signal.aborted) return
        if (!Array.isArray(data.workspaces)) throw new Error('Unexpected workspace response. Please retry.')
        setWorkspaces(data.workspaces)
      }).catch((e: unknown) => { if (!controller.signal.aborted) setError(message(e)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])

  async function startPersona(persona: Persona) {
    if (creating) return
    setCreating(persona.key); setError('')
    try {
      const data = await workspaceRequest('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: persona.title }) })
      if (!data.workspace?.id) throw new Error('Unexpected save response. Refresh before trying again.')
      router.push(`/workspace/${encodeURIComponent(data.workspace.id)}?persona=${encodeURIComponent(persona.key)}`)
    } catch (e) { setError(message(e)); setCreating('') }
  }

  return <div className="space-y-6">
    <header><h1 className="font-display text-3xl font-bold tracking-tight">My workspace</h1><p className="mt-2 max-w-2xl text-muted-foreground">Pick a starting point, then organise sources, review events and build a case you can trace back to the evidence.</p></header>
    <div className="rounded-md bg-secondary p-4 text-sm">Use only records you are authorised to hold. No identifiable child material. This workspace does not determine compliance, calculate CBAM liability or promise grant eligibility.</div>
    {error && <Failure text={error} />}

    <section aria-labelledby="persona-heading" className="space-y-4">
      <div><h2 id="persona-heading" className="font-display text-xl font-semibold">Start a new workspace</h2><p className="mt-1 text-sm text-muted-foreground">Every choice opens the same universal canvas — drop PDFs, audio or text notes. The preset only sets your default map layers, export title and suggested prompts. You can change everything later.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {personas.map(persona => {
          const defaults = persona.layers.filter(layer => layer.default).map(layer => layer.label)
          const busy = creating === persona.key
          return <article key={persona.key} className={`${panel} flex flex-col`} data-persona={persona.key}>
            <h3 className="font-display text-lg font-semibold">{persona.title}</h3>
            <p className="mt-1 text-sm font-medium text-primary">{persona.tagline}</p>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{persona.description}</p>
            <p className="mt-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">Default layers:</span> {defaults.length ? defaults.join(', ') : 'None on by default'}</p>
            <Button className="mt-4" type="button" disabled={!!creating} onClick={() => startPersona(persona)}>{busy ? 'Creating...' : 'Open canvas'}</Button>
          </article>
        })}
      </div>
    </section>

    <section className={panel} aria-labelledby="existing-heading">
      <div className="flex items-center justify-between gap-3"><h2 id="existing-heading" className="font-display text-xl font-semibold">Your workspaces</h2><Button variant="outline" type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh</Button></div>
      {loading ? <p className="mt-4" role="status">Loading your workspaces...</p> : workspaces.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No workspaces yet. Choose a starting point above; team invitations are not available yet.</p> : <ul className="mt-4 space-y-3">{workspaces.map(item => <li key={item.id}><Link href={`/workspace/${encodeURIComponent(item.id)}`} className="block rounded-md border border-border p-3 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block font-medium break-words">{item.name}</span><span className="mt-1 block text-xs text-muted-foreground">Created {displayDate(item.createdAt)}</span></Link></li>)}</ul>}
    </section>
  </div>
}
