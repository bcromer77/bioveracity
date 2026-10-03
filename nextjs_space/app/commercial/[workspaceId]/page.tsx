import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { adapter } from '@/lib/workspaces/http'
import { commercialService } from '@/lib/commercial/service'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const dynamic = 'force-dynamic'

export default async function CommercialPortfolioPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/commercial/${workspaceId}`)}`)
  if (process.env.PRIVATE_WORKSPACES_ENABLED !== 'true') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p>Commercial intelligence is not enabled on this deployment.</p>
      </main>
    )
  }
  const service = commercialService({
    ...adapter(prisma),
    transaction: operation => prisma.$transaction(tx => operation(adapter(tx)), { isolationLevel: 'Serializable' }),
  }, session.user.id)
  let portfolios: Awaited<ReturnType<typeof service.portfolios>> = []
  let summaries: Array<{ name: string; role: string; assetsMonitored: number; assetsWithChange: number; newRecords: number }> = []
  let unavailable = false
  try {
    portfolios = await service.portfolios(workspaceId)
    for (const portfolio of portfolios) {
      const summary = await service.summary(workspaceId, portfolio.id)
      summaries.push({ name: portfolio.name, role: portfolio.role, assetsMonitored: summary.assetsMonitored, assetsWithChange: summary.assetsWithChange, newRecords: summary.newRecords })
    }
  } catch {
    unavailable = true
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm">Commercial intelligence</p>
        <h1 className="mt-2 text-3xl">What changed around these assets</h1>
        <p className="mt-4">BioVeracity does not decide that an asset is at risk. Distance is not dependency. A missing record is not safety. A plan is not a completed project.</p>
        {unavailable ? <p className="mt-8">This workspace is not available to this account.</p> : null}
        {!unavailable && summaries.length === 0 ? <p className="mt-8">No portfolio has been granted to this account.</p> : null}
        <ul className="mt-8 space-y-4">
          {summaries.map(portfolio => (
            <li key={portfolio.name} className="border p-4">
              <h2 className="text-xl">{portfolio.name}</h2>
              <p>{portfolio.assetsMonitored} assets monitored. {portfolio.assetsWithChange} have a sourced change. {portfolio.newRecords} change records. Your access is {portfolio.role}.</p>
              <p className="mt-2">A change record is not a risk score. Open the issued report for the source, the dates and the question put to finance or legal.</p>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  )
}
