export const TERMS_VERSION = '2026-09-22.1'
export const PRIVACY_VERSION = '2026-09-22.1'
export const TERMS_LABEL = 'I have read and agree to the Terms and Conditions, including the professional and venue terms where applicable, and acknowledge the Privacy Notice.'

export function validAcceptance(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false
  const v = input as Record<string, unknown>
  return v.acceptTerms === true && v.termsVersion === TERMS_VERSION && v.privacyVersion === PRIVACY_VERSION
}

export const requestKinds = ['ACCESS', 'ERASURE', 'RECTIFICATION', 'RESTRICTION', 'OBJECTION', 'PORTABILITY'] as const
export type RequestKind = typeof requestKinds[number]
export function oneCalendarMonth(date: Date): Date {
  const day = date.getUTCDate()
  const result = new Date(date)
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + 1)
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, last))
  return result
}
