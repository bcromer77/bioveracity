'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SafeDate } from '@/components/safe-format'

interface Tile {
  key: string
  label: string
  value: number
}

interface Candidate {
  id: string
  title: string | null
  candidateType: string | null
  assetName: string | null
  resolutionStatus: string | null
  status: string
  verificationMethod: string | null
  verificationNote: string | null
  rejectionReason: string | null
  normalisedTargetType: string | null
  normalisedRecordType: string | null
  normalisedRecordId: string | null
  sourceUrl: string | null
}

interface Row {
  id: string
  sourceAgent: string | null
  category: string | null
  assetName: string | null
  assetSlug: string | null
  targetRegion: string | null
  demoTag: string | null
  receivedAt: string
  schemaVersion: string | null
  stream: string | null
  observationCount: number
  commercialCount: number
  entityCandidateCount: number
  duplicateHits: number
  status: string
  error: string | null
  rawPayload: unknown
  candidates: Candidate[]
}

const CAND_STATUS_STYLES: Record<string, string> = {
  CANDIDATE: 'bg-muted text-foreground',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-900',
  VERIFIED: 'bg-muted text-foreground',
  NORMALISED: 'bg-muted text-foreground',
  PUBLISHED: 'bg-emerald-100 text-emerald-900',
  REJECTED: 'bg-destructive/10 text-destructive',
}

const STATUS_STYLES: Record<string, string> = {
  FOUND: 'bg-muted text-foreground',
  PARSED: 'bg-accent text-accent-foreground',
  VERIFICATION_PENDING: 'bg-muted text-foreground',
  VERIFIED: 'bg-muted text-foreground',
  NORMALISED: 'bg-muted text-foreground',
  PUBLISHED: 'bg-muted text-foreground',
  FAILED: 'bg-destructive text-destructive-foreground',
}

