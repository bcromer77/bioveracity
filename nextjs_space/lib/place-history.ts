/** Presentation over records already authorised by the server. Never an access gate. */
export interface HistoryRecord {
  id: string
  assetSlug: string
  date: string
  datePrecision?: string | null
}

const DAY = 86400000
export function exactHistoryDay(record: HistoryRecord): number | null {
  if (record.datePrecision !== 'day') return null
  const value = record.date.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null
}

export function historyDateLabel(record: HistoryRecord): string {
  const day = exactHistoryDay(record)
  if (day !== null) return new Date(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  if (record.datePrecision === 'year' && /^\d{4}(?:-|$)/.test(record.date)) return record.date.slice(0, 4)
  if (record.datePrecision === 'month' && /^\d{4}-(0[1-9]|1[0-2])(?:-|$)/.test(record.date)) return record.date.slice(0, 7)
  return 'Date not established'
}

export function groupPlaceHistory<T extends HistoryRecord>(records: T[], slug: string, anchorId: string, days: number) {
  const scoped = records.filter(record => record.assetSlug === slug)
  const anchor = scoped.find(record => record.id === anchorId)
  const anchorDay = anchor ? exactHistoryDay(anchor) : null
  const result = { before: [] as T[], during: [] as T[], after: [] as T[], uncertain: [] as T[], outside: 0, anchorValid: anchorDay !== null }
  if (anchorDay === null || ![1, 7, 30, 90].includes(days)) return { ...result, anchorValid: false }
  for (const record of scoped) {
    const day = exactHistoryDay(record)
    if (day === null) { result.uncertain.push(record); continue }
    const delta = (day - anchorDay) / DAY
    if (Math.abs(delta) > days) { result.outside++; continue }
    result[delta < 0 ? 'before' : delta > 0 ? 'after' : 'during'].push(record)
  }
  for (const group of [result.before, result.during, result.after]) group.sort((a, b) => exactHistoryDay(a)! - exactHistoryDay(b)!)
  return result
}

export function historySourceUrl(value: string | null): string | null {
  if (!value) return null
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null } catch { return null }
}
