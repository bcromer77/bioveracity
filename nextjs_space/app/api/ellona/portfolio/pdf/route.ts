// Authorised portfolio PDF across the tenant's current opportunities.

import { prisma } from '@/lib/prisma'
import { EllonaAccessError } from '@/lib/ellona/access'
import { requireCaller, jsonError } from '@/lib/ellona/http'
import { renderPortfolio, type PortfolioItem } from '@/lib/ellona/pdf'
import { ELLONA } from '@/lib/ellona/config'
import { formatDublin } from '@/lib/ellona/trial'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const { membership } = await requireCaller()
    const base = process.env.NEXTAUTH_URL || 'https://bioveracity.com'

    const opps = await prisma.opportunity.findMany({
      where: { workspaceId: membership.workspaceId, status: { notIn: ['NOT RELEVANT', 'CLOSED', 'SUPERSEDED'] } },
      orderBy: [{ tenderDeadline: 'asc' }, { createdAt: 'desc' }],
    })

    const items: PortfolioItem[] = opps.map((o) => ({
      buyer: o.buyer,
      title: o.title,
      classification: o.classification,
      status: o.status,
      measurementNeed: o.measurementNeed,
      deadline: o.tenderDeadline || null,
      location: [o.region, o.country].filter(Boolean).join(', ') || o.country || null,
      recordUrl: `${base}/ellona/opportunity/${o.id}`,
    }))

    const pdf = await renderPortfolio({
      dashboardUrl: `${base}/ellona`,
      generatedForLabel: `${ELLONA.workspaceName} \u2014 ${formatDublin(new Date(), true)}`,
      items,
    })

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="ellona-opportunity-portfolio.pdf"',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof EllonaAccessError) return jsonError(error.status, error.message)
    return jsonError(500, 'The portfolio could not be generated.')
  }
}
