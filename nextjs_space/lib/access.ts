// Central access-control helper for BioVeracity.
// The commercial contract (public / registered / institutional) is enforced
// here — never duplicate permission logic across components or routes.
//
// accessState values (see prisma User.accessState):
//   REGISTERED    — has an account (free tier: follow, My Picture, quick summary)
//   DEMO          — sales/demo account granted institutional-depth preview
//   INSTITUTIONAL — paid institutional depth (full chronology, evidence pack, arbitrary replay)
//   ADMIN         — internal administrator (everything, plus review queues)

import type { Session } from 'next-auth'

export type AccessState = 'REGISTERED' | 'DEMO' | 'INSTITUTIONAL' | 'ADMIN'

// Monotonic capability rank. DEMO deliberately shares INSTITUTIONAL depth so
// sales demonstrations can show the paid experience without being ADMIN.
const RANK: Record<AccessState, number> = {
  REGISTERED: 1,
  DEMO: 3,
  INSTITUTIONAL: 3,
  ADMIN: 4,
}

/** Resolve the effective access state for a session, honouring the legacy role flag. */
export function getAccessState(session: Session | null | undefined): AccessState | null {
  if (!session?.user) return null
  const role = (session.user as any).role as string | undefined
  if (role === 'admin') return 'ADMIN'
  const raw = (session.user as any).accessState as string | undefined
  if (raw && raw in RANK) return raw as AccessState
  return 'REGISTERED'
}

function rank(session: Session | null | undefined): number {
  const s = getAccessState(session)
  return s ? RANK[s] : 0
}

/** Signed in with any account. */
export function isRegistered(session: Session | null | undefined): boolean {
  return rank(session) >= RANK.REGISTERED
}

/** Institutional depth (INSTITUTIONAL, DEMO or ADMIN). */
export function isInstitutional(session: Session | null | undefined): boolean {
  return rank(session) >= RANK.INSTITUTIONAL
}

/** Internal administrator. */
export function isAdmin(session: Session | null | undefined): boolean {
  return getAccessState(session) === 'ADMIN'
}

/** Thrown by the require* guards. API routes should map this to its `status`. */
export class AccessDeniedError extends Error {
  status: number
  required: AccessState
  constructor(required: AccessState, message?: string) {
    super(message ?? `This action requires ${required} access.`)
    this.name = 'AccessDeniedError'
    this.status = required === 'REGISTERED' ? 401 : 403
    this.required = required
  }
}

export function requireRegistered(session: Session | null | undefined): void {
  if (!isRegistered(session)) throw new AccessDeniedError('REGISTERED', 'You need an account for this.')
}

export function requireInstitutional(session: Session | null | undefined): void {
  if (!isInstitutional(session)) throw new AccessDeniedError('INSTITUTIONAL', 'This requires institutional access.')
}

export function requireAdmin(session: Session | null | undefined): void {
  if (!isAdmin(session)) throw new AccessDeniedError('ADMIN', 'This requires administrator access.')
}
