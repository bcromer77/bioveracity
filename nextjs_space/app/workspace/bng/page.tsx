import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { adapter } from '@/lib/workspaces/http'
import { workspaceService } from '@/lib/workspaces/service'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const dynamic = 'force-dynamic'

type Writable = { id: string; name: string }

// Entry point for the professionals “Start a BNG Evidence Record” call to action.
// It never guesses which workspace to use: an explicit, write-permitted destination
// wins; otherwise 0 writable workspaces creates one, exactly 1 is used, and more than
// one asks the person to choose. Viewers and reviewers can never authorise creation
// because they are not counted as writable members.
export default async function BngSetupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=/workspace/bng')
  const userId = session.user.id

  if (process.env.PRIVATE_WORKSPACES_ENABLED !== 'true') {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-[760px] flex-1 px-4 py-10">
          <h1 className="font-display text-3xl font-bold tracking-tight">BNG Evidence Record</h1>
          <p className="mt-4 text-sm text-muted-foreground">Private evidence records are not enabled on this deployment yet. Please <Link href="/contact" className="underline">get in touch</Link> to arrange a managed setup.</p>
        </main>
        <SiteFooter />
      </div>
    )
  }

  let writable: Writable[] = []
  let failed = false
  try {
    writable = await prisma.$queryRawUnsafe<Writable[]>(
      'SELECT w.id, w.name FROM "PrivateWorkspace" w JOIN "PrivateWorkspaceMember" m ON m."workspaceId"=w.id WHERE m."userId"=$1 AND m."revokedAt" IS NULL AND m.role IN (\'OWNER\',\'CONTRIBUTOR\') ORDER BY w."createdAt" DESC',
      userId,
    )
  } catch { failed = true }

  const requested = typeof sp.workspace === 'string' ? sp.workspace : ''
  let target = ''
  let createError = false
  if (requested) {
    if (writable.some(w => w.id === requested)) target = requested
  } else if (!failed) {
    if (writable.length === 1) target = writable[0].id
    else if (writable.length === 0) {
      try {
        const service = workspaceService({
          ...adapter(prisma),
          transaction: op => prisma.$transaction(tx => op(adapter(tx)), { isolationLevel: 'Serializable' }),
        }, userId)
        const created = await service.createWorkspace({ name: 'BNG Evidence Record', persona: 'ecology' })
        target = created.id
      } catch { createError = true }
    }
  }
  if (target) redirect(`/workspace/${encodeURIComponent(target)}?template=BNG`)

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 py-10">
        <p className="text-sm"><Link href="/professionals" className="underline">← Back to professionals</Link></p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Start a BNG Evidence Record</h1>
        {failed || createError ? (
          <div role="alert" className="mt-6 rounded-md border border-destructive p-4 text-sm">
            <p>We could not set up your BNG Evidence Record just now. Your last action was not saved.</p>
            <p className="mt-2">Open your <Link href="/workspace" className="underline">private workspaces</Link> and try again, or refresh this page.</p>
          </div>
        ) : requested ? (
          <div className="mt-6 rounded-md border border-border p-4 text-sm">
            <p>That workspace is not available to your account, or you do not have permission to add a case to it.</p>
            <p className="mt-2">Choose one of your own workspaces below.</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">You can add a BNG Evidence Record to any of your workspaces. Choose where it should live.</p>
        )}
        {writable.length > 0 && (
          <ul className="mt-6 space-y-3">
            {writable.map(w => (
              <li key={w.id}>
                <Link href={`/workspace/bng?workspace=${encodeURIComponent(w.id)}`} className="block rounded-md border border-border p-4 focus-visible:ring-2 focus-visible:ring-ring hover:border-primary">
                  <span className="block font-medium break-words">{w.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Add a BNG Evidence Record here</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm"><Link href="/workspace" className="underline">Go to all workspaces</Link></p>
      </main>
      <SiteFooter />
    </div>
  )
}
