// Record a reviewer action on an opportunity (relevant / not relevant / follow /
// unfollow / investigation request / decision) and reflect it in the record
// status. Tenant-scoped: a foreign opportunity id resolves to 404.

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { EllonaAccessError } from '@/lib/ellona/access'
import { requireCaller, jsonError, privateHeaders } from '@/lib/ellona/http'
import { trialAllowsWrites } from '@/lib/ellona/access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ACTION_KINDS = ['RELEVANT', 'NOT_RELEVANT', 'FOLLOW', 'UNFOLLOW', 'INVESTIGATION_REQUEST', 'DECISION'] as const

// How an action maps onto the visible record status (brief §6). INVESTIGATION_REQUEST
// does not itself change status.
const STATUS_FOR: Record<string, string | null> = {
  RELEVANT: 'UNDER REVIEW',
  NOT_RELEVANT: 'NOT RELEVANT',
  FOLLOW: 'FOLLOWING',
  UNFOLLOW: 'UNDER REVIEW',
  DECISION: 'QUALIFIED',
  INVESTIGATION_REQUEST: null,
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { userId, membership } = await requireCaller()
    const workspaceId = membership.workspaceId

    const tenant = await prisma.partnerTenant.findUnique({ where: { workspaceId } })
    if (!tenant) return jsonError(404, 'Workspace unavailable')
    if (!trialAllowsWrites(tenant.trialState, tenant.trialEndsAt)) {
      return jsonError(403, 'Your trial is read-only. Actions cannot be recorded until the trial is converted.')
    }

    const opp = await prisma.opportunity.findFirst({ where: { id, workspaceId } })
    if (!opp) return jsonError(404, 'Opportunity not found')

    let body: any = null
    try {
      body = await request.json()
    } catch {
      return jsonError(400, 'Expected a JSON body.')
    }
    const kind = typeof body?.kind === 'string' ? body.kind.toUpperCase() : ''
    if (!(ACTION_KINDS as readonly string[]).includes(kind)) {
      return jsonError(400, 'Unknown action.')
    }
    const detail = typeof body?.detail === 'string' ? body.detail.slice(0, 2000) : ''

    await prisma.opportunityAction.create({
      data: { id: randomUUID(), workspaceId, opportunityId: opp.id, userId, kind, detail },
    })

    const newStatus = STATUS_FOR[kind]
    if (newStatus && newStatus !== opp.status) {
      await prisma.opportunity.update({ where: { id: opp.id }, data: { status: newStatus } })
      await prisma.opportunityEvent.create({
        data: {
          id: randomUUID(),
          opportunityId: opp.id,
          kind: 'STATUS_CHANGE',
          summary: `Status set to ${newStatus} by reviewer action ${kind}.`,
          changedFields: { status: newStatus },
          previousValues: { status: opp.status },
          emailedBefore: false,
        },
      })
    }

    return Response.json(
      { ok: true, kind, status: newStatus || opp.status },
      { headers: privateHeaders },
    )
  } catch (error) {
    if (error instanceof EllonaAccessError) return jsonError(error.status, error.message)
    return jsonError(500, 'Request failed')
  }
}
