'use client'
import { useState } from 'react'

export function EvidenceReviewForm({ id, sections }: { id: string; sections: { locator: string; text: string }[] }) {
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  return <form className="space-y-3" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setMessage('')
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/admin/evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        id, claim: form.get('claim'), excerpt: form.get('excerpt'), locator: form.get('locator'), basis: form.get('basis'), evidenceType: form.get('evidenceType'),
        sourceChecked: form.has('sourceChecked'), claimSupported: form.has('claimSupported'), publicationPermitted: form.has('publicationPermitted'),
      }) })
      const result = await response.json()
      setMessage(response.ok ? 'Review recorded. The checked claim is now searchable.' : result.error)
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
    <button disabled={busy} className="rounded bg-emerald-800 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Saving…' : 'Verify claim and make searchable'}</button>
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
