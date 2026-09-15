// Lenient parser for the human-readable deadline strings stored on opportunities
// (e.g. "23 September 2026 17:00 (Europe/Dublin)"). Source date formatting is
// preserved verbatim for display; this parser is used ONLY to sort/compare
// deadlines. When a string cannot be parsed we return null and the caller falls
// back to showing the original text without ranking it — we never invent a date.

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

export function parseDisplayDate(s: string | null | undefined): Date | null {
  if (!s || typeof s !== 'string') return null
  const m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const month = MONTHS[m[2].toLowerCase()]
  const year = parseInt(m[3], 10)
  if (month === undefined || Number.isNaN(day) || Number.isNaN(year)) return null
  const hour = m[4] ? parseInt(m[4], 10) : 12
  const minute = m[5] ? parseInt(m[5], 10) : 0
  const d = new Date(Date.UTC(year, month, day, hour, minute))
  return Number.isNaN(d.getTime()) ? null : d
}
