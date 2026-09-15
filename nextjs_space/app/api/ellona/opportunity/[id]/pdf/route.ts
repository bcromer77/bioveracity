// Authorised qualification brief for a single monitored opportunity.
// Tenant-scoped; a foreign opportunity id resolves to 404.

import { prisma } from '@/lib/prisma'
import { EllonaAccessError } from '@/lib/ellona/access'
import { requireReader, jsonError } from '@/lib/ellona/http'
import { renderOpportunityBrief } from '@/lib/ellona/pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { membership } = await requireReader()
    const opp = await prisma.opportunity.findFirst({ where: { id, workspaceId: membership.workspaceId } })
    if (!opp) return jsonError(404, 'Opportunity not found')

    const base = process.env.NEXTAUTH_URL || 'https://bioveracity.com'
    const recordUrl = `${base}/ellona/opportunity/${opp.id}`

    const location = [opp.region, opp.country].filter(Boolean).join(', ') || opp.country || '\u2014'
    const value = opp.publishedValue
      ? `${opp.publishedValue}${opp.valueBasis ? ' (' + opp.valueBasis + ')' : ''}`
      : 'Not stated'

    const metaRows: [string, string][] = [
      ['Buyer', opp.buyer],
      ['Project', opp.projectName || opp.title],
      ['Location', location],
      ['Measurement need', opp.measurementNeed || 'Not stated'],
      ['Published value', value],
      ['Publication date', opp.publicationDate || 'Not stated'],
      ['Clarification deadline', opp.clarificationDeadline || 'Not stated'],
      ['Submission deadline', opp.tenderDeadline || 'Not stated'],
      ['Duration', opp.duration || 'Not stated'],
      ['Source', `${opp.sourceName}${opp.officialId ? ' \u2014 ref ' + opp.officialId : ''}`],
      ['Recommended next action', opp.nextAction || 'Review the source and confirm relevance.'],
    ]

    const pdf = await renderOpportunityBrief({
      heading: `${opp.buyer} \u2014 ${opp.title}`,
      subheading: opp.measurementNeed || undefined,
      recordUrl,
      metaRows,
      classification: opp.classification,
      status: opp.status,
    })

    const safeName = `${opp.buyer}-${opp.title}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'opportunity'
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ellona-${safeName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof EllonaAccessError) return jsonError(error.status, error.message)
    return jsonError(500, 'The brief could not be generated.')
  }
}
