'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { displayDate } from './workspace-client.mjs'

type Report = { id: string; title: string; createdAt: string; requestedBy: string; acceptedCount: number; version: string; rendererVersion: string; hash: string }

async function readJson(url: string) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
  if (!response.ok) { let msg = 'Request failed'; try { const data = await response.json(); if (typeof data.error === 'string') msg = data.error } catch {} throw new Error(msg) }
  return response.json()
}
const textError = (e: unknown) => (e instanceof Error ? e.message : 'Request failed')
const safeName = (t: string) => t.replace(/[^a-z0-9-_ ]/gi, '').trim().slice(0, 80) || 'case-report'

// Persistent, permissioned report history shared by both export controls (workspace canvas and
// the case-evidence Export tab). Reports are discoverable after reload, case switch and sign-in;
// reopening streams the original saved PDF/manifest, which the server verifies against its stored
// hash. Access stays requester-only, matching the existing download restriction.
export function ReportsPanel({ workspaceId, caseId, refreshToken = 0 }: { workspaceId: string; caseId: string; refreshToken?: number }) {
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/cases/${encodeURIComponent(caseId)}/evidence`
  const [reports, setReports] = useState<Report[]>([])
  const [total, setTotal] = useState(0)
  const [retentionCap, setRetentionCap] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true); setError('')
    return readJson(`${endpoint}?action=exports`)
      .then(data => { if (!signal?.aborted) { setReports(data.exports ?? []); setTotal(data.total ?? 0); setRetentionCap(data.retentionCap ?? 20) } })
      .catch(e => { if (!signal?.aborted) setError(textError(e)) })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [endpoint])

  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort() }, [load, refreshToken])

  async function download(url: string, name: string) {
    setBusy(name); setError('')
    try {
      const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
      if (!response.ok) { let msg = 'Download failed'; try { const data = await response.json(); if (typeof data.error === 'string') msg = data.error } catch {} throw new Error(msg) }
      const blob = await response.blob(); const object = URL.createObjectURL(blob); const a = document.createElement('a')
      a.href = object; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(object), 1000)
    } catch (e) { setError(textError(e)) } finally { setBusy('') }
  }

  return <div className="space-y-3" aria-label="Saved reports">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-semibold">Saved reports{total > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">({total} of {retentionCap} retained)</span>}</h4>
      <Button variant="outline" size="sm" disabled={loading} onClick={() => load()}>Refresh list</Button>
    </div>
    <p className="text-xs text-muted-foreground">Reports stay available after reload, case switching and sign-out. Only the person who issued a report can reopen it; reopening returns the original saved PDF and manifest, verified against its stored hash.</p>
    {error && <p role="alert" className="rounded border border-destructive p-2 text-sm">{error}</p>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">Loading saved reports...</p>
      : reports.length === 0 ? <p className="text-sm text-muted-foreground">No reports saved yet. Create a reviewed PDF to keep a permanent, re-openable record.</p>
      : <ul className="space-y-2">{reports.map(r => <li key={r.id} className="rounded border p-3 text-sm space-y-1">
          <p className="font-medium break-words">{r.title}</p>
          <p className="text-xs text-muted-foreground">Issued {displayDate(r.createdAt)} · {r.acceptedCount} accepted {r.acceptedCount === 1 ? 'entry' : 'entries'} · manifest v{r.version} · {r.rendererVersion || 'renderer n/a'}</p>
          <p className="text-xs text-muted-foreground break-all">Report ID {r.id}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => download(`${endpoint}?action=export&id=${encodeURIComponent(r.id)}`, `${safeName(r.title)}.pdf`)}>Download PDF</Button>
            <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => download(`${endpoint}?action=export&id=${encodeURIComponent(r.id)}&format=json`, `${safeName(r.title)}-manifest.json`)}>Download manifest</Button>
          </div>
        </li>)}</ul>}
  </div>
}
