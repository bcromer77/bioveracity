'use client'
import { useEffect, useState } from 'react'
import { EvidenceLink } from '@/components/evidence-link'
import type { CountyNatureResult } from '@/lib/wild-counties/api-nature'

const STATUS_LABEL: Record<CountyNatureResult['status'], string> = {
  partial: 'Live records — partial sample checked',
  ok: 'Live records — sample checked',
  unsupported: 'Live records are not yet connected for this county',
  unavailable: 'Live records could not be loaded just now',
}

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
  const reasons = data && data.reasons ? Object.entries(data.reasons) : []
  return <section className="space-y-4" aria-label="Live county biodiversity records">
   <h2 className="text-2xl font-semibold">Live biodiversity records</h2>
   <p>These are historical records read live from the national biodiversity data service, kept separate from the reviewed stories above. They do not establish wildlife presence at any venue or a right to visit a site.</p>
   {!data && !error && <p role="status">Checking for records…</p>}
   {error && <p role="alert">{error}</p>}
   {(error || data?.status === 'unavailable') && <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Try again</button>}
   {data && <>
    <p role="status">{STATUS_LABEL[data.status]}</p>
    <p className="text-sm">{data.note}</p>
    {!data.records.length && data.status !== 'unsupported' && data.status !== 'unavailable' && <p>No eligible records were returned in this sample. This does not establish absence of wildlife.</p>}
    <div className="grid gap-4 md:grid-cols-2">{data.records.slice(0, 12).map(record => <article key={record.id} className="rounded border border-[#d8d3c4] bg-white p-5 text-[#173d35]">
     <h3 className="text-xl font-semibold">{record.name}</h3>
     <p className="text-sm">Recorded in {data.county} · {record.eventDate || 'Date not stated'} · {record.datePrecision} precision</p>
     <p className="text-sm">{record.publisher} · Record {record.id}</p>
     <EvidenceLink href={record.sourceUrl}>Source attribution</EvidenceLink>
     <p className="break-all text-xs">Licence: {record.licence}</p>
    </article>)}</div>
    {(data.status === 'ok' || data.status === 'partial') && <details className="text-xs">
     <summary className="cursor-pointer">Maintainer diagnostics (source counts and exclusion reasons)</summary>
     <p className="mt-2">Showing {Math.min(12, data.records.length)} of {data.records.length} eligible records from {data.inspected} inspected; {data.excluded} excluded. Checked {data.checkedAt}. Results may be cached for up to 15 minutes.</p>
     {reasons.length > 0 && <ul className="mt-1 list-disc pl-5">{reasons.map(([reason, count]) => <li key={reason}>{reason}: {count}</li>)}</ul>}
    </details>}
   </>}
  </section>
}
