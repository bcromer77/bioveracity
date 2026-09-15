// Server-side tenant access guard for the Ellona workspace.
// Access is enforced exclusively through PrivateWorkspaceMember rows with
// revokedAt IS NULL — mirroring the existing private-workspace model — so that
// revoking a member immediately blocks the dashboard, APIs and PDF downloads.

import { prisma } from '@/lib/prisma'
import { ellonaEnabled } from './config'

export class EllonaAccessError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'EllonaAccessError'
    this.status = status
  }
}

export type EllonaMembership = {
  userId: string
  workspaceId: string
  role: string
}

/**
 * Resolve the single Ellona (partner) workspace this user may access, if any.
 * Returns null when the user is not an active member of a partner tenant.
 */
export async function findEllonaWorkspace(userId: string): Promise<EllonaMembership | null> {
  if (!userId) return null
  // A partner tenant is any PrivateWorkspace that has a PartnerTenant row.
  const tenants = await prisma.partnerTenant.findMany({ select: { workspaceId: true } })
  if (tenants.length === 0) return null
  const ids = tenants.map((t) => t.workspaceId)
  const membership = await prisma.privateWorkspaceMember.findFirst({
    where: { userId, revokedAt: null, workspaceId: { in: ids } },
    select: { workspaceId: true, role: true },
  })
  if (!membership) return null
  return { userId, workspaceId: membership.workspaceId, role: membership.role }
}

/**
 * Assert that the user is an active member of the given partner workspace.
 * Throws EllonaAccessError (404 to avoid leaking existence) otherwise.
 */
export async function requireEllonaMember(
  userId: string | undefined | null,
  workspaceId: string,
): Promise<EllonaMembership> {
  if (!ellonaEnabled()) throw new EllonaAccessError(404, 'Not found')
  if (!userId) throw new EllonaAccessError(401, 'Authentication required')
  const membership = await prisma.privateWorkspaceMember.findFirst({
    where: { userId, workspaceId, revokedAt: null },
    select: { workspaceId: true, role: true },
  })
  // Only recognise membership of an actual partner tenant.
  const tenant = membership
    ? await prisma.partnerTenant.findUnique({ where: { workspaceId }, select: { workspaceId: true } })
    : null
  if (!membership || !tenant) throw new EllonaAccessError(404, 'Workspace unavailable')
  return { userId, workspaceId, role: membership.role }
}

// Trial write-lock: after expiry the workspace becomes read-only.
export function trialAllowsWrites(trialState: string): boolean {
  return trialState === 'ACTIVE' || trialState === 'CONVERTED'
}
