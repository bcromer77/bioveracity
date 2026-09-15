'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { EvidenceLink } from '@/components/evidence-link'
import { DISTRICTS, type District, type Snapshot } from '@/lib/cambridgeshire/model'
import { connections, searchRegion } from '@/lib/cambridgeshire/search'
import { RegionalStudy } from './regional-study'

export function RegionalSearch({ snapshot, status }: { snapshot: Snapshot | null; status: string }) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [district, setDistrict] = useState<District | ''>('')
  const [limit, setLimit] = useState(25)
  const result = useMemo(() => searchRegion(query, district, snapshot), [query, district, snapshot])
  return <section className="bv-section" aria-labelledby="regional-search-title">
    <p className="bv-eyebrow">Cambridgeshire &amp; Peterborough</p>
    <h2 id="regional-search-title">Follow your curiosity</h2>
    <p>Search wildlife, seasonal displays and habitats across the regional collection. Follow each result to its place and supporting source.</p>
    <form className="my-5 flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); setQuery(input); setLimit(25) }}>
      <label className="flex-1">What would you like to discover?<input className="block w-full rounded border p-3" value={input} maxLength={160} onChange={e => setInput(e.target.value)} placeholder="Find places with badgers in Cambridgeshire" /></label>
      <label>Area<select className="block rounded border p-3" value={district} onChange={e => { setDistrict(e.target.value as District | ''); setLimit(25) }}><option value="">Whole region</option>{Object.entries(DISTRICTS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <button className="bv-button bv-green self-end">Search</button>
    </form>
    <div className="flex flex-wrap gap-3" aria-label="Example searches">{['badgers', 'snowdrops', 'dragonflies', 'orchids', 'woodland', 'wetland', 'winter'].map(q => <button key={q} className="rounded border px-3 py-2" onClick={() => { setInput(q); setQuery(q); setLimit(25) }}>{q}</button>)}</div>
    <p className="my-4 text-sm" role="status">{status} {result.generatedAt && `Snapshot collected ${result.generatedAt.slice(0, 10)}.`}</p>
    <div className="my-6 border-l-4 border-emerald-800 pl-4">
      <h3 className="font-semibold">Organised around the regional nature strategy</h3><p>{result.lnrs.statement}</p><p className="mt-2 text-sm">{result.lnrs.limitation}</p>
      <EvidenceLink href={result.lnrs.source}>Strategy source</EvidenceLink><span> · </span><EvidenceLink href={result.lnrs.map}>Local habitat map reference</EvidenceLink>
    </div>
    <p aria-live="polite">{result.claims.length} place accounts and {result.groups.length} occurrence groups match.</p>
    <p className="mt-2 text-sm">{result.explanation}</p>
    {!result.claims.length && !result.groups.length && <p className="my-5">No matching evidence was located in this collection. Try a broader habitat or another area; this does not establish absence.</p>}
    {result.claims.map(c => <article key={c.id} className="my-5 rounded border p-5">
      <p className="text-sm">{DISTRICTS[c.district]} · {c.kind === 'cultivated-display' ? 'Cultivated display' : 'Manager’s account'}</p>
      <h3 className="text-xl font-semibold"><Link className="underline" href={`/wild/cambridgeshire#${c.placeSlug}`}>{c.title}</Link></h3>
      <p className="mt-2">{c.text}</p><p className="mt-2"><strong>Season:</strong> {c.season}</p><p className="mt-2"><strong>Visiting:</strong> {c.access}</p>
      <p className="mt-3 text-sm"><EvidenceLink href={c.source.url}>{c.source.publisher}</EvidenceLink> · {c.source.locator} · Checked {c.source.checkedAt}. Observation date not established.</p>
      <p className="mt-2 text-sm">Nature-strategy connection: {c.themes.filter(t => t !== 'gardens').join(', ') || 'No habitat-action match established'}. Thematic only; mapped action, funding and delivery unverified.</p>
      {connections(c).map(link => <p className="mt-3" key={link.id}><Link className="underline" href={link.href}>Continue to {link.title}</Link><span className="block text-xs">{link.relation}</span></p>)}
    </article>)}
    {!!result.groups.length && <h3 className="mt-6 font-semibold">Dated occurrence metadata</h3>}
    {result.groups.slice(0, limit).map(g => <article key={g.id} className="my-3 border p-4">
      <h4 className="font-semibold">{g.taxon} · {DISTRICTS[g.district]}</h4>
      <p>{g.count} eligible records; {g.firstYear}–{g.lastYear}. Grouped by reported point within the district; uncertainty can cross its boundary. No exact wildlife locations published.</p>
      <p className="text-sm">Dataset attribution: <EvidenceLink href={`https://www.gbif.org/dataset/${g.datasetKey}`}>{g.attribution}</EvidenceLink>. <EvidenceLink href={g.licence}>Licence</EvidenceLink> · <EvidenceLink href="https://www.gbif.org/occurrence/search">GBIF source catalogue</EvidenceLink></p>
      <p className="text-sm">Regional context; no record-to-visitor-site match or current sighting established.</p>
    </article>)}
    {result.groups.length > limit && <button className="underline" onClick={() => setLimit(n => n + 25)}>Show 25 more occurrence groups</button>}
    <details className="my-6 border p-4"><summary className="cursor-pointer font-semibold">Coverage and evidence gaps</summary>
      <p className="my-2">Named visitor places cover all six districts. That is separate from the completeness of biological records. Refresh attempts do not establish field-survey coverage.</p>
      <ul>{result.coverage.map(c => <li key={c.district} className="my-3"><strong>{c.name}:</strong> {c.places} place accounts. Occurrences: {c.occurrences?.state || 'not imported'}. {c.occurrences && `${c.occurrences.inspected} inspected; ${c.occurrences.accepted} eligible; ${c.occurrences.rejected} excluded; ${c.occurrences.duplicates} duplicates. ${c.occurrences.reason}`}</li>)}</ul>
      {result.gaps.map(g => <p key={g.name} className="my-2"><strong>{g.name}: {g.state}.</strong> {g.reason}</p>)}
      <p>Coverage is limited by licensing, recording effort, location precision and the sources inspected. Proposed actions, funded work, reported delivery and verified improvement require separate evidence.</p>
    </details>
    <RegionalStudy />
  </section>
}