function statusLabel(s: string) {
  return s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function IngestMonitor({ tiles, rows }: { tiles: Tile[]; rows: Row[] }) {
  const router = useRouter()
  const [open, setOpen] = useState<Row | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function runAction(candidateId: string, action: 'verify' | 'reject' | 'normalise' | 'publish') {
    setActionError(null)
    let reason: string | undefined
    if (action === 'verify') {
      const input = window.prompt('After checking the original source, explain how the retained source_excerpt and source_locator support this claim (at least 30 characters):')
      if (!input || input.trim().length < 30) { setActionError('A substantive source-review explanation is required.'); return }
      reason = input.trim()
    }
    if (action === 'reject') {
      const input = window.prompt('Reason for rejecting this candidate (optional):') ?? undefined
      reason = input
    }
    setBusyId(candidateId)
    try {
      const res = await fetch('/api/admin/ingest/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, action, reason }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setActionError(data?.error ?? 'Action failed.')
      } else {
        setOpen(null)
        router.refresh()
      }
    } catch (e: any) {
      setActionError(String(e?.message ?? e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Ingest monitor</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Direct machine-to-machine ingest
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Every payload BioVeracity receives is stored in full before anything is
          interpreted. Incoming records are candidates and proposals for review —
          they do not become public evidence automatically.
        </p>
      </header>

      {/* Status tiles */}
      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.key} className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-semibold tabular-nums">{t.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t.label}</div>
          </div>
        ))}
      </section>

      {/* Payload table */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Received payloads</h2>
        {rows.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-[15px] text-muted-foreground">
            No payloads have been received yet. When BioVeracity Scout posts a
            schema 2.1 payload to the ingest endpoint, it will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Source agent</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Asset / place</th>
                  <th className="px-3 py-2 font-medium">Region</th>
                  <th className="px-3 py-2 font-medium">Received</th>
                  <th className="px-3 py-2 font-medium">Schema</th>
                  <th className="px-3 py-2 font-medium">Stream</th>
                  <th className="px-3 py-2 font-medium text-right">Obs.</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium">Raw</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2">{r.sourceAgent ?? '—'}</td>
                    <td className="px-3 py-2">{r.category ?? '—'}</td>
                    <td className="px-3 py-2">
                      {r.assetName ? (
                        <span>{r.assetName}</span>
                      ) : (
                        <span className="text-muted-foreground">Unresolved</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.targetRegion ?? '—'}
                      {r.demoTag ? (
                        <span className="ml-1 inline-block rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground align-middle">
                          {r.demoTag}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <SafeDate date={r.receivedAt} options={{ dateStyle: 'medium', timeStyle: 'short' }} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.schemaVersion ?? '—'}</td>
                    <td className="px-3 py-2">{r.stream ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.observationCount}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[r.status] ?? 'bg-muted text-foreground'
                        }`}
                      >
                        {statusLabel(r.status)}
                      </span>
                      {r.duplicateHits > 0 ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          +{r.duplicateHits} dup
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setOpen(r)}
                        className="text-[hsl(var(--link))] underline underline-offset-2"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Raw JSON inspector */}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="my-8 w-full max-w-3xl rounded-lg border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Raw payload</h3>
                <p className="text-sm text-muted-foreground">
                  {open.sourceAgent ?? 'Unknown agent'} · {open.observationCount} observation(s) ·{' '}
                  {open.commercialCount} commercial · {open.entityCandidateCount} entity proposal(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="text-[hsl(var(--link))] underline underline-offset-2"
              >
                Close
              </button>
            </div>
            {open.error ? (
              <p className="mb-3 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {open.error}
              </p>
            ) : null}
            {actionError ? (
              <p className="mb-3 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </p>
            ) : null}

            {/* Candidate review — the human-review gate. Nothing is public until
                a candidate is verified, normalised, then published. */}
            {open.candidates.length > 0 ? (
              <div className="mb-4">
                <h4 className="mb-2 text-sm font-semibold">
                  Observation candidates ({open.candidates.length})
                </h4>
                <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                  Candidates are proposals. Verify only what can be checked against a trusted
                  source, then normalise and publish. Publishing is the only step that writes a
                  public evidence record.
                </p>
                <ul className="space-y-3">
                  {open.candidates.map((c) => {
                    const busy = busyId === c.id
                    return (
                      <li key={c.id} className="rounded-lg border bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {c.title ?? 'Untitled candidate'}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {c.candidateType ?? 'Unknown type'} ·{' '}
                              {c.assetName ? c.assetName : <span className="italic">Unresolved asset</span>}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                              CAND_STATUS_STYLES[c.status] ?? 'bg-muted text-foreground'
                            }`}
                          >
                            {statusLabel(c.status)}
                          </span>
                        </div>

                        {c.verificationNote ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {c.verificationMethod ? `${statusLabel(c.verificationMethod)}: ` : ''}
                            {c.verificationNote}
                          </p>
                        ) : null}
                        {c.rejectionReason ? (
                          <p className="mt-2 text-xs text-destructive">Rejected: {c.rejectionReason}</p>
                        ) : null}
                        {c.normalisedTargetType ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Normalisation target: {c.normalisedTargetType}
                            {c.normalisedRecordId ? ` · published as ${c.normalisedRecordType} (${c.normalisedRecordId.slice(0, 8)}…)` : ''}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {(c.status === 'CANDIDATE' || c.status === 'NEEDS_REVIEW') ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => runAction(c.id, 'verify')}
                              className="rounded border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                            >
                              {busy ? 'Working…' : 'Verify'}
                            </button>
                          ) : null}
                          {c.status === 'VERIFIED' ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => runAction(c.id, 'normalise')}
                              className="rounded border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                            >
                              {busy ? 'Working…' : 'Normalise'}
                            </button>
                          ) : null}
                          {c.status === 'NORMALISED' ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => runAction(c.id, 'publish')}
                              className="rounded border border-emerald-600/40 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {busy ? 'Working…' : 'Publish'}
                            </button>
                          ) : null}
                          {c.status !== 'PUBLISHED' && c.status !== 'REJECTED' ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => runAction(c.id, 'reject')}
                              className="rounded border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                            >
                              {busy ? 'Working…' : 'Reject'}
                            </button>
                          ) : null}
                          {c.sourceUrl ? (
                            <a
                              href={c.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded px-2.5 py-1 text-xs font-medium text-[hsl(var(--link))] underline underline-offset-2"
                            >
                              Source
                            </a>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            <h4 className="mb-2 text-sm font-semibold">Raw payload</h4>
            <pre className="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs leading-relaxed">
              {JSON.stringify(open.rawPayload, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  )
}
