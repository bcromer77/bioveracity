// Structural publication gate, not a claim-verification algorithm. A reviewer
// must inspect the passage; URL presence or a trusted hostname is insufficient.
export interface PortProvenance {
  sourceUrl?: string | null
  sourcePublisher?: string | null
  sourceRetrievedAt?: Date | string | null
  sourceLocation?: string | null
}

export function hasPortProvenance(record: PortProvenance): boolean {
  try {
    const url = new URL(record.sourceUrl || '')
    if (url.protocol !== 'https:' || url.username || url.password) return false
    // A home page cannot anchor a particular project milestone.
    if (url.pathname === '/' && !url.search) return false
    if (!record.sourcePublisher?.trim() || !record.sourceLocation?.trim()) return false
    if (!record.sourceRetrievedAt) return false
    return Number.isFinite(new Date(record.sourceRetrievedAt).getTime())
  } catch { return false }
}

export function portDatePrecision(record: { datePrecision?: string | null }): string {
  return ['day', 'month', 'year'].includes(record.datePrecision || '')
    ? record.datePrecision! : 'unknown'
}

export function portReplayWindow<T extends { date: string }>(records: T[], institutional: boolean, months = 24): T[] {
  const dated = records.filter(record => Number.isFinite(Date.parse(record.date)))
  if (institutional || !dated.length) return dated
  const cutoff = new Date(Math.max(...dated.map(record => Date.parse(record.date))))
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)
  return dated.filter(record => Date.parse(record.date) >= cutoff.getTime())
}
