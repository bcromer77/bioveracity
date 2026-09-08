import Link from 'next/link'
import { auth } from '@/auth'
import { isRegistered } from '@/lib/access'
import { searchReviewedEvidence } from '@/lib/evidence-search'
import { EvidenceResults } from '@/components/search/evidence-results'
import { SearchStatus } from '@/components/search/search-status'

export async function ReviewedSearchPreview({ query }: { query: string }) {
  const session = await auth()
  const href = `/evidence?q=${encodeURIComponent(query)}`
  if (!isRegistered(session)) return <section className="mb-8 rounded-xl border p-5"><h2 className="text-xl font-semibold">Search the evidence</h2><p className="my-2">Sign in to search reviewed environmental claims and their supporting sources.</p><Link className="underline" href={`/login?callbackUrl=${encodeURIComponent(href)}`}>Sign in to search evidence</Link></section>
  try {
    const result = await searchReviewedEvidence(session, { q: query })
    return <section className="mb-8 space-y-4" aria-label="Reviewed evidence results">
      <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-2xl font-semibold">Evidence across places and time</h2><Link className="underline" href={href}>All evidence results and filters</Link></div>
      <SearchStatus result={result} />
      <p className="text-sm text-muted-foreground">Verification applies to each stated claim and its cited passage. It does not establish causation between results.</p>
      {result.hits.length ? <EvidenceResults hits={result.hits.slice(0, 5)} /> : <p>No current reviewed evidence matches yet. The collection is still being built.</p>}
    </section>
  } catch {
    return <section className="mb-8 rounded-xl border p-5"><p role="alert">Evidence search could not complete. This does not mean that no evidence exists.</p><Link className="underline" href={href}>Try evidence search again</Link></section>
  }
}
