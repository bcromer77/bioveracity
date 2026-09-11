'use client'
import { useState } from 'react'
import { reviewOutcomeMessage } from '@/lib/evidence-review-message'

export function EvidenceReviewForm({ id, sections }: { id: string; sections: { locator: string; text: string }[] }) {
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  return <form className="space-y-3" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setMessage('')
    const form = new FormData(event.currentTarget)
    const publish = form.has('publish')
    try {
      const response = await fetch('/api/admin/evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        id, claim: form.get('claim'), excerpt: form.get('excerpt'), locator: form.get('locator'), basis: form.get('basis'), evidenceType: form.get('evidenceType'),
        sourceChecked: form.has('sourceChecked'), claimSupported: form.has('claimSupported'), publicationPermitted: form.has('publicationPermitted'),
        // Explicit publishing decision. Only when the reviewer ticks publish do we
        // attest the record faithfully represents a redistributable public source.
        // The server re-screens the labels before applying them.
        publish, ...(publish ? { publishSensitivity: 'PUBLIC', publishReuse: 'PERMITTED' } : {}),
      }) })
      const result = await response.json()
      if (!response.ok) { setMessage(result.error || 'Review not accepted.'); return }
      // The success message is derived from the actual outcome, never assumed from
      // the HTTP status: a 200 can mean verified-and-published OR verified-but-excluded.
      setMessage(reviewOutcomeMessage(result))
    } catch { setMessage('Review was not confirmed. Refresh before retrying.') } finally { setBusy(false) }
  }}>
    <label className="block">Claim supported by the source<textarea required name="claim" maxLength={1500} className="mt-1 block w-full rounded border p-2" /></label>
    <label className="block">Evidence type<select name="evidenceType" className="ml-2 rounded border p-2">{['council_record', 'measurement', 'regulator_finding', 'operator_statement', 'community_observation'].map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select></label>
    <label className="block">Source location<select name="locator" className="ml-2 max-w-full rounded border p-2">{sections.map((s, i) => <option key={i}>{s.locator}</option>)}</select></label>
    <label className="block">Exact supporting excerpt<textarea required name="excerpt" maxLength={1200} className="mt-1 block w-full rounded border p-2" /></label>
    <label className="block">Explain what was checked and any limits<textarea required name="basis" maxLength={2000} className="mt-1 block w-full rounded border p-2" /></label>
    <label className="block"><input required type="checkbox" name="sourceChecked" /> I opened the original source and checked this version and passage.</label>
    <label className="block"><input required type="checkbox" name="claimSupported" /> The passage supports this specific claim, with dates and evidence type represented accurately.</label>
    <label className="block"><input required type="checkbox" name="publicationPermitted" /> Publication of this claim and excerpt is permitted and contains no private participant information.</label>
    <label className="block rounded border border-emerald-700 bg-emerald-50 p-2"><input type="checkbox" name="publish" /> <strong>Publish to registered search</strong> — make this verified claim searchable to registered users as a public, redistributable source. Leave unticked to record the verification without publishing.</label>
    <button disabled={busy} className="rounded bg-emerald-800 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Saving…' : 'Verify claim'}</button>
    <p role="status">{message}</p>
    <button type="button" disabled={busy} className="text-sm underline" onClick={async () => {
      const reason = window.prompt('Explain why this claim should be withdrawn (at least 30 characters):')
      if (!reason || reason.trim().length < 30) return
      setBusy(true)
      try {
        const response = await fetch('/api/admin/evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'withdraw', reason }) })
        setMessage(response.ok ? 'Withdrawn from current search. Review history retained.' : 'Withdrawal was not accepted.')
      } catch { setMessage('Withdrawal was not confirmed. Refresh before retrying.') } finally { setBusy(false) }
    }}>Withdraw from verified search</button>
  </form>
}
