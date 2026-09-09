import type { EvidenceHit } from '@/lib/evidence-store'

export function EvidenceResults({ hits }: { hits: EvidenceHit[] }) {
  return <div className="space-y-4">{hits.map(hit => <article key={hit.id} className="rounded-xl border p-5">
    <p className="text-xs font-semibold text-emerald-800">Verified by BioVeracity · {hit.evidenceType.replace(/_/g, ' ')}</p>
    {hit.matchType && <p className="mt-1 text-xs text-muted-foreground">{hit.matchType === 'both' ? 'Meaning and keyword match' : hit.matchType === 'meaning' ? 'Related meaning' : 'Keyword match'}</p>}
    <h2 className="mt-2 text-xl font-semibold">{hit.claim}</h2>
    <p className="mt-2 text-sm text-muted-foreground">{hit.publisher} · {hit.jurisdiction}</p>
    <blockquote className="my-4 border-l-2 pl-4 text-sm">{hit.excerpt}</blockquote>
    <a href={hit.url} target="_blank" rel="noreferrer" className="text-sm underline">{hit.title} · {hit.locator}</a>
    <p className="mt-3 text-xs text-muted-foreground">{hit.attribution} · Licence: {hit.licence}</p>
    <dl className="mt-4 flex flex-wrap gap-5 text-xs text-muted-foreground">
      <div><dt>Event date</dt><dd>{hit.eventDate ?? 'Not established'}{hit.eventPrecision === 'month' || hit.eventPrecision === 'year' ? ` (${hit.eventPrecision} only)` : ''}</dd></div>
      <div><dt>Published</dt><dd>{hit.publicationDate ?? 'Not established'}</dd></div>
      <div><dt>Source retrieved</dt><dd>{hit.observedAt.toISOString().slice(0, 10)}</dd></div>
      <div><dt>Claim checked</dt><dd>{hit.checkedAt.toISOString().slice(0, 10)}</dd></div>
    </dl>
  </article>)}</div>
}
