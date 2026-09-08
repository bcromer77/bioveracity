import { auth } from '@/auth'
import { isAdmin } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { evidenceEnabled } from '@/lib/evidence-http'
import { EvidenceReviewForm } from '@/components/admin/evidence-review'
export const dynamic = 'force-dynamic'
export default async function EvidenceReviewPage({ searchParams }: { searchParams: Promise<{ id?: string; page?: string }> }) {
  if (!isAdmin(await auth())) return <main className="p-8">Administrator access required.</main>
  if (!evidenceEnabled()) return <main className="p-8">Evidence pipeline is not enabled.</main>
  const params = await searchParams
  const page = Math.max(0, Math.min(100000, Number.parseInt(params.page ?? '0', 10) || 0))
  const documents = params.id
    ? await prisma.evidenceDocument.findMany({ where: { id: params.id }, take: 1 })
    : await prisma.evidenceDocument.findMany({ where: { status: 'PENDING_REVIEW' }, orderBy: [{ observedAt: 'desc' }, { id: 'desc' }], skip: page * 20, take: 20 })
  return <main className="mx-auto max-w-4xl space-y-6 p-8"><h1 className="text-3xl font-bold">Review source evidence</h1>
    <p>Collected text is unverified. Read the original source before approving a specific claim. New source versions need a new review. Showing up to 20 pending documents.</p>
    <form><label>Open a document by ID <input name="id" defaultValue={params.id} className="rounded border p-2" /></label><button className="ml-2 underline">Open</button></form>
    {!params.id && <nav className="flex gap-4">{page > 0 && <a href={`?page=${page - 1}`}>Previous</a>}{documents.length === 20 && <a href={`?page=${page + 1}`}>Next</a>}</nav>}
    {documents.map(d => <article key={d.id} className="space-y-4 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">{d.title}</h2><a className="underline" href={d.url} target="_blank" rel="noreferrer">Open original source</a>
      <p>{d.publisher} · {d.authorityId} · Event: {d.eventDate ?? 'Unknown'} · Published: {d.publicationDate ?? 'Unknown'} · Status: {d.status} · ID: {d.id}</p>
      <details><summary>Retained source text</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap text-sm">{JSON.stringify(d.sections, null, 2)}</pre></details>
      <EvidenceReviewForm id={d.id} sections={d.sections as { locator: string; text: string }[]} />
    </article>)}
  </main>
}
