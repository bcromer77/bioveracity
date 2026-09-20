// Server-side password policy for account recovery and signup. This is the
// single source of truth: never trust client-side validation. A password must
// be 10-200 characters and contain at least one letter and one digit.

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 200

export type PasswordCheck = { ok: true } | { ok: false; error: string }

export function validatePassword(value: unknown): PasswordCheck {
  if (typeof value !== 'string') {
    return { ok: false, error: 'Password is required' }
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` }
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters` }
  }
  if (!/[A-Za-z]/.test(value)) {
    return { ok: false, error: 'Password must include at least one letter' }
  }
  if (!/[0-9]/.test(value)) {
    return { ok: false, error: 'Password must include at least one number' }
  }
  return { ok: true }
}
