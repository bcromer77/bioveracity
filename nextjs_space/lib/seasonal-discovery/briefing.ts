import { createHash } from 'node:crypto'

// Internal input only: an approved source adapter must construct these records.
// Never accept reviewed/public/scope values from a browser, email or model output.
export type SeasonalSignal = {
  id: string; revision: string; title: string; guidance: string
  topic: 'flowers' | 'animals' | 'sounds' | 'scents'
  basis: 'seasonal_guidance' | 'reported_observation'
  scope: { kind: 'place' | 'county'; id: string; label: string }
  validFrom: string; validUntil: string; observedOn: string | null
  review: 'approved' | 'pending' | 'withdrawn'
  visibility: 'public' | 'private' | 'sensitive'
  source: { recordId: string; url: string; publisher: string; locator: string; reuseAllowed: boolean }
}
export type VenueContext = { id: string; ownerId: string; county: string; name: string }
export type SeasonalCard = {
  key: string; title: string; guidance: string; topic: SeasonalSignal['topic']
  label: string; scopeLabel: string; observedOn: string | null
  source: SeasonalSignal['source']
}
export type SeasonalBrief = {
  hubId: string; asOf: string; cards: SeasonalCard[]
  coverage: 'partial' | 'unavailable'; notice: string
}
function day(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
}
function sourceAllowed(s: SeasonalSignal['source']): boolean {
  if (!s.reuseAllowed || !s.recordId.trim() || !s.publisher.trim() || !s.locator.trim()) return false
  try { const u = new URL(s.url); return u.protocol === 'https:' && !u.username && !u.password }
  catch { return false }
}
export function buildSeasonalBrief(venue: VenueContext, signals: SeasonalSignal[], now = new Date()): SeasonalBrief {
  // The Europe/Dublin calendar is shared by the existing venue plan. No inferred event dates.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const cards: SeasonalCard[] = []
  const seen = new Set<string>()
  // Conflicting versions are withheld until an adapter resolves the current revision.
  const counts = new Map<string, Set<string>>()
  for (const s of signals) counts.set(s.id, new Set([...(counts.get(s.id) || []), s.revision]))
  const blocked = new Set(signals.filter(s => s.review !== 'approved' || s.visibility !== 'public').map(s => s.id))
  for (const s of signals) {
    if (blocked.has(s.id) || counts.get(s.id)?.size !== 1 || !s.id.trim() || !s.revision.trim()) continue
    if (!['flowers', 'animals', 'sounds', 'scents'].includes(s.topic) || !['seasonal_guidance', 'reported_observation'].includes(s.basis)) continue
    if (!sourceAllowed(s.source) || !s.title.trim() || !s.guidance.trim()) continue
    if (!day(s.validFrom) || !day(s.validUntil) || s.validFrom > s.validUntil || today < s.validFrom || today > s.validUntil) continue
    if (s.scope.kind === 'place' ? s.scope.id !== venue.id : s.scope.kind !== 'county' || s.scope.id !== venue.county) continue
    if (s.basis === 'reported_observation' && (!s.observedOn || !day(s.observedOn) || s.observedOn > today)) continue
    const key = createHash('sha256').update(JSON.stringify([venue.id, s.source.recordId, s.revision, s.validFrom, s.validUntil])).digest('hex')
    if (seen.has(key)) continue
    seen.add(key)
    cards.push({ key, title: s.title, guidance: s.guidance, topic: s.topic,
      label: s.basis === 'seasonal_guidance' ? 'Worth looking for this season' : 'Reported observation',
      scopeLabel: s.scope.kind === 'county' ? `${s.scope.label} area; not a sighting at this venue` : s.scope.label,
      observedOn: s.basis === 'reported_observation' ? s.observedOn : null, source: { ...s.source } })
  }
  cards.sort((a, b) => a.topic.localeCompare(b.topic) || a.key.localeCompare(b.key))
  return { hubId: venue.id, asOf: today, cards: cards.slice(0, 6), coverage: 'partial',
    notice: cards.length ? 'A selection from reviewed sources. Timing varies; a suggestion is not a confirmed sighting.' : 'No current, reviewed seasonal guidance was found in the sources checked. This does not mean wildlife is absent.' }
}

export async function ownerSeasonalBrief(
  actorId: string, hubId: string,
  ownedVenue: (actorId: string, hubId: string) => Promise<VenueContext>,
  readSignals: (venue: VenueContext) => Promise<SeasonalSignal[]>, now = new Date(),
): Promise<SeasonalBrief> {
  if (!actorId) throw new Error('Please sign in.')
  // Authorise before source access. The adapter must query ownerId and hubId together.
  const venue = await ownedVenue(actorId, hubId)
  if (venue.ownerId !== actorId || venue.id !== hubId) throw new Error('Venue not found.')
  let signals: SeasonalSignal[]
  try { signals = await readSignals(venue) }
  catch { return { hubId, asOf: now.toISOString(), cards: [], coverage: 'unavailable', notice: 'Seasonal sources could not be checked. No previous success has been substituted.' } }
  return buildSeasonalBrief(venue, signals, now)
}

// Delivery planning only. The sender must recheck ownership/opt-in and atomically
// claim these keys in a durable outbox. Calling this function never sends an email.
export function planSeasonalDigest(brief: SeasonalBrief, optedIn: boolean, deliveredKeys: ReadonlySet<string>) {
  if (!optedIn || brief.coverage === 'unavailable') return []
  return brief.cards.filter(card => !deliveredKeys.has(card.key))
}
