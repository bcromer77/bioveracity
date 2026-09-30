export const METHOD = 'LISTEN_5_MIN_V1'
export const COUNTIES = ['Antrim','Armagh','Carlow','Cavan','Clare','Cork','Derry','Donegal','Down','Dublin','Fermanagh','Galway','Kerry','Kildare','Kilkenny','Laois','Leitrim','Limerick','Longford','Louth','Mayo','Meath','Monaghan','Offaly','Roscommon','Sligo','Tipperary','Tyrone','Waterford','Westmeath','Wexford','Wicklow']
export class ListenError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ListenError(400, 'Invalid submission')
  return value
}
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) throw new ListenError(400, 'Please check your text fields')
  return value.trim()
}
export function key(value) {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/i.test(value)) throw new ListenError(400, 'Invalid submission identifier')
  return value
}
export function plotInput(value) {
  const input = object(value)
  if (!COUNTIES.includes(input.county)) throw new ListenError(400, 'Choose a county')
  return { id: key(input.id), name: text(input.name, 80), county: input.county }
}
export function visitInput(value, now = new Date()) {
  const input = object(value)
  const id = key(input.id), plotId = key(input.plotId)
  // Date/time includes an explicit offset; source time and receipt time stay distinct.
  if (typeof input.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(input.observedAt)) throw new ListenError(400, 'Choose the time of your visit')
  const observedAt = new Date(input.observedAt)
  if (!Number.isFinite(observedAt.getTime()) || observedAt > now || now - observedAt > 31 * 86400000) throw new ListenError(400, 'Visits must be within the past 31 days')
  // Reject impossible calendar dates instead of letting Date normalise them.
  const date = input.observedAt.slice(0,10)
  if (new Date(date + 'T00:00:00Z').toISOString().slice(0,10) !== date) throw new ListenError(400, 'Invalid calendar date')
  if (input.completed !== true) throw new ListenError(400, 'Complete the five-minute visit first')
  if (!['calm','breezy','windy'].includes(input.wind) || !['dry','rain'].includes(input.weather)) throw new ListenError(400, 'Choose the conditions')
  if (!['heard','not_heard','unsure'].includes(input.birds)) throw new ListenError(400, 'Choose what you heard')
  if (input.adult !== true) throw new ListenError(400, 'This pilot is for adult participants')
  const note = input.note ? text(input.note, 500) : ''
  return { id, plotId, observedAt: observedAt.toISOString(), sourceTime: input.observedAt, method: METHOD, durationSeconds: 300, wind: input.wind, weather: input.weather, birds: input.birds, note }
}
export function coverage(visits) {
  // Describes participation only. No trend is estimated from opportunistic visits.
  const dates = new Set(visits.map(v => v.observedAt.slice(0,10)))
  return { visits: visits.length, dates: dates.size, statement: visits.length ? 'Your place has a listening history. These visits do not yet establish an ecological trend.' : 'Your first visit begins this place’s memory.' }
}
