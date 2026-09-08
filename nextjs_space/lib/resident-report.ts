export const HONEYCOMB_CATEGORIES = ['WATER', 'RIVER', 'ODOUR', 'OPERATIONS', 'AIR', 'SOIL', 'WEATHER', 'NOISE', 'BIODIVERSITY', 'OTHER'] as const
export type HoneycombCategory = typeof HONEYCOMB_CATEGORIES[number]
export function validateResidentReport(input: unknown, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid report')
  const row = input as Record<string, unknown>
  if (Object.keys(row).some(key => !['assetId', 'category', 'description', 'observedAt', 'requestId'].includes(key))) throw new Error('Unsupported report field')
  if (typeof row.assetId !== 'string' || row.assetId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(row.assetId)) throw new Error('Select a mapped place')
  if (!HONEYCOMB_CATEGORIES.includes(row.category as HoneycombCategory)) throw new Error('Choose a topic')
  if (typeof row.description !== 'string' || row.description.trim().length < 10 || row.description.length > 2000) throw new Error('Use 10–2000 characters')
  if (typeof row.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.requestId)) throw new Error('Invalid submission identifier')
  if (typeof row.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(row.observedAt)) throw new Error('Supply an observation time with timezone')
  const calendarDate = row.observedAt.slice(0, 10)
  const parsedDay = new Date(`${calendarDate}T00:00:00Z`)
  if (!Number.isFinite(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== calendarDate) throw new Error('Invalid calendar date')
  const time = Date.parse(row.observedAt)
  if (!Number.isFinite(time) || time > now + 300000 || time < Date.UTC(2000, 0, 1)) throw new Error('Invalid observation time')
  return { assetId: row.assetId, category: row.category as HoneycombCategory, description: row.description.trim(), observedAt: new Date(time), requestId: row.requestId }
}
