'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { analyseDocumentText, Citation } from '@/lib/workspaces/document-intelligence'

type Report = ReturnType<typeof analyseDocumentText>
async function request(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Document checks could not complete.')
  return data
}
function Source({ source }: { source: Citation }) {
  return <details className="rounded border p-3 text-sm">
    <summary className="cursor-pointer font-medium">{source.documentName} · {source.locator}{source.superseded ? ' · earlier version' : ''}</summary>
    <blockquote className="mt-2 whitespace-pre-wrap border-l-2 pl-3">{source.quote}</blockquote>
    <p className="mt-2 text-xs text-muted-foreground">Exact extracted passage, characters {source.start}–{source.end}. Check the original for layout and context.</p>
  </details>
}
export function DocumentIntelligence({ endpoint, documents, revision }: { endpoint: string; documents: { id: string; name: string }[]; revision: number }) {
  const [checks, setChecks] = useState<{ id: string; question: string }[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [target, setTarget] = useState('')
  const [result, setResult] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const analysis = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setChecks([]); setSelected([]); setTarget(''); setError('')
    request(`${endpoint}?action=intelligenceChecks`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setChecks(data.checks) })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load checks.') })
    return () => controller.abort()
  }, [endpoint])
  useEffect(() => {
    analysis.current?.abort(); setResult(null); setBusy(false)
    return () => analysis.current?.abort()
  }, [endpoint, target, selected, revision])
  async function run() {
    if (!target || !selected.length || busy) return
    analysis.current?.abort()
    const controller = new AbortController(); analysis.current = controller
    setBusy(true); setError(''); setResult(null)
    try {
      const data = await request(endpoint, { method: 'POST', body: JSON.stringify({ action: 'analyse', documentId: target, checkIds: selected }), signal: controller.signal })
      if (!controller.signal.aborted) setResult(data)
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Document checks could not complete.')
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <section className="rounded-lg border bg-card p-5 space-y-4" aria-label="Document intelligence">
    <h2 className="text-xl font-semibold">What does this report say—and leave unresolved?</h2>
    <p className="text-sm text-muted-foreground">Early document checks: compare observation wording and look for topics you expect the report to discuss. These are limited text rules, not AI interpretation. Nothing is sent to an external service.</p>
    <label className="block text-sm font-medium">Report to check
      <select className="mt-1 block w-full rounded border bg-background p-2" value={target} onChange={e => setTarget(e.target.value)}>
        <option value="">Choose an imported document</option>
        {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </label>
    <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Which topics should this report address? Select the checks relevant to your task.</legend>
      {checks.map(c => <label key={c.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(current => e.target.checked ? [...current, c.id] : current.filter(id => id !== c.id))} />{c.question}</label>)}
    </fieldset>
    <Button disabled={busy || !target || !selected.length} onClick={run}>{busy ? 'Checking extracted text…' : 'Check document'}</Button>
    {error && <p role="alert" className="rounded border border-destructive p-3">{error} No completed result is available for this attempt.</p>}
    {result && <div className="space-y-4" aria-live="polite">
      <p role="status" className="text-sm">{result.status === 'PARTIAL' ? 'Partial analysis—some source text could not be assessed.' : 'Selected text checks completed.'} Checked {result.scope.documents.length} case document(s), {result.scope.passagesChecked} passage(s). No external records were retrieved.</p>
      <h3 className="font-semibold">Coverage questions for this report</h3>
      {result.coverage.map(c => <article key={c.id} className="rounded border p-3 space-y-2"><h4 className="font-medium">{c.question}</h4><p className="text-sm">{c.status === 'MENTION_FOUND' ? 'Related wording found' : c.status === 'UNASSESSABLE' ? 'Unable to assess coverage' : 'Not located in extracted text'}</p><p className="text-sm text-muted-foreground">{c.explanation}</p>{c.sources.map(s => <Source key={s.passageId} source={s} />)}</article>)}
      <h3 className="font-semibold">Passages to compare</h3>
      {!result.comparisons.length && <p className="text-sm">These limited rules did not identify a comparison. This does not establish that the report is consistent or complete.</p>}
      {result.comparisonsTruncated && <p className="text-sm">The comparison limit was reached. Only part of the candidate set is shown.</p>}
      {result.comparisons.map(c => <article key={c.id} className="rounded border p-3 space-y-3"><h4 className="font-medium">{c.kind === 'POTENTIAL_INTERNAL_CONTRADICTION' ? 'Possible contradiction within the report' : 'Possible conflict between documents'} · {c.topic}</h4><p className="text-sm">{c.explanation}</p>{c.sources.map((s,i) => <Source key={`${s.passageId}/${i}`} source={s} />)}<ul className="list-disc pl-5 text-sm">{c.questions.map(q => <li key={q}>{q}</li>)}</ul></article>)}
      <details className="text-sm"><summary className="cursor-pointer">Sources checked and limitations</summary><ul className="mt-2 list-disc pl-5">{result.scope.documents.map(d => <li key={d.id}>{d.name}: {d.status}, {d.extractedPassages} extracted passage(s){d.superseded ? '; earlier version' : ''}. {d.warnings.join(' ')}</li>)}{result.limitations.map(l => <li key={l}>{l}</li>)}</ul><p className="mt-2 break-all text-xs">Source snapshot: {result.snapshot}</p></details>
    </div>}
  </section>
}
