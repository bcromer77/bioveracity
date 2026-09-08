 'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HONEYCOMB_CATEGORIES } from '@/lib/resident-report'
import { RegionalOperatingPicture, type OPEvent } from '@/components/regions/cambridgeshire/operating-picture'
type Place = { id: string; slug: string; name: string; latitude: number | null; longitude: number | null }
type Report = { id: string; assetId: string; category: string; description: string; status: string; observedAt: string; receivedAt: string }
export function ResidentIntake({ places, reports }: { places: Place[]; reports: Report[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const form = event.currentTarget; const data = new FormData(form)
    const id = requestId ?? crypto.randomUUID(); setRequestId(id); setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/community-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: id, assetId: data.get('assetId'), category: data.get('category'), description: data.get('description'), observedAt: new Date(String(data.get('observedAt'))).toISOString() }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to save report')
      form.reset(); setRequestId(null); setMessage('Saved privately. Your resident report is pending verification.'); router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save report') }
    finally { setBusy(false) }
  }
  const chronology: OPEvent[] = reports.flatMap(r => {
    const place = places.find(p => p.id === r.assetId)
    return place ? [{ id: r.id, title: `RESIDENT REPORT · ${r.status.replace(/_/g, ' ')} · ${r.category}`, description: `${r.description}\nObservation time (resident supplied): ${r.observedAt}. Timeline position is submission time.`, date: r.receivedAt, datePrecision: 'day', eventType: 'community', evidenceClass: 'C', changeType: 'event', sourceUrl: null, sourceDomain: null, assetSlug: place.slug, assetName: place.name, lat: place.latitude, lng: place.longitude }] : []
  })
  const selectedPlaces = places.filter(p => reports.some(r => r.assetId === p.id))
  return <main className="bg-[#080f1e] text-slate-100">
    <section className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Report what you observed</h1>
      <p className="text-slate-300">Your reports stay private to your account and pending verification. Select a nearby mapped place; its pin is a reference location, not an exact incident location. Postcode lookup is not available yet.</p>
      <form onSubmit={submit} className="grid gap-4">
        <label>Reference place<select name="assetId" required className="mt-1 block w-full rounded border border-slate-600 bg-slate-900 p-3"><option value="">Choose a mapped place</option>{places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Topic<select name="category" required className="mt-1 block w-full rounded border border-slate-600 bg-slate-900 p-3">{HONEYCOMB_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>When did you observe it? (your local time)<input type="datetime-local" name="observedAt" required className="mt-1 block w-full rounded border border-slate-600 bg-slate-900 p-3" /></label>
        <label>What did you observe?<textarea name="description" required minLength={10} maxLength={2000} rows={4} className="mt-1 block w-full rounded border border-slate-600 bg-slate-900 p-3" /></label>
        <p className="text-sm text-slate-400">Describe what you saw, heard or smelled. Leave out names, contact details and private household addresses.</p>
        <button disabled={busy || !places.length} className="rounded bg-amber-400 p-3 font-medium text-slate-950 disabled:opacity-50">{busy ? 'Saving…' : 'Save private observation'}</button>
        <p role="status">{message}</p>
      </form>
      <h2 className="text-xl">Your reports submitted in the last 72 hours</h2>
      <p className="text-sm text-slate-400">The timeline shows when reports were received. Each card separately records when you say the observation happened.</p>
      {!reports.length && <p>No reports submitted in this window.</p>}
    </section>
    {!!reports.length && <RegionalOperatingPicture key={reports.map(r => r.id).join(',')} regionName="Your private observations" backHref="/postcode" initialContextId="incident" places={selectedPlaces.map(p => ({ slug: p.slug, name: p.name, type: 'reference', lat: p.latitude!, lng: p.longitude!, indicative: true, category: 'environment', evidenceState: 'neutral' }))} chronology={chronology} connections={[]} relationshipNote="Pins identify selected reference places; they are not measured incident locations." accessNote="Private to your account. User-supplied reports do not establish a verified fact." />}
  </main>
}
