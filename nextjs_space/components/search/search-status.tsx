import type { SearchOutcome } from '@/lib/evidence-search'

export function SearchStatus({ result }: { result: SearchOutcome }) {
  return <div role="status" className="rounded-lg bg-secondary/40 p-3 text-sm">
    <p>{result.mode === 'hybrid' ? 'Matched by meaning and keywords. Related passages may use different wording; relevance is not proof of a connection.' : result.mode === 'browse' ? 'Browsing current reviewed claims.' : 'Showing keyword matches.'}</p>
    {result.notice === 'unavailable' && <p>Meaning-based search is unavailable right now. Keyword search is still available.</p>}
    {result.notice === 'rate_limited' && <p>You have reached the meaning-based search limit for this minute. Try again shortly, or continue with keywords.</p>}
    {result.notice === 'index_pending' && <p>Some reviewed claims are still being prepared for meaning-based search. They remain searchable by keyword.</p>}
    {result.eligible !== undefined && <p className="mt-1">{result.indexed} of {result.eligible} current reviewed claims within these filters are ready for meaning-based search. This describes our collection, not complete coverage of the area.</p>}
  </div>
}
