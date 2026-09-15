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
    <p>Snowdrops, old woods or something you’ve never noticed before? Find a place that sparks your curiosity, then explore its story.</p>
    <form className="my-5 flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); setQuery(input); setLimit(25) }}>
      <label className="flex-1">What would you like to discover?<input className="block w-full rounded border p-3" value={input} maxLength={160} onChange={e => setInput(e.target.value)} placeholder="Find places with badgers in Cambridgeshire" /></label>
      <label>Area<select className="block rounded border p-3" value={district} onChange={e => { setDistrict(e.target.value as District | ''); setLimit(25) }}><option value="">Whole region</option>{Object.entries(DISTRICTS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <button className="bv-button bv-green self-end">Search</button>
    </form>
    <div className="flex flex-wrap gap-3" aria-label="Example searches">{['badgers', 'snowdrops', 'dragonflies', 'orchids', 'woodland', 'wetland', 'winter'].map(q => <button key={q} className="rounded border px-3 py-2" onClick={() => { setInput(q); setQuery(q); setLimit(25) }}>{q}</button>)}</div>
    <p className="my-4 text-sm" role="status">{status} {result.generatedAt && `Wildlife information gathered ${result.generatedAt.slice(0, 10)}.`}</p>
    <div className="my-6 border-l-4 border-emerald-800 pl-4">
      <details><summary className="cursor-pointer font-semibold">How these places fit into local nature recovery</summary><p>{result.lnrs.statement}</p><p className="mt-2 text-sm">{result.lnrs.limitation}</p>
      <EvidenceLink href={result.lnrs.source}>Strategy source</EvidenceLink><span> · </span><EvidenceLink href={result.lnrs.map}>Explore the habitat map</EvidenceLink></details>
    </div>
    <p aria-live="polite">{result.claims.length} matching place stories · {result.groups.length} wildlife record summaries</p>
    <p className="mt-2 text-sm">{result.explanation}</p>
    {!result.claims.length && !result.groups.length && <p className="my-5">Nothing here matches that search yet. Try a woodland, a season or another area. Our collection is still growing.</p>}
    {result.claims.map(c => <article key={c.id} className="my-5 rounded border p-5">
      <p className="text-sm">{DISTRICTS[c.district]} · {c.kind === 'cultivated-display' ? 'Garden display' : 'From the people who care for this place'}</p>
      <h3 className="text-xl font-semibold"><Link className="underline" href={`/wild/cambridgeshire#${c.placeSlug}`}>{c.title}</Link></h3>
      <p className="mt-2">{c.text}</p><p className="mt-2"><strong>Season:</strong> {c.season}</p><p className="mt-2"><strong>Visiting:</strong> {c.access}</p>
      <p className="mt-3 text-sm"><EvidenceLink href={c.source.url}>{c.source.publisher}</EvidenceLink> · {c.source.locator} · Checked {c.source.checkedAt}. The source does not give a confirmed sighting date.</p>
      <p className="mt-2 text-sm">Related habitats: {c.themes.filter(t => t !== 'gardens').join(', ') || 'No habitat link confirmed'}. This link is about habitat type; it does not confirm funded or completed conservation work.</p>
      {connections(c).map(link => <p className="mt-3" key={link.id}><Link className="underline" href={link.href}>Continue to {link.title}</Link><span className="block text-xs">{link.relation}</span></p>)}
    </article>)}
    {!!result.groups.length && <h3 className="mt-6 font-semibold">Wildlife recorded in the wider area</h3>}
    {result.groups.slice(0, limit).map(g => <article key={g.id} className="my-3 border p-4">
      <h4 className="font-semibold">{g.taxon} · {DISTRICTS[g.district]}</h4>
      <p>{g.count} records from {g.firstYear}–{g.lastYear}. These describe the wider area, not a place where a sighting is guaranteed.</p>
      <p className="text-sm">Records shared by: <EvidenceLink href={`https://www.gbif.org/dataset/${g.datasetKey}`}>{g.attribution}</EvidenceLink>. <EvidenceLink href={g.licence}>Licence</EvidenceLink> · <EvidenceLink href="https://www.gbif.org/occurrence/search">Explore the original collection</EvidenceLink></p>
      <p className="text-sm">Locations can be approximate and may fall across district boundaries. We do not publish exact wildlife locations or link these records to a particular visitor site.</p>
    </article>)}
    {result.groups.length > limit && <button className="underline" onClick={() => setLimit(n => n + 25)}>Show more wildlife records</button>}
    <details className="my-6 border p-4"><summary className="cursor-pointer font-semibold">What we know — and what we’re still missing</summary>
      <p className="my-2">There are place stories from all six districts. Wildlife records are less evenly spread: some places have been studied more than others. Updating this page is not the same as carrying out a wildlife survey.</p>
      <ul>{result.coverage.map(c => <li key={c.district} className="my-3"><strong>{c.name}:</strong> {c.places} place accounts. Occurrences: {c.occurrences?.state || 'not imported'}. {c.occurrences && `${c.occurrences.inspected} inspected; ${c.occurrences.accepted} eligible; ${c.occurrences.rejected} excluded; ${c.occurrences.duplicates} duplicates. ${c.occurrences.reason}`}</li>)}</ul>
      {result.gaps.map(g => <p key={g.name} className="my-2"><strong>{g.name}: {g.state}.</strong> {g.reason}</p>)}
      <p>Coverage is limited by licensing, recording effort, location precision and the sources inspected. Proposed actions, funded work, reported delivery and verified improvement require separate evidence.</p>
    </details>
    <RegionalStudy />
  </section>
}
