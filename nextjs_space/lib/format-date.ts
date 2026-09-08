// Honest, hydration-safe date formatting. Uses an explicit locale + UTC timezone
// so server and client render identical strings. `precision` controls how much of
// the date is shown, so an approximate date is never presented as day-exact.
export type DatePrecision = 'day' | 'month' | 'year'

export function formatEventDate(iso: string | Date, precision?: string | null): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  if (precision === 'year') {
    return new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: 'UTC' }).format(d)
  }
  if (precision === 'month') {
    return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(d)
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
}
