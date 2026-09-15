// Provision (idempotently) the Ellona partner tenant:
//  - a private workspace (persona 'ecology'),
//  - a PartnerTenant configuration row,
//  - Natalia's PENDING user account (no password — set via secure activation),
//  - a tenant membership (CONTRIBUTOR) so she can act within her workspace only.
//
// This never grants access to Bazil's private cases or any other workspace.

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { ELLONA } from './config'

export type ProvisionResult = {
  workspaceId: string
  userId: string
  originatorUserId: string | null
  created: boolean
}

export async function provisionEllonaTenant(): Promise<ProvisionResult> {
  // Bazil's existing account is the origin attribution (never grants access).
  const originator = await prisma.user.findUnique({
    where: { email: 'bazil.cromer@ripplexn.com' },
    select: { id: true },
  })

  const existing = await prisma.partnerTenant.findUnique({
    where: { contactEmail: ELLONA.contactEmail },
  })

  if (existing) {
    // Ensure Natalia's account + membership still exist (idempotent repair).
    const user = await ensureCustomerUser(existing.workspaceId)
    return { workspaceId: existing.workspaceId, userId: user.id, originatorUserId: originator?.id ?? null, created: false }
  }

  const workspaceId = randomUUID()

  await prisma.$transaction(async (tx) => {
    await tx.privateWorkspace.create({
      data: { id: workspaceId, name: ELLONA.workspaceName, persona: ELLONA.persona },
    })
    await tx.partnerTenant.create({
      data: {
        workspaceId,
        orgName: ELLONA.orgName,
        workspaceName: ELLONA.workspaceName,
        contactName: ELLONA.contactName,
        contactEmail: ELLONA.contactEmail,
        partnerRole: ELLONA.partnerRole,
        originatorName: ELLONA.originatorName,
        originatorOrg: ELLONA.originatorOrg,
        deliveryProduct: ELLONA.deliveryProduct,
        territories: ELLONA.territories,
        trialDays: ELLONA.trialDays,
        trialState: 'INVITED_NOT_ACTIVATED',
      },
    })
  })

  const user = await ensureCustomerUser(workspaceId)
  return { workspaceId, userId: user.id, originatorUserId: originator?.id ?? null, created: true }
}

async function ensureCustomerUser(workspaceId: string): Promise<{ id: string }> {
  // Create the pending account WITHOUT a password. role = partner_member.
  const user = await prisma.user.upsert({
    where: { email: ELLONA.contactEmail },
    update: { name: ELLONA.contactName, role: ELLONA.partnerRole },
    create: { email: ELLONA.contactEmail, name: ELLONA.contactName, role: ELLONA.partnerRole },
    select: { id: true },
  })

  const membership = await prisma.privateWorkspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!membership) {
    await prisma.privateWorkspaceMember.create({
      data: { workspaceId, userId: user.id, role: 'CONTRIBUTOR' },
    })
  } else if (membership.revokedAt) {
    // Do not silently un-revoke; leave revocation intact.
  }
  return user
}

// Origin record attached to every opportunity's provenance (brief §1).
export function originRecord(workspaceId: string, originatorUserId: string | null) {
  return {
    originator_user_id: originatorUserId,
    originator_display_name: ELLONA.originatorName,
    originator_organisation: ELLONA.originatorOrg,
    delivery_workspace_id: workspaceId,
  }
}
