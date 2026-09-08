import Link from 'next/link'
import { auth } from '@/auth'
import { isInstitutional } from '@/lib/access'
import { evidenceEnabled } from '@/lib/evidence-http'
import { searchEvidence } from '@/lib/evidence-store'
import { EvidenceResults } from '@/components/search/evidence-results'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export default async function EvidencePage({ searchParams }: { searchParams: Promise<{ q?: string; authority?: string; from?: string; to?: string }> }) {
  if (!evidenceEnabled()) return <main className="mx-auto max-w-3xl p-8"><h1>Evidence search is being connected</h1><Link href="/search">Search places</Link></main>
  if (!isInstitutional(await auth())) return <main className="mx-auto max-w-3xl p-8"><h1>Source evidence search</h1><p>Institutional access is required for source passages and evidence history.</p><Link href="/login">Sign in</Link></main>
  const p = await searchParams
  let hits: Awaited<ReturnType<typeof searchEvidence>> = [], failed = false
  let councils: { authorityId: string; publisher: string }[] = []
  try {
    hits = await searchEvidence(p.q ?? '', p.authority ?? '', p.from ?? '', p.to ?? '')
    councils = await prisma.evidenceDocument.findMany({ where: { status: 'VERIFIED' }, distinct: ['authorityId'], select: { authorityId: true, publisher: true }, orderBy: { publisher: 'asc' }, take: 1000 })
  } catch { failed = true }
  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-10">
    <Link href="/search" className="text-sm underline">Places</Link>
    <header><p className="text-sm font-semibold text-emerald-800">BioVeracity</p><h1 className="text-3xl font-bold">Search the evidence</h1>
      <p className="mt-2 text-muted-foreground">Find checked claims and the source passages behind them.</p></header>
    <form className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
      <label className="md:col-span-2">Search<input name="q" defaultValue={p.q} maxLength={300} placeholder="Flooding, river quality, planning decisions…" className="mt-1 w-full rounded border p-3" /></label>
      <label className="md:col-span-2">Council<select name="authority" defaultValue={p.authority ?? ''} className="mt-1 w-full rounded border p-2"><option value="">All councils in the reviewed collection</option>{councils.map(c => <option key={c.authorityId} value={c.authorityId}>{c.publisher}</option>)}</select></label>
      <label>Event from<input type="date" name="from" defaultValue={p.from} className="mt-1 block w-full rounded border p-2" /></label>
      <label>Event to<input type="date" name="to" defaultValue={p.to} className="mt-1 block w-full rounded border p-2" /></label>
      <button className="rounded bg-emerald-800 px-5 py-3 font-semibold text-white md:col-span-2">Search evidence</button>
    </form>
    <p className="text-sm text-muted-foreground">“Verified by BioVeracity” means a reviewer checked that the cited passage supports the stated claim. It does not establish causation or independently certify an operator’s statement. Date filters include only records with known day-level event dates.</p>
    {failed ? <p role="alert">Search could not complete. Check the date range or try again; this is not evidence that no records exist.</p> : <><p>{hits.length} checked results shown (up to 30).</p>{hits.length ? <EvidenceResults hits={hits} /> : <p>No current reviewed evidence matches these filters. Coverage is still being built.</p>}</>}
  </main>
}
