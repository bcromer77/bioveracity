import { personalDestination } from '@/lib/personal-destination'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { adapter } from '@/lib/workspaces/http'
import { workspaceService } from '@/lib/workspaces/service'
export const dynamic = 'force-dynamic'

export default async function StartPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=/start')
  const service = workspaceService({...adapter(prisma), transaction: op => prisma.$transaction(tx => op(adapter(tx)), {isolationLevel:'Serializable'})}, session.user.id)
  // Each query is scoped to the authenticated account. Never infer access from a persona.
  const [workspaces, hubs] = await Promise.all([
    process.env.PRIVATE_WORKSPACES_ENABLED === 'true' ? service.listWorkspaces() : Promise.resolve([]),
    prisma.wildHub.findMany({where:{ownerId:session.user.id},select:{id:true,profile:true},orderBy:{id:'asc'},take:100}),
  ])
  const cases = workspaces.length === 1 && !hubs.length ? await service.listCases(workspaces[0].id) : []
  const destination = personalDestination(workspaces,hubs.length,cases)
  if (destination) redirect(destination)
  return <><SiteHeader/><main className="mx-auto max-w-[1100px] space-y-8 px-4 py-10">
    <header><h1 className="text-3xl font-bold">{session.user.name ? `Welcome, ${session.user.name}` : 'Your BioVeracity'}</h1><p className="mt-2">{workspaces.length || hubs.length ? 'Continue your work or open your venue.' : 'Choose what you want to do first. You can use both experiences with this account.'}</p></header>
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-lg border p-5 space-y-4"><h2 className="text-xl font-semibold">Your venues</h2>{hubs.map(h=>{const profile=h.profile as {name?:string};return <p key={h.id}><Link className="underline" href="/wild/studio">{profile.name || 'Your venue'}</Link></p>})}<Link className="inline-block rounded border p-3" href="/wild/studio">{hubs.length ? 'Open venue studio' : 'Set up your venue'}</Link><p>Manage your venue, photographs and publication reviews.</p></section>
      <section className="rounded-lg border p-5 space-y-4"><h2 className="text-xl font-semibold">Your professional work</h2>{workspaces.map(w=><p key={w.id}><Link className="underline" href={`/workspace/${encodeURIComponent(w.id)}`}>{w.name}</Link><span className="block text-sm">{w.caseCount} cases{w.recentCaseTitle ? ` · ${w.recentCaseTitle}` : ''}</span></p>)}<Link className="inline-block rounded border p-3" href="/workspace">{workspaces.length ? 'All workspaces' : 'Create a private workspace'}</Link><p>Organise source documents, review evidence and produce reports.</p></section>
    </div><nav aria-label="Your account" className="flex flex-wrap gap-5"><Link className="underline" href="/my-places">Places you follow</Link><Link className="underline" href="/account">Account, downloads and data requests</Link></nav>
  </main><SiteFooter/></>
}
