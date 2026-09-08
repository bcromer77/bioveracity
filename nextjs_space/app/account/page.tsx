import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { AccountView } from '@/components/account/account-view'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const watchlists = await prisma.watchlist.findMany({
    where: { userId: session?.user?.id },
    include: { asset: { select: { name: true, slug: true, type: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const leads = await prisma.lead.findMany({
    where: { userId: session?.user?.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <AccountView user={session?.user ?? {}} watchlists={watchlists ?? []} leads={leads ?? []} />
      </main>
      <SiteFooter />
    </div>
  )
}
