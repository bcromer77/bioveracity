// Request helpers for the Ellona API routes. Every route is gated on an active
// membership of the partner tenant (requireEllonaMember) and returns private,
// no-store responses. Errors never leak whether a record exists in another
// tenant — unknown/foreign ids resolve to the same 404 as missing ones.

import { auth } from '@/auth'
import {
  EllonaAccessError,
  findEllonaWorkspace,
  requireEllonaMember,
  resolveEllonaView,
  type EllonaMembership,
} from './access'
import { ellonaEnabled } from './config'

export const privateHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
  'X-Content-Type-Options': 'nosniff',
}

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: privateHeaders })
}

/**
 * Resolve the caller's Ellona membership (their single partner workspace).
 * Throws EllonaAccessError when the feature is off, the user is unauthenticated,
 * or the user is not an active member of any partner tenant.
 */
export async function requireCaller(): Promise<{ userId: string; membership: EllonaMembership }> {
  if (!ellonaEnabled()) throw new EllonaAccessError(404, 'Not found')
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new EllonaAccessError(401, 'Authentication required')
  const membership = await findEllonaWorkspace(userId)
  if (!membership) throw new EllonaAccessError(404, 'Workspace unavailable')
  return { userId, membership }
}

/**
 * Resolve a READ-ONLY caller: a real member (Natalia) OR the originator's
 * read-only preview (Bazil). Use this ONLY for read endpoints (e.g. PDF
 * downloads). Write endpoints must keep using requireCaller so the preview can
 * never mutate the tenant.
 */
export async function requireReader(): Promise<{
  userId: string
  membership: EllonaMembership
  preview: boolean
}> {
  if (!ellonaEnabled()) throw new EllonaAccessError(404, 'Not found')
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new EllonaAccessError(401, 'Authentication required')
  const view = await resolveEllonaView(userId, session?.user?.email)
  if (!view) throw new EllonaAccessError(404, 'Workspace unavailable')
  return {
    userId,
    membership: { userId: view.userId, workspaceId: view.workspaceId, role: view.role },
    preview: view.preview,
  }
}

/** Confirm the caller may act on a specific workspace id (defence in depth). */
export async function requireCallerFor(workspaceId: string): Promise<{ userId: string; membership: EllonaMembership }> {
  const { userId } = await requireCaller()
  const membership = await requireEllonaMember(userId, workspaceId)
  return { userId, membership }
}

export async function ellonaRoute(handler: (caller: { userId: string; membership: EllonaMembership }) => Promise<Response>) {
  try {
    const caller = await requireCaller()
    return await handler(caller)
  } catch (error) {
    if (error instanceof EllonaAccessError) return jsonError(error.status, error.message)
    // Any other error is reported generically — no internal detail leaks.
    return jsonError(500, 'Request failed')
  }
}
