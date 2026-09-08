'use client'

import { useState } from 'react'
import { exactHistoryDay, groupPlaceHistory, historyDateLabel, historySourceUrl } from '@/lib/place-history'
import { getEvidenceDisplay } from '@/lib/evidence-taxonomy'
import type { OPEvent } from './operating-picture'

export function PlaceHistoryPanel({ records, slug, placeName, anchorId, onAnchor }: {
  records: OPEvent[]; slug: string | null; placeName: string; anchorId: string | null; onAnchor: (record: OPEvent) => void
}) {
  const [days, setDays] = useState(30)
  const [phase, setPhase] = useState<'before' | 'during' | 'after' | 'uncertain'>('during')
  const scoped = records.filter(record => record.assetSlug === slug)
  const choices = scoped.filter(record => exactHistoryDay(record) !== null).sort((a, b) => exactHistoryDay(b)! - exactHistoryDay(a)!)
  const anchor = choices.find(record => record.id === anchorId) ?? choices[0]
  const grouped = groupPlaceHistory(records, slug ?? '', anchor?.id ?? '', days)
  return <section aria-label="Place History" className="border-b border-white/10 bg-slate-900/70 px-4 py-4 text-xs text-slate-300">
    <h2 className="text-sm font-semibold text-amber-200">Place History</h2>
    <p className="mt-1">{slug ? placeName : 'Select a place on the map to explore its history.'}</p>
    {slug && <>
      <p className="mt-2 text-slate-400">Uses all loaded records for this place, independently of timeline filters. Coverage is incomplete.</p>
      {!anchor ? <p className="mt-3">No records with a confirmed day are loaded. {scoped.length} records need more precise dates before a before-and-after comparison.</p> : <>
        <label className="mt-3 block">Event to explore
          <select className="mt-1 w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-slate-100" value={anchor.id} onChange={event => { const next = choices.find(record => record.id === event.target.value); if (next) onAnchor(next) }}>
            {choices.map(record => <option key={record.id} value={record.id}>{historyDateLabel(record)} · {record.title}</option>)}
          </select>
        </label>
        <label className="mt-3 flex items-center justify-between gap-2">Days before and after
          <select className="rounded border border-slate-600 bg-slate-950 p-1" value={days} onChange={event => setDays(Number(event.target.value))}>{[1, 7, 30, 90].map(value => <option key={value} value={value}>{value}</option>)}</select>
        </label>
        <div className="mt-3 flex flex-wrap gap-1" aria-label="History period">
          {(['before', 'during', 'after', 'uncertain'] as const).map(key => <button key={key} aria-pressed={phase === key} onClick={() => setPhase(key)} className={`rounded px-2 py-1.5 ${phase === key ? 'bg-amber-300 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>{({ before: 'Before', during: 'Same day', after: 'After', uncertain: 'Date uncertain' })[key]} ({grouped[key].length})</button>)}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Same-day records are not necessarily simultaneous. Later records do not establish recovery or causation.</p>
        <ul className="mt-3 space-y-3 md:max-h-80 md:overflow-y-auto">
          {grouped[phase].map(record => { const source = historySourceUrl(record.sourceUrl); return <li key={record.id} className="rounded border border-slate-700 bg-slate-950/60 p-3">
            <p className="text-[11px] text-slate-400">{historyDateLabel(record)} · {getEvidenceDisplay(record.evidenceClass).label}</p>
            <p className="mt-1 font-medium text-slate-100">{record.title}</p>
            {record.description && <p className="mt-2 whitespace-pre-wrap leading-relaxed">{record.description}</p>}
            {source ? <a className="mt-2 inline-block text-sky-300 underline" href={source} target="_blank" rel="noreferrer">Open original source</a> : <p className="mt-2 text-amber-200">Source link not available in this record.</p>}
          </li> })}
        </ul>
        {!grouped[phase].length && <p className="mt-3">No loaded records in this group. This does not establish that nothing happened.</p>}
        <p className="mt-2 text-[11px] text-slate-400">{grouped.outside} dated records outside this window. Rainfall totals, river readings and comparisons with earlier incidents have not been assembled by this panel.</p>
      </>}
    </>}
  </section>
}
