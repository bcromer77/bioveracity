// Operator-only access decision for the Developer Platform observability view.
// Mirrors the existing admin guard used by /admin/ingest: no session → login,
// any role other than 'admin' → forbidden.

export type OperatorAccess = 'allowed' | 'unauthenticated' | 'forbidden'

export function operatorAccess(session: unknown): OperatorAccess {
  const user = (session as { user?: { role?: unknown } } | null | undefined)?.user
  if (!user) return 'unauthenticated'
  return user.role === 'admin' ? 'allowed' : 'forbidden'
}
