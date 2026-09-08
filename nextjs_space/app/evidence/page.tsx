import Link from 'next/link'
import { auth } from '@/auth'
import { isRegistered } from '@/lib/access'
import { evidenceEnabled } from '@/lib/evidence-http'
import { searchReviewedEvidence, type EvidenceQuery, type SearchOutcome } from '@/lib/evidence-search'
import { SearchStatus } from '@/components/search/search-status'
import { EvidenceResults } from '@/components/search/evidence-results'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export default async function EvidencePage({ searchParams }: { searchParams: Promise<EvidenceQuery> }) {
  if (!evidenceEnabled()) return <main className="mx-auto max-w-3xl p-8"><h1>Evidence search is being connected</h1><Link href="/search">Search places</Link></main>
  const session = await auth()
  if (!isRegistered(session)) return <main className="mx-auto max-w-3xl space-y-4 p-8"><h1>Search the evidence</h1><p>Sign in with your BioVeracity account to search reviewed claims and read their supporting passages.</p><Link href="/login?callbackUrl=%2Fevidence">Sign in to search</Link></main>
  const p = await searchParams
  let result: SearchOutcome = { hits: [], mode: 'browse' }, failed = false
  let councils: { authorityId: string; publisher: string }[] = []
  try {
    result = await searchReviewedEvidence(session, p)
    councils = await prisma.$queryRaw`WITH current_documents AS (
      SELECT DISTINCT ON ("documentKey") * FROM "EvidenceDocument" ORDER BY "documentKey", "observedAt" DESC, id DESC
    ) SELECT DISTINCT d."authorityId", d.publisher FROM current_documents d
      JOIN "EvidenceReview" r ON r.id = d."activeReviewId" AND r."documentId" = d.id
      WHERE d.status = 'VERIFIED' ORDER BY d.publisher LIMIT 1000`
  } catch { failed = true }
  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-10">
    <Link href="/search" className="text-sm underline">Places</Link>
    <header><p className="text-sm font-semibold text-emerald-800">BioVeracity</p><h1 className="text-3xl font-bold">Search the evidence</h1>
      <p className="mt-2 text-muted-foreground">Explore environmental questions across places and time. Read the checked claims and source passages behind each result.</p></header>
    <form className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
      <label className="md:col-span-2">Search<input name="q" defaultValue={p.q} maxLength={300} placeholder="Flooding, river quality, planning decisions…" className="mt-1 w-full rounded border p-3" /></label>
      <label className="md:col-span-2">Council<select name="authority" defaultValue={p.authority ?? ''} className="mt-1 w-full rounded border p-2"><option value="">All councils in the reviewed collection</option>{councils.map(c => <option key={c.authorityId} value={c.authorityId}>{c.publisher}</option>)}</select></label>
      <label>Event from<input type="date" name="from" defaultValue={p.from} className="mt-1 block w-full rounded border p-2" /></label>
      <label>Event to<input type="date" name="to" defaultValue={p.to} className="mt-1 block w-full rounded border p-2" /></label>
      <label>Match<select name="mode" defaultValue={p.mode ?? 'hybrid'} className="mt-1 block w-full rounded border p-2"><option value="hybrid">Meaning and keywords</option><option value="keyword">Keywords only</option></select></label>
      <label>Show results by<select name="sort" defaultValue={p.sort ?? 'relevance'} className="mt-1 block w-full rounded border p-2"><option value="relevance">Relevance</option><option value="event">Event date — oldest first</option></select></label>
      <button className="rounded bg-emerald-800 px-5 py-3 font-semibold text-white md:col-span-2">Search evidence</button>
    </form>
    <p className="text-sm text-muted-foreground">“Verified by BioVeracity” means a reviewer checked that the cited passage supports the stated claim. It does not establish causation or independently certify an operator’s statement. Date filters include only records with known day-level event dates.</p>
    {p.sort === 'event' && <p className="text-sm">The top 30 retrieved results are arranged by known event day. Coarse and unknown dates appear afterwards. This is not an exhaustive timeline.</p>}
    {failed ? <p role="alert">Search could not complete. Check the date range or try again; this is not evidence that no records exist.</p> : <><SearchStatus result={result} /><p>{result.hits.length} checked results shown (up to 30).</p>{result.hits.length ? <EvidenceResults hits={result.hits} /> : <p>No current reviewed evidence matches these filters. Coverage is still being built.</p>}</>}
  </main>
}
