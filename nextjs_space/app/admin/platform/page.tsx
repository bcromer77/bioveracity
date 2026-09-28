import type { ReactNode } from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { adapter } from '@/lib/v1/http'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { EvidenceLink } from '@/components/evidence-link'
import { operatorAccess } from '@/lib/v1-operator/access'
import { loadPlatformOperatorView, type OperatorView } from '@/lib/v1-operator/view'

export const dynamic = 'force-dynamic'

// Operator-only, READ-ONLY view of Developer Platform V1 traffic:
// request → raw → evidence → processing state → provenance. No actions.
export default async function AdminPlatformPage() {
  const access = operatorAccess(await auth())
  if (access === 'unauthenticated') redirect('/login')
  if (access !== 'allowed') redirect('/')

  let view: OperatorView | null = null
  try {
    view = await loadPlatformOperatorView(adapter(prisma))
  } catch {
    view = null
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <header className="mb-8">
            <p className="text-sm text-muted-foreground">Operator view · read-only</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Developer Platform V1 evidence</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Each submission is traced from request to raw record to evidence, with its processing state and provenance.
              Raw bodies, source data and credentials are never shown here.
            </p>
          </header>
          {!view ? (
            <p className="rounded-lg border bg-card p-6 text-[15px] text-muted-foreground">The platform records could not be read.</p>
          ) : (
            <OperatorPanels view={view} />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

const Mono = ({ children }: { children: ReactNode }) => <code className="break-all font-mono text-xs">{children}</code>
const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '—' : v)

function OperatorPanels({ view }: { view: OperatorView }) {
  const tiles = [
    { label: 'Requests', value: view.counts.requests },
    { label: 'Raw records', value: view.counts.raw },
    { label: 'Evidence', value: view.counts.evidence },
    { label: 'Active keys', value: view.counts.active_keys },
    ...Object.entries(view.counts.by_status).map(([s, c]) => ({ label: s, value: c })),
  ]
  return (
    <>
      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-semibold tabular-nums">{t.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t.label}</div>
          </div>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Evidence chains</h2>
        {view.chains.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-[15px] text-muted-foreground">No evidence has been recorded.</p>
        ) : (
          <div className="space-y-4">
            {view.chains.map(({ evidence: e, raw, requests }) => (
              <article key={e.id} className="rounded-lg border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Mono>{e.id}</Mono>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{e.mode}</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{e.processing_status}</span>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  <div><dt className="inline text-muted-foreground">Provider / type: </dt><dd className="inline">{e.provider} · {e.evidence_type}</dd></div>
                  <div><dt className="inline text-muted-foreground">External id: </dt><dd className="inline">{dash(e.source_external_id)}</dd></div>
                  <div><dt className="inline text-muted-foreground">Publisher: </dt><dd className="inline">{dash(e.publisher)}</dd></div>
                  <div>
                    <dt className="inline text-muted-foreground">Source: </dt>
                    <dd className="inline">{e.source_url ? <EvidenceLink className="underline break-all" href={e.source_url}>{e.source_url}</EvidenceLink> : '—'}</dd>
                  </div>
                  <div><dt className="inline text-muted-foreground">Published / observed: </dt><dd className="inline">{dash(e.publication_time)} / {dash(e.observation_time)} ({dash(e.observation_precision)})</dd></div>
                  <div><dt className="inline text-muted-foreground">Retrieved / recorded: </dt><dd className="inline">{dash(e.retrieval_time)} / {dash(e.created_at)}</dd></div>
                  <div><dt className="inline text-muted-foreground">Raw: </dt><dd className="inline">{raw ? <><Mono>{raw.id}</Mono> · {raw.bytes} bytes · <Mono>{raw.payload_fingerprint.slice(0, 16)}</Mono></> : '—'}</dd></div>
                  <div><dt className="inline text-muted-foreground">Key: </dt><dd className="inline"><Mono>{e.api_key_id}</Mono></dd></div>
                  {e.processing_error ? <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Processing error: </dt><dd className="inline">{e.processing_error}</dd></div> : null}
                </dl>
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requests</p>
                  <ul className="mt-1 space-y-1">
                    {requests.map((r) => (
                      <li key={r.id}><Mono>{r.id}</Mono> · {r.method} {r.path} · {r.status} · {Array.isArray(r.trace) ? (r.trace as { stage: string }[]).map((t) => t.stage).join(' → ') : '—'}</li>
                    ))}
                  </ul>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">Provenance</summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(e.provenance, null, 2)}</pre>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent requests</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Request</th>
                <th className="px-3 py-2 font-medium">Mode</th>
                <th className="px-3 py-2 font-medium">Route</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Error</th>
                <th className="px-3 py-2 font-medium">Evidence</th>
                <th className="px-3 py-2 font-medium">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {view.recent_requests.map((r) => (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="px-3 py-2"><Mono>{r.id}</Mono></td>
                  <td className="px-3 py-2">{dash(r.mode)}</td>
                  <td className="px-3 py-2">{r.method} {r.path}</td>
                  <td className="px-3 py-2 tabular-nums">{r.status}</td>
                  <td className="px-3 py-2">{dash(r.error_code)}</td>
                  <td className="px-3 py-2">{r.evidence_id ? <Mono>{r.evidence_id}</Mono> : '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{dash(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
