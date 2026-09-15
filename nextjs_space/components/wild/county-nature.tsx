'use client'
import { useEffect, useState } from 'react'
import { EvidenceLink } from '@/components/evidence-link'
import type { CountyNatureResult } from '@/lib/wild-counties/api-nature'

export function CountyNature({ county }: { county: string }) {
 const [data, setData] = useState<CountyNatureResult | null>(null)
 const [error, setError] = useState('')
 const [attempt, setAttempt] = useState(0)
 useEffect(() => {
  const controller = new AbortController()
  setData(null); setError('')
  fetch('/api/wild/nature/' + encodeURIComponent(county), { signal: controller.signal, cache: 'no-store' })
   .then(async response => { if (!response.ok) throw Error('County records could not be loaded.'); return response.json() })
   .then(value => { if (!controller.signal.aborted) setData(value) })
   .catch(() => { if (!controller.signal.aborted) setError('We couldn’t load the wildlife information just now. Please try again.') })
  return () => controller.abort()
 }, [county, attempt])
 return <section className="space-y-4" aria-label="County biodiversity records">
  <h2 className="text-2xl font-semibold">A little closer to the wild</h2>
  <p>Explore wildlife recorded in the wider county. A starting point for curiosity, rather than a promise of what you will see today.</p>
  {!data && !error && <p role="status">Looking up local wildlife…</p>}
  {error && <p role="alert">{error}</p>}
  {(error || data?.status === 'unavailable') && <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Try again</button>}
  {data && <>
   <p role="status">{data.status === 'unsupported' ? 'Wildlife records for this county aren’t available here yet.' : data.status === 'unavailable' ? 'We couldn’t reach the wildlife records just now.' : data.records.length ? 'A glimpse of the county’s wildlife' : 'No wildlife records to show just yet.'}</p>
   {!data.records.length && data.status !== 'unsupported' && data.status !== 'unavailable' && <p>We checked a small selection, but none could be shown here. That tells us about this search, not how much wildlife lives here.</p>}
   <div className="grid gap-4 md:grid-cols-2">{data.records.slice(0, 12).map(record => <article key={record.id} className="rounded border border-[#d8d3c4] bg-white p-5 text-[#173d35]">
    <h3 className="text-xl font-semibold">{record.name}</h3>
    <p className="text-sm">Recorded in {data.county} · {record.eventDate || 'Date not stated'}</p>
    <p className="text-sm">Shared by {record.publisher}</p>
    <EvidenceLink href={record.sourceUrl}>Read the original record</EvidenceLink>
    <details className="text-sm"><summary>About this record</summary><p>Record reference: {record.id}. The date is recorded to {record.datePrecision} precision.</p><p className="break-all">Permission to reuse this information: {record.licence}</p></details>
   </article>)}</div>
   <details className="text-sm">
    <summary className="cursor-pointer">About this information</summary>
    <p className="mt-2">This is a small selection of published wildlife records, not a complete guide to the county. Records can be old, and several may describe the same species. They do not confirm wildlife at a particular business. Check access before visiting.</p>
    <p className="mt-2">We leave out records that cannot be shared here under our checks for permissions, location and sensitive wildlife. An omitted record is not necessarily wrong.</p>
    <p className="mt-2">We checked {data.inspected} records. {data.records.length} passed those checks; {data.excluded} were left out. This page displays up to 12. These are record counts, not numbers of species or animals.</p>
    <p className="mt-2">Last checked: {new Date(data.checkedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}. Updates can take up to 15 minutes to appear.</p>
    <details className="mt-2"><summary>Source and checking details</summary><p>{data.note}</p><p>Exact check time: {data.checkedAt}</p></details>
   </details>
  </>}
 </section>
}
