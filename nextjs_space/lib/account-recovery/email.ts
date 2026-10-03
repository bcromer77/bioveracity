// Email normalisation for account recovery. Kept independent of the workspaces
// layer so the recovery flow can be unit-tested in isolation. Returns a
// canonical lower-cased address, or null when the input is not a valid email.
// Callers decide how to respond (a malformed request is a 400; a well-formed
// address for an unknown account must still return the generic success response
// so account existence is never revealed).

const EMAIL_MAX_LENGTH = 320
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) return null
  return email
}
