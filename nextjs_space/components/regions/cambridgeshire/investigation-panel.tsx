'use client'
import Link from 'next/link'
import { useState } from 'react'
import { INVESTIGATIONS, investigationCoverage } from '@/lib/investigation-questions'

export function InvestigationPanel({ records, selectedSlug, placeName, onChoose, onReset }: {
  records: Parameters<typeof investigationCoverage>[0]; selectedSlug: string | null; placeName: string;
  onChoose: (category: string) => void; onReset: () => void;
}) {
  const [selected, setSelected] = useState<string>('place')
  const [query, setQuery] = useState('')
  const item = INVESTIGATIONS.find(i => i.id === selected) ?? INVESTIGATIONS[0]
  const coverage = investigationCoverage(records, selectedSlug)
  return <section className="border-b border-slate-700 bg-slate-900 p-4" aria-label="Choose an investigation">
    <p className="text-xs font-medium uppercase tracking-wider text-amber-300">Start with a question</p>
    <h2 className="mt-1 text-xl font-semibold text-white">{placeName}</h2>
    <div className="mt-3 grid grid-cols-2 gap-2">{INVESTIGATIONS.map(i => <button key={i.id} aria-pressed={selected === i.id}
      onClick={() => { setSelected(i.id); setQuery(i.question); onChoose(i.category) }}
      className={`rounded-lg border px-3 py-2 text-left text-xs ${selected === i.id ? 'border-amber-400 bg-amber-400/15 text-amber-100' : 'border-slate-600 text-slate-200 hover:bg-slate-800'}`}>{i.label}</button>)}</div>
    <form action="/evidence" className="mt-4 space-y-2">
      <label className="block text-xs text-slate-300" htmlFor="investigation-question">Ask your own question in reviewed-source search</label>
      <input id="investigation-question" name="q" value={query} onChange={e => setQuery(e.target.value)} maxLength={300} required placeholder={`What changed around ${placeName}?`}
        className="w-full rounded-lg border border-slate-500 bg-slate-950 p-3 text-sm text-white" />
      <button className="w-full rounded-lg bg-amber-400 p-2 text-sm font-semibold text-slate-950">Search reviewed sources</button>
    </form>
    <details className="mt-3 text-xs text-slate-300"><summary className="cursor-pointer">Evidence this question needs</summary><ul className="mt-2 list-disc space-y-1 pl-4">{item.required.map(r => <li key={r}>{r}</li>)}</ul></details>
    <div className="mt-3 rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-300" aria-live="polite">
      <strong className="text-white">Available in this map’s loaded record</strong>
      <p>{coverage.records} timeline records · {coverage.linked} with HTTPS source links</p>
      <p>{coverage.from ? `Recorded dates: ${coverage.from} to ${coverage.to}` : 'Dated coverage not established.'}</p>
      {coverage.unknownDates > 0 && <p>{coverage.unknownDates} records have unknown or unspecified date precision.</p>}
      <p className="mt-1">These counts do not establish completeness, review status or coverage in the separate search collection.</p>
    </div>
    <button onClick={onReset} className="mt-3 text-xs text-amber-200 underline">Show all places, topics and dates</button>
    <p className="mt-2 text-xs text-slate-400">Report upload is not connected yet. <Link href="/contact" className="underline">Arrange a report review</Link>.</p>
  </section>
}
