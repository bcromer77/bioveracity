import { auth } from '@/auth'
import { isAdmin } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { categoryLabel } from '@/lib/register-interest/interest'

export const dynamic = 'force-dynamic'

// PR54 — smallest useful way for an authorised administrator to inspect
// register-interest leads with their controlled source and category. This is
// deliberately a simple read-only table, not a CRM. Lead data is never public;
// the page returns an access notice for anyone who is not an administrator.
export default async function InterestLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  if (!isAdmin(await auth())) return <main className="p-8">Administrator access required.</main>

  const params = await searchParams
  const page = Math.max(0, Math.min(100000, Number.parseInt(params.page ?? '0', 10) || 0))
  const [leads, total] = await Promise.all([
    prisma.interestLead.findMany({ orderBy: { createdAt: 'desc' }, skip: page * 50, take: 50 }),
    prisma.interestLead.count(),
  ])

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <h1 className="text-3xl font-bold">Register interest</h1>
      <p>People who have raised their hand. {total} in total. Showing up to 50 per page, newest first. This is demand capture only — no account, workspace or payment is created by a submission.</p>
      <nav className="flex gap-4">
        {page > 0 && <a className="underline" href={`?page=${page - 1}`}>Previous</a>}
        {leads.length === 50 && <a className="underline" href={`?page=${page + 1}`}>Next</a>}
      </nav>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Organisation</th>
              <th className="py-2 pr-4">Interest</th>
              <th className="py-2 pr-4">Source</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Message</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b align-top">
                <td className="py-2 pr-4 whitespace-nowrap">{l.createdAt.toISOString().slice(0, 10)}</td>
                <td className="py-2 pr-4">{l.name}</td>
                <td className="py-2 pr-4"><a className="underline" href={`mailto:${l.email}`}>{l.email}</a></td>
                <td className="py-2 pr-4">{l.organisation ?? '—'}</td>
                <td className="py-2 pr-4">{categoryLabel(l.category)}</td>
                <td className="py-2 pr-4">{l.source}</td>
                <td className="py-2 pr-4">{l.status}</td>
                <td className="py-2 pr-4 max-w-xs whitespace-pre-wrap">{l.message ?? '—'}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No interest registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
