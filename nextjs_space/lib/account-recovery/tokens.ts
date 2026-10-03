import { createHash, randomBytes } from 'node:crypto'

// Password reset tokens. The raw token is returned once to be placed in the
// emailed link; only its SHA-256 hash is ever persisted, so a database leak can
// never be replayed to reset an account. Tokens expire one hour after issue.

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url')
  return { raw, hash: hashToken(raw) }
}
