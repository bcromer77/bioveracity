'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { obligationListPath, obligationPath } from './workspace-client.mjs'

type Obligation = {
  id: string; passageId: string | null; documentId: string | null; evidenceCheckId: string | null; createdAt: string
  passageLocator: string | null; passageDocumentName: string | null; documentName: string | null
  evidenceCheckStatus: string | null; evidenceCheckQuestion: string | null
  revision: number; sourceObligation: string; responsibleParty: string; dueDate: string | null; duePrecision: string
  recurrence: string; expectedEvidence: string; evidenceStatus: string; reviewStatus: string; reviewedBy: string | null; note: string; revisedAt: string
}
type EvidenceDoc = { id: string; name: string }
type EvidenceEvent = { passageId: string; name: string; locator: string; title: string }

const field = 'block w-full rounded border border-input bg-background p-2 text-sm'
const DUE_PRECISION = ['UNKNOWN', 'YEAR', 'MONTH', 'DAY']
const RECURRENCE = ['NONE', 'ANNUAL', 'BIENNIAL', 'FIVE_YEARLY', 'MILESTONE']
const EVIDENCE_STATUS = ['UNKNOWN', 'LOCATED', 'NOT_LOCATED']
const recurrenceLabel: Record<string, string> = { NONE: 'One-off', ANNUAL: 'Annual', BIENNIAL: 'Every two years', FIVE_YEARLY: 'Every five years', MILESTONE: 'At a project milestone' }
const evidenceLabel: Record<string, string> = { UNKNOWN: 'Not yet assessed', LOCATED: 'Evidence located', NOT_LOCATED: 'Evidence not located' }
const reviewLabel: Record<string, string> = { DRAFT: 'Draft', UNRESOLVED: 'Unresolved question', REVIEWED: 'Reviewed' }

async function read(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...init.headers } })
  if (!response.ok) { let msg = 'The service is unavailable or your session has ended. This action is not confirmed. Refresh before retrying.'; try { const data = await response.json(); if (typeof data.error === 'string') msg = data.error } catch {} throw new Error(msg) }
  return response
}
const textError = (e: unknown) => e instanceof Error ? e.message : 'Request failed'
const dueLabel = (o: { dueDate: string | null; duePrecision: string; recurrence: string }) => {
  const base = o.duePrecision === 'UNKNOWN' || !o.dueDate ? 'No dated deadline' : `Due ${o.dueDate}`
  return o.recurrence === 'NONE' ? base : `${base} · ${recurrenceLabel[o.recurrence] ?? o.recurrence}`
}

