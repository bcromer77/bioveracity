'use client'
import { useEffect, useState } from 'react'
import type { Snapshot } from '@/lib/wild-hubs/domain'
import { buildEdition } from '@/lib/wild-hubs/edition'
import { getWildCounty } from '@/lib/wild-counties/counties'
import { VisitorPage } from '@/components/wild/visitor-page'
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
    {reviews.map(r => {
      const county = getWildCounty(r.snapshot.profile.county)
      const view = buildEdition({
        kind: 'review',
        profile: r.snapshot.profile,
        plan: r.snapshot.plan,
        photos: r.photos.map(p => ({ id: p.id, caption: p.caption, credit: p.credit, src: `/api/wild/reviews/${r.id}/photos/${p.id}` })),
        countyBrand: county?.brandName || r.snapshot.profile.county,
        provenanceLabel: 'Submitted for editorial review. Business identity and environmental performance are not certified by BioVeracity.',
      })
      return <article key={r.id} className="space-y-4 rounded-xl border p-6">
      <p className="text-sm text-[#5b6b60]">Submitted revision {r.revision} · This is exactly the page a Wild Counties visitor would see once published.</p>
      <div className="bv-public"><div className="bv-review-preview"><VisitorPage view={view}/></div></div>
      <details className="text-xs">
        <summary className="cursor-pointer">Editorial diagnostics (raw submission data)</summary>
        <div className="mt-2 space-y-2">
          <p>{r.snapshot.profile.county} · {r.snapshot.profile.kind}</p>
          <p>Interests: {r.snapshot.profile.interests.join(', ')} · Plan year {r.snapshot.plan.year} · Basis: {r.snapshot.plan.basis}</p>
          <p>Only the photos shown in the preview above will be published. Wider county records update separately and do not establish species presence at this venue.</p>
          {r.snapshot.plan.trend && <details><summary>Owner-supplied historical Trends data</summary><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(r.snapshot.plan.trend,null,2)}</pre></details>}
          {r.snapshot.plan.sources.length > 0 && <details><summary>Retained source context</summary><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(r.snapshot.plan.sources,null,2)}</pre></details>}
          {r.snapshot.plan.campaigns.map(m => <section key={m.month} className="rounded border p-3">
            <h4 className="font-semibold">{m.month}. {m.title}</h4><p>{m.introduction}</p><p>{m.activity}</p><p>{m.caption}</p><p>{m.planningNote}</p>
          </section>)}
        </div>
      </details>
      <label className="block">Review notes and checks performed (required)<textarea className="block w-full rounded border p-2" maxLength={2000} value={notes[r.id] || ''} disabled={busy} onChange={e => setNotes({...notes,[r.id]:e.target.value})}/></label>
      <label className="block"><input type="checkbox" disabled={busy} checked={confirmed[r.id] || false} onChange={e => setConfirmed({...confirmed,[r.id]:e.target.checked})}/> I reviewed the complete submission and recorded my decision.</label>
      <div className="flex gap-4"><button disabled={busy || !confirmed[r.id] || !notes[r.id]?.trim()} onClick={() => decide(r,'approve')}>Approve and publish reviewed version</button><button disabled={busy || !confirmed[r.id] || !notes[r.id]?.trim()} onClick={() => decide(r,'reject')}>Return for changes</button></div>
    </article>
    })}
  </div>
}
