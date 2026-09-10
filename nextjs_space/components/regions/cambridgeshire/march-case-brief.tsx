'use client'
import Link from 'next/link'
import { MARCH_CASE } from '@/lib/march-case'
import { StationRainfallPanel } from './station-rainfall-panel'

export function MarchCaseBrief() {
  return <main className="mx-auto max-w-4xl px-5 py-10 text-slate-900 print:[&_details]:bg-white print:[&_details]:text-black print:[&_table]:text-black">
    <nav className="mb-6 flex flex-wrap gap-4 print:hidden"><Link href="/regions/cambridgeshire-peterborough/live" className="underline">Regional map</Link><Link href="/evidence?q=March%20lime%20treatment" className="underline">Search reviewed evidence</Link><button className="underline" onClick={() => window.print()}>Print / save brief as PDF</button></nav>
    <p className="text-sm font-semibold uppercase tracking-wide">BioVeracity · Source-linked case brief</p>
    <h1 className="mt-3 text-3xl font-semibold">{MARCH_CASE.title}</h1>
    <p className="mt-4 leading-relaxed">{MARCH_CASE.summary}</p>
    <p className="mt-3 text-sm">Evidence type: operator statement. Source passage checked 8 September 2026. This brief does not establish a statutory finding or verified operating performance.</p>
    <h2 className="mt-8 text-xl font-semibold">What the record says</h2>
    <ol className="mt-4 space-y-3">{MARCH_CASE.events.map(event => <li key={event.date} className="border-l-4 border-amber-400 pl-4"><p className="font-semibold">{event.date} · {event.title}</p><p>{event.type}</p></li>)}</ol>
    <h2 className="mt-8 text-xl font-semibold">Open the supporting source</h2>
    <p className="mt-3">{MARCH_CASE.publisher}. Published {MARCH_CASE.publicationDate}.</p>
    <p className="mt-2">Location: {MARCH_CASE.locator}.</p>
    <a className="mt-2 block break-words underline" href={MARCH_CASE.source} target="_blank" rel="noreferrer">{MARCH_CASE.source}</a>
    <h2 className="mt-8 text-xl font-semibold">What remains unresolved</h2>
    <ul className="mt-3 list-disc space-y-2 pl-5">{MARCH_CASE.questions.map(question => <li key={question}>{question}</li>)}</ul>
    <p className="mt-3">These dates share one source. They are not three independent confirmations. No operating logs, odour measurements or wind series have been connected to this brief.</p>
    <div className="mt-6 rounded bg-slate-900 p-3 print:bg-white"><StationRainfallPanel date="2025-07-27" defaultStation="chatteris" /></div>
    <p className="mt-6 text-sm">Rainfall is optional context from a separately identified station. It cannot demonstrate whether the pause happened or explain an odour change on its own. The original statement remains the authority for its own wording.</p>
  </main>
}
