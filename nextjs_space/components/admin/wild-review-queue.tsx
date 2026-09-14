'use client'
import { useEffect, useState } from 'react'
import { EvidenceLink } from '@/components/evidence-link'
import type { Snapshot } from '@/lib/wild-hubs/domain'
type Review = { id: string; hubId: string; revision: number; snapshot: Snapshot; photos: { id: string; caption: string; credit: string }[] }
export function WildReviewQueue() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [storage, setStorage] = useState<{ count: number; bytes: string } | null>(null)
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState<Record<string,string>>({})
  const [confirmed, setConfirmed] = useState<Record<string,boolean>>({})
  async function load() {
    const response = await fetch('/api/wild/reviews?page=' + page, { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw Error(result.error || 'Review unavailable.')
    setReviews(result.reviews); setStorage(result.storage)
  }
  useEffect(() => { setBusy(true); load().catch(e => setError(e.message)).finally(() => setBusy(false)) }, [page])
  async function decide(review: Review, action: 'approve' | 'reject') {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/wild/reviews/' + review.id, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: review.revision, action, reason: notes[review.id] || '', confirmed: confirmed[review.id] === true }) })
      const result = await response.json()
      if (!response.ok) throw Error(result.error || 'Review was not saved.')
      setConfirmed({}); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Review unavailable.') }
    finally { setBusy(false) }
  }
  return <div className="space-y-6">
    {error && <p role="alert">{error}</p>}
    {storage && <p>{storage.count} stored photos · {(Number(storage.bytes) / 1000000).toFixed(1)} MB of image data. Database overhead and backups are additional.</p>}
    <div className="flex gap-4"><button disabled={busy || page === 0} onClick={() => setPage(page-1)}>Previous</button><span>Page {page+1}</span><button disabled={busy || reviews.length < 20} onClick={() => setPage(page+1)}>Next</button><button disabled={busy} onClick={() => { setBusy(true); load().catch(e => setError(e.message)).finally(() => setBusy(false)) }}>Refresh queue</button></div>
    {!busy && !error && reviews.length === 0 && <p>No current submissions on this page.</p>}
    {reviews.map(r => <article key={r.id} className="space-y-4 rounded-xl border p-6">
      <h2 className="text-2xl font-semibold">{r.snapshot.profile.name}</h2>
      <p>{r.snapshot.profile.county} · {r.snapshot.profile.kind} · Submitted revision {r.revision}</p>
      <p className="whitespace-pre-wrap">{r.snapshot.profile.story}</p>
      {r.snapshot.profile.website && <EvidenceLink href={r.snapshot.profile.website}>Submitted website reference</EvidenceLink>}
      <p>Interests: {r.snapshot.profile.interests.join(', ')} · Plan year {r.snapshot.plan.year} · Basis: {r.snapshot.plan.basis}</p>
      {r.snapshot.plan.trend && <details><summary>Owner-supplied historical Trends data</summary><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(r.snapshot.plan.trend,null,2)}</pre></details>}
      {r.snapshot.plan.sources.length > 0 && <details><summary>Retained source context</summary><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(r.snapshot.plan.sources,null,2)}</pre></details>}
      {r.snapshot.plan.campaigns.map(m => <section key={m.month} className="rounded border p-3">
        <h3 className="font-semibold">{m.month}. {m.title}</h3><p>{m.introduction}</p><p>{m.activity}</p><p>{m.caption}</p><p>{m.planningNote}</p>
      </section>)}
      <p>Only the selected photos below will be published. Wider county API records update separately and do not establish species presence at this venue.</p>
      {r.photos.map(p => <figure key={p.id}><ReviewPhoto reviewId={r.id} photoId={p.id}/><figcaption>{p.caption} · {p.credit}</figcaption></figure>)}
      <label className="block">Review notes and checks performed (required)<textarea className="block w-full rounded border p-2" maxLength={2000} value={notes[r.id] || ''} disabled={busy} onChange={e => setNotes({...notes,[r.id]:e.target.value})}/></label>
      <label className="block"><input type="checkbox" disabled={busy} checked={confirmed[r.id] || false} onChange={e => setConfirmed({...confirmed,[r.id]:e.target.checked})}/> I reviewed the complete submission and recorded my decision.</label>
      <div className="flex gap-4"><button disabled={busy || !confirmed[r.id] || !notes[r.id]?.trim()} onClick={() => decide(r,'approve')}>Approve and publish reviewed version</button><button disabled={busy || !confirmed[r.id] || !notes[r.id]?.trim()} onClick={() => decide(r,'reject')}>Return for changes</button></div>
    </article>)}
  </div>
}
function ReviewPhoto({reviewId,photoId}:{reviewId:string;photoId:string}) {
  return <img className="max-h-80 object-contain" src={`/api/wild/reviews/${reviewId}/photos/${photoId}`} alt="Selected venue photo for editorial review"/>
}
