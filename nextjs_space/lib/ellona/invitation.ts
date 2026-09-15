// Secure invitation + password reset for partner (Ellona) accounts.
// - Tokens are cryptographically random; only the SHA-256 hash is stored.
// - Single-use and time-limited (24h); consumed on first use.
// - No password is ever emailed, logged or stored in plaintext.
// - Every invitation / activation / reset / login event is audited without
//   recording any secret.

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const INVITATION_TTL_MS = 24 * 60 * 60 * 1000

export type InvitationPurpose = 'ACTIVATION' | 'RESET'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function recordAuthEvent(
  workspaceId: string,
  email: string,
  kind: string,
  detail = '',
): Promise<void> {
  await prisma.partnerAuthEvent.create({
    data: { id: randomUUID(), workspaceId, email, kind, detail },
  })
}

/**
 * Create a single-use invitation and return the RAW token (caller embeds it in
 * an activation link that is only ever rendered/sent through the email layer).
 * The raw token is never persisted.
 */
export async function createInvitation(
  workspaceId: string,
  email: string,
  purpose: InvitationPurpose,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS)
  await prisma.partnerInvitation.create({
    data: {
      id: randomUUID(),
      workspaceId,
      email: email.toLowerCase(),
      purpose,
      tokenHash: hashToken(token),
      expiresAt,
    },
  })
  await recordAuthEvent(
    workspaceId,
    email,
    purpose === 'ACTIVATION' ? 'INVITE_CREATED' : 'RESET_REQUESTED',
    `expires ${expiresAt.toISOString()}`,
  )
  return { token, expiresAt }
}

export type VerifiedInvitation = {
  id: string
  workspaceId: string
  email: string
  purpose: string
}

/** Verify a raw token without consuming it. Returns null if invalid/expired/used. */
export async function verifyInvitation(token: string): Promise<VerifiedInvitation | null> {
  if (!token || typeof token !== 'string') return null
  const row = await prisma.partnerInvitation.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!row) return null
  if (row.consumedAt) return null
  if (row.expiresAt.getTime() < Date.now()) return null
  return { id: row.id, workspaceId: row.workspaceId, email: row.email, purpose: row.purpose }
}

// Password policy — the application's normal policy plus breached-password check.
export function validatePasswordPolicy(password: string): string | null {
  if (typeof password !== 'string') return 'A password is required.'
  if (password.length < 12) return 'Use at least 12 characters.'
  if (password.length > 200) return 'That password is too long.'
  if (!/[a-z]/.test(password)) return 'Include at least one lower-case letter.'
  if (!/[A-Z]/.test(password)) return 'Include at least one upper-case letter.'
  if (!/[0-9]/.test(password)) return 'Include at least one number.'
  return null
}

/**
 * Breached-password check via the HaveIBeenPwned k-anonymity range API.
 * Only the first 5 chars of the SHA-1 hash leave the server; the full hash
 * never does. Fails OPEN (allows) if the service is unreachable, so a network
 * problem never blocks activation — but a confirmed breach is rejected.
 */
export async function isBreachedPassword(
  password: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)
    const res = await fetchFn(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return false
    const body = await res.text()
    return body
      .split('\n')
      .some((line) => line.split(':')[0]?.trim().toUpperCase() === suffix)
  } catch {
    return false
  }
}

/**
 * Consume an invitation and set the user's password. Atomic: the token is
 * marked consumed and the password hash written in one transaction, so a token
 * can never be used twice.
 */
export async function consumeAndSetPassword(
  token: string,
  password: string,
): Promise<{ ok: true; email: string } | { ok: false; status: number; message: string }> {
  const invitation = await verifyInvitation(token)
  if (!invitation) return { ok: false, status: 400, message: 'This link is invalid or has expired. Ask for a new one.' }

  const policyError = validatePasswordPolicy(password)
  if (policyError) return { ok: false, status: 422, message: policyError }

  if (await isBreachedPassword(password)) {
    return { ok: false, status: 422, message: 'That password has appeared in a known data breach. Choose a different one.' }
  }

  const passwordHash = await bcrypt.hash(password, 12)

  try {
    await prisma.$transaction(async (tx) => {
      // Re-check consumption inside the transaction (single-use guarantee).
      const fresh = await tx.partnerInvitation.findUnique({ where: { id: invitation.id } })
      if (!fresh || fresh.consumedAt || fresh.expiresAt.getTime() < Date.now()) {
        throw new Error('TOKEN_UNAVAILABLE')
      }
      await tx.partnerInvitation.update({ where: { id: invitation.id }, data: { consumedAt: new Date() } })
      await tx.user.update({ where: { email: invitation.email }, data: { password: passwordHash } })
    })
  } catch {
    return { ok: false, status: 409, message: 'This link has already been used. Ask for a new one.' }
  }

  await recordAuthEvent(
    invitation.workspaceId,
    invitation.email,
    invitation.purpose === 'ACTIVATION' ? 'ACTIVATED' : 'PASSWORD_SET',
    '',
  )
  return { ok: true, email: invitation.email }
}