export function CaseObligations({ workspaceId, caseId }: { workspaceId: string; caseId: string }) {
  const listPath = obligationListPath(workspaceId, caseId)
  const evidencePath = `/api/workspaces/${encodeURIComponent(workspaceId)}/cases/${encodeURIComponent(caseId)}/evidence`
  const [items, setItems] = useState<Obligation[]>([])
  const [docs, setDocs] = useState<EvidenceDoc[]>([]), [passages, setPassages] = useState<EvidenceEvent[]>([])
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  const [sourceObligation, setSourceObligation] = useState(''), [responsibleParty, setResponsibleParty] = useState('')
  const [duePrecision, setDuePrecision] = useState('UNKNOWN'), [dueDate, setDueDate] = useState(''), [recurrence, setRecurrence] = useState('NONE')
  const [expectedEvidence, setExpectedEvidence] = useState(''), [evidenceStatus, setEvidenceStatus] = useState('UNKNOWN'), [note, setNote] = useState('')
  const [passageId, setPassageId] = useState(''), [documentId, setDocumentId] = useState('')

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLoadError('')
    Promise.all([
      read(listPath, { signal: controller.signal }).then(r => r.json()),
      read(evidencePath, { signal: controller.signal }).then(r => r.json()).catch(() => ({ documents: [], events: [] })),
    ]).then(([list, ev]) => {
      if (controller.signal.aborted) return
      setItems(list.obligations as Obligation[])
      setDocs((ev.documents ?? []) as EvidenceDoc[])
      setPassages(((ev.events ?? []) as EvidenceEvent[]).filter(e => e.passageId))
    }).catch(e => { if (!controller.signal.aborted) setLoadError(textError(e)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [listPath, evidencePath, revision])

  async function create(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(''); setNotice('')
    try {
      await read(listPath, { method: 'POST', body: JSON.stringify({ sourceObligation, responsibleParty, duePrecision, dueDate: duePrecision === 'UNKNOWN' ? '' : dueDate, recurrence, expectedEvidence, evidenceStatus, note, passageId: passageId || undefined, documentId: documentId || undefined }) })
      setNotice('Commitment recorded as a draft. Link its source and mark it reviewed once confirmed.')
      setSourceObligation(''); setResponsibleParty(''); setDuePrecision('UNKNOWN'); setDueDate(''); setRecurrence('NONE'); setExpectedEvidence(''); setEvidenceStatus('UNKNOWN'); setNote(''); setPassageId(''); setDocumentId('')
      setRevision(x => x + 1)
    } catch (e) { setError(textError(e)) } finally { setBusy(false) }
  }

  return <section className="mt-6 border-t pt-6 space-y-5" aria-label="BNG commitments and obligations">
    <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-xl font-semibold">Commitments & obligations</h3><p className="text-sm text-muted-foreground">What was promised for this place, which source records it, and what happens next.</p></div><Button variant="outline" onClick={() => setRevision(x => x + 1)} disabled={busy || loading}>Refresh</Button></div>
    {error && <p role="alert" className="rounded border border-destructive p-3 text-sm">{error}</p>}{notice && <p role="status" className="rounded bg-secondary p-3 text-sm">{notice}</p>}
    {loadError && <p role="alert" className="rounded border border-destructive p-3 text-sm">Could not load commitments: {loadError}</p>}
    {loading ? <p role="status">Loading commitments...</p> : <>
      <form className="space-y-4 rounded border p-4" onSubmit={create}>
        <div><h4 className="font-semibold">Add a commitment</h4><p className="text-sm text-muted-foreground">Record what was promised, in the words of the source. Everything starts as a draft. “Evidence not located” never means an obligation was missed — only that no source has been attached yet.</p></div>
        <label className="block text-sm">What was promised<textarea className={field} rows={3} required maxLength={2000} value={sourceObligation} onChange={e => setSourceObligation(e.target.value)} placeholder="e.g. Maintain 2.1 hectares of restored wet grassland and monitor annually for 30 years."/></label>
        <label className="block text-sm">Who is responsible, if stated<input className={field} maxLength={300} value={responsibleParty} onChange={e => setResponsibleParty(e.target.value)} placeholder="Named party from the source, or leave blank"/></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">Deadline precision<select className={field} value={duePrecision} onChange={e => setDuePrecision(e.target.value)}>{DUE_PRECISION.map(v => <option key={v} value={v}>{v === 'UNKNOWN' ? 'No dated deadline' : v}</option>)}</select></label>
          <label className="block text-sm">Deadline<input className={field} disabled={duePrecision === 'UNKNOWN'} placeholder="YYYY, YYYY-MM or YYYY-MM-DD" value={dueDate} onChange={e => setDueDate(e.target.value)}/></label>
        </div>
        <label className="block text-sm">Recurrence<select className={field} value={recurrence} onChange={e => setRecurrence(e.target.value)}>{RECURRENCE.map(v => <option key={v} value={v}>{recurrenceLabel[v]}</option>)}</select></label>
        <label className="block text-sm">What evidence would show this was met<textarea className={field} rows={2} maxLength={2000} value={expectedEvidence} onChange={e => setExpectedEvidence(e.target.value)} placeholder="e.g. Annual monitoring report lodged with the local planning authority."/></label>
        <label className="block text-sm">Has that evidence been located?<select className={field} value={evidenceStatus} onChange={e => setEvidenceStatus(e.target.value)}>{EVIDENCE_STATUS.map(v => <option key={v} value={v}>{evidenceLabel[v]}</option>)}</select></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">Link a source passage in this case<select className={field} value={passageId} onChange={e => setPassageId(e.target.value)}><option value="">No passage linked</option>{passages.map(p => <option key={p.passageId} value={p.passageId}>{p.name} · {p.locator}</option>)}</select></label>
          <label className="block text-sm">Or link a source document<select className={field} value={documentId} onChange={e => setDocumentId(e.target.value)}><option value="">No document linked</option>{docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        </div>
        <label className="block text-sm">Note / unresolved question<textarea className={field} rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)}/></label>
        <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Record commitment'}</Button>
      </form>
      <div className="space-y-4">
        {!items.length && <p className="text-sm">No commitments recorded yet. Add the first promise made for this place.</p>}
        {items.map(o => <ObligationRow key={`${o.id}/${o.revision}`} item={o} workspaceId={workspaceId} caseId={caseId} docs={docs} passages={passages} onSaved={() => setRevision(x => x + 1)}/>)}
      </div>
    </>}
  </section>
}

function ObligationRow({ item, workspaceId, caseId, docs, passages, onSaved }: { item: Obligation; workspaceId: string; caseId: string; docs: EvidenceDoc[]; passages: EvidenceEvent[]; onSaved: () => void }) {
  const [sourceObligation, setSourceObligation] = useState(item.sourceObligation)
  const [responsibleParty, setResponsibleParty] = useState(item.responsibleParty)
  const [duePrecision, setDuePrecision] = useState(item.duePrecision), [dueDate, setDueDate] = useState(item.dueDate ?? ''), [recurrence, setRecurrence] = useState(item.recurrence)
  const [expectedEvidence, setExpectedEvidence] = useState(item.expectedEvidence), [evidenceStatus, setEvidenceStatus] = useState(item.evidenceStatus), [note, setNote] = useState(item.note)
  const [passageId, setPassageId] = useState(item.passageId ?? ''), [documentId, setDocumentId] = useState(item.documentId ?? '')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)

  async function save(reviewStatus: string) {
    setBusy(true); setError('')
    try {
      await read(obligationPath(workspaceId, caseId, item.id), { method: 'PATCH', body: JSON.stringify({ revision: item.revision, reviewStatus, sourceObligation, responsibleParty, duePrecision, dueDate: duePrecision === 'UNKNOWN' ? '' : dueDate, recurrence, expectedEvidence, evidenceStatus, note, passageId: passageId || undefined, documentId: documentId || undefined }) })
      onSaved()
    } catch (e) { setError(textError(e)) } finally { setBusy(false) }
  }

  return <article className="rounded-lg border p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold break-words">{item.sourceObligation.slice(0, 140) || 'Untitled commitment'}{item.sourceObligation.length > 140 ? '…' : ''}</h4><span className="text-sm text-muted-foreground">{reviewLabel[item.reviewStatus] ?? item.reviewStatus} · revision {item.revision}</span></div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span>{dueLabel(item)}</span><span>{evidenceLabel[item.evidenceStatus] ?? item.evidenceStatus}</span>{item.responsibleParty && <span>Responsible: {item.responsibleParty}</span>}</div>
    {(item.passageId || item.documentId || item.evidenceCheckId) ? <p className="text-sm">Source: {item.passageDocumentName ? `${item.passageDocumentName}${item.passageLocator ? ` · ${item.passageLocator}` : ''}` : item.documentName ? item.documentName : item.evidenceCheckQuestion ? `Evidence check — ${item.evidenceCheckQuestion}` : 'linked'}</p> : <p className="text-sm text-muted-foreground">No source linked yet — required before this can be marked reviewed.</p>}
    {item.reviewedBy && <p className="text-sm text-muted-foreground">Reviewed by {item.reviewedBy}</p>}
    <details><summary className="cursor-pointer text-sm font-medium">Edit / review this commitment</summary><div className="mt-3 space-y-3">
      <label className="block text-sm">What was promised<textarea className={field} rows={3} maxLength={2000} value={sourceObligation} onChange={e => setSourceObligation(e.target.value)}/></label>
      <label className="block text-sm">Who is responsible<input className={field} maxLength={300} value={responsibleParty} onChange={e => setResponsibleParty(e.target.value)}/></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">Deadline precision<select className={field} value={duePrecision} onChange={e => setDuePrecision(e.target.value)}>{DUE_PRECISION.map(v => <option key={v} value={v}>{v === 'UNKNOWN' ? 'No dated deadline' : v}</option>)}</select></label>
        <label className="block text-sm">Deadline<input className={field} disabled={duePrecision === 'UNKNOWN'} placeholder="YYYY, YYYY-MM or YYYY-MM-DD" value={dueDate} onChange={e => setDueDate(e.target.value)}/></label>
      </div>
      <label className="block text-sm">Recurrence<select className={field} value={recurrence} onChange={e => setRecurrence(e.target.value)}>{RECURRENCE.map(v => <option key={v} value={v}>{recurrenceLabel[v]}</option>)}</select></label>
      <label className="block text-sm">Expected evidence<textarea className={field} rows={2} maxLength={2000} value={expectedEvidence} onChange={e => setExpectedEvidence(e.target.value)}/></label>
      <label className="block text-sm">Has that evidence been located?<select className={field} value={evidenceStatus} onChange={e => setEvidenceStatus(e.target.value)}>{EVIDENCE_STATUS.map(v => <option key={v} value={v}>{evidenceLabel[v]}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">Linked source passage<select className={field} value={passageId} onChange={e => setPassageId(e.target.value)}><option value="">No passage linked</option>{passages.map(p => <option key={p.passageId} value={p.passageId}>{p.name} · {p.locator}</option>)}</select></label>
        <label className="block text-sm">Linked source document<select className={field} value={documentId} onChange={e => setDocumentId(e.target.value)}><option value="">No document linked</option>{docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      </div>
      <label className="block text-sm">Note / unresolved question<textarea className={field} rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)}/></label>
      <p className="text-sm text-muted-foreground">Marking a commitment reviewed requires a linked source passage or document (or an evidence-check record showing evidence was not located).</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => save('REVIEWED')}>Mark reviewed</Button><Button variant="outline" disabled={busy} onClick={() => save('UNRESOLVED')}>Mark unresolved</Button><Button variant="outline" disabled={busy} onClick={() => save('DRAFT')}>Save draft</Button></div>
    </div></details>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </article>
}
