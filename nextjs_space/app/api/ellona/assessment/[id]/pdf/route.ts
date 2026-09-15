// Authorised qualification PDF for a customer-created assessment.
// Prohibition enforced here: the assessment MUST be REVIEWED first (review
// before any report), and ONLY private comments the reviewer explicitly flagged
// for inclusion are placed in the brief.

import { prisma } from '@/lib/prisma'
import { EllonaAccessError } from '@/lib/ellona/access'
import { requireCaller, jsonError } from '@/lib/ellona/http'
import { renderOpportunityBrief } from '@/lib/ellona/pdf'
import { DECISION_LABELS, type DecisionType } from '@/lib/ellona/config'
import type { ExtractedField, FieldCategory } from '@/lib/ellona/extraction'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function applyCorrections(fields: ExtractedField[], corrections: Record<string, any>): ExtractedField[] {
  return fields.map((f) => {
    const c = corrections?.[f.key]
    if (!c) return f
    const value = typeof c.value === 'string' && c.value.trim() ? c.value.trim() : f.value
    const category: FieldCategory =
      typeof c.category === 'string' ? (c.category as FieldCategory) : c.value ? 'ELLONA INPUT' : f.category
    const locator = c.locator === null ? null : typeof c.locator === 'string' ? c.locator : f.locator
    return { ...f, value, category, locator }
  })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { membership } = await requireCaller()
    const row = await prisma.opportunityAssessment.findFirst({ where: { id, workspaceId: membership.workspaceId } })
    if (!row) return jsonError(404, 'Assessment not found')
    if (row.status !== 'REVIEWED') {
      return jsonError(409, 'Review the extracted fields and mark the assessment reviewed before generating a brief.')
    }

    const extraction = (row.extraction as any) || {}
    const baseFields: ExtractedField[] = Array.isArray(extraction.fields) ? extraction.fields : []
    const fields = applyCorrections(baseFields, (row.corrections as any) || {})

    const comments = Array.isArray(row.comments) ? (row.comments as any[]) : []
    const notes = comments.filter((c) => c && c.includeInBrief && typeof c.text === 'string').map((c) => c.text as string)

    const base = process.env.NEXTAUTH_URL || 'https://bioveracity.com'
    const recordUrl = `${base}/ellona/assess/${row.id}`
    const decisionLabel = DECISION_LABELS[row.decisionType as DecisionType] || row.decisionType

    const pdf = await renderOpportunityBrief({
      heading: row.title,
      subheading: 'Customer opportunity assessment \u2014 qualification brief',
      recordUrl,
      metaRows: [
        ['Source document', row.documentName],
        ['Decision', decisionLabel],
        ['Reviewed', row.reviewedAt ? new Date(row.reviewedAt).toISOString() : 'not reviewed'],
      ],
      fields,
      notes,
      status: 'REVIEWED',
    })

    const safeName = row.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'assessment'
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
