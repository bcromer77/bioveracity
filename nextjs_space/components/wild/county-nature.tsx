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
   .catch(() => { if (!controller.signal.aborted) setError('County records could not be loaded. Please retry.') })
  return () => controller.abort()
 }, [county, attempt])
 return <section className="space-y-4" aria-label="County biodiversity records">
  <h2 className="text-2xl font-semibold">Discover the county’s recorded wildlife</h2>
  <p>Read biodiversity records here in BioVeracity. These county records do not establish wildlife presence at this venue or permission to visit a site.</p>
  {!data && !error && <p role="status">Checking the county biodiversity API…</p>}
  {error && <p role="alert">{error}</p>}
  {(error || data?.status === 'unavailable') && <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Try again</button>}
  {data && <>
   <p role="status">{data.status === 'partial' ? 'Partial API coverage' : data.status === 'ok' ? 'API sample checked' : data.status === 'unsupported' ? 'County API not connected' : 'Source unavailable'}</p>
   <p className="text-sm">{data.note}</p>
   {!data.records.length && data.status !== 'unsupported' && data.status !== 'unavailable' && <p>No eligible records were returned in this sample. This does not establish absence of wildlife.</p>}
   <div className="grid gap-4 md:grid-cols-2">{data.records.slice(0, 12).map(record => <article key={record.id} className="rounded border border-[#d8d3c4] bg-white p-5 text-[#173d35]">
    <h3 className="text-xl font-semibold">{record.name}</h3>
    <p className="text-sm">Recorded in {data.county} · {record.eventDate || 'Date not stated'} · {record.datePrecision} precision</p>
    <p className="text-sm">{record.publisher} · Record {record.id}</p>
    <EvidenceLink href={record.sourceUrl}>Source attribution</EvidenceLink>
    <p className="break-all text-xs">Licence: {record.licence}</p>
   </article>)}</div>
   <p className="text-xs">Showing {Math.min(12, data.records.length)} of {data.records.length} eligible records from {data.inspected} inspected; {data.excluded} excluded. Checked {data.checkedAt}. Results may be cached for up to 15 minutes.</p>
  </>}
 </section>
}
