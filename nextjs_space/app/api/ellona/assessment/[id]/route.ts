// A single customer-created Opportunity Assessment: read the reviewed extraction
// (GET) and record the reviewer's corrections, private comments, decision and
// the review sign-off (PATCH). Strictly tenant-scoped: an assessment id that
// belongs to another workspace resolves to 404, never leaks.

import { prisma } from '@/lib/prisma'
import { EllonaAccessError } from '@/lib/ellona/access'
import { requireCaller, jsonError, privateHeaders } from '@/lib/ellona/http'
import { trialAllowsWrites } from '@/lib/ellona/access'
import { DECISION_TYPES } from '@/lib/ellona/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function loadOwned(workspaceId: string, id: string) {
  const row = await prisma.opportunityAssessment.findFirst({ where: { id, workspaceId } })
  return row
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { membership } = await requireCaller()
    const row = await loadOwned(membership.workspaceId, id)
    if (!row) return jsonError(404, 'Assessment not found')
    return Response.json(
      {
        id: row.id,
        title: row.title,
        status: row.status,
        decisionType: row.decisionType,
        documentName: row.documentName,
        mediaType: row.mediaType,
        parserVersion: row.parserVersion,
        extraction: row.extraction,
        corrections: row.corrections,
        comments: row.comments,
        reviewedAt: row.reviewedAt,
        createdAt: row.createdAt,
      },
      { headers: privateHeaders },
    )
  } catch (error) {
    if (error instanceof EllonaAccessError) return jsonError(error.status, error.message)
    return jsonError(500, 'Request failed')
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { membership } = await requireCaller()
    const workspaceId = membership.workspaceId

    const tenant = await prisma.partnerTenant.findUnique({ where: { workspaceId } })
    if (!tenant) return jsonError(404, 'Workspace unavailable')
    if (!trialAllowsWrites(tenant.trialState, tenant.trialEndsAt)) {
      return jsonError(403, 'Your trial is read-only. Changes cannot be saved until the trial is converted.')
    }

    const row = await loadOwned(workspaceId, id)
    if (!row) return jsonError(404, 'Assessment not found')

    let body: any = null
    try {
      body = await request.json()
    } catch {
      return jsonError(400, 'Expected a JSON body.')
    }

    const data: Record<string, unknown> = {}

    // Field corrections: a partial map of { fieldKey: { value?, category?, locator? } }.
    if (body?.corrections && typeof body.corrections === 'object') {
      data.corrections = body.corrections
    }

    // Private comments: array of { text, includeInBrief? }. Stored with a stamp
    // and author. Only comments explicitly flagged includeInBrief are ever put
    // into a generated PDF (enforced in the pdf route).
    if (Array.isArray(body?.comments)) {
      data.comments = body.comments
        .filter((c: any) => c && typeof c.text === 'string' && c.text.trim())
        .map((c: any) => ({
          text: String(c.text).slice(0, 2000),
          includeInBrief: c.includeInBrief === true,
          at: typeof c.at === 'string' ? c.at : new Date().toISOString(),
        }))
    }

    if (typeof body?.decisionType === 'string') {
      const d = body.decisionType.toUpperCase()
      if ((DECISION_TYPES as readonly string[]).includes(d)) data.decisionType = d
    }

    if (body?.markReviewed === true) {
      data.status = 'REVIEWED'
      data.reviewedAt = new Date()
    }

    if (Object.keys(data).length === 0) return jsonError(400, 'Nothing to update.')

    const updated = await prisma.opportunityAssessment.update({ where: { id: row.id }, data })
    return Response.json(
      { id: updated.id, status: updated.status, decisionType: updated.decisionType, reviewedAt: updated.reviewedAt },
      { headers: privateHeaders },
    )
  } catch (error) {
    if (error instanceof EllonaAccessError) return jsonError(error.status, error.message)
    return jsonError(500, 'Request failed')
  }
}
