// One shared, deterministic opportunity filter used by BOTH the Ellona dashboard
// (client, operating on OpportunityDTO) and the portfolio PDF route (server,
// operating on ComposedOpportunity). Keeping a single definition guarantees the
// two surfaces cannot drift: what the partner sees on screen is exactly what the
// generated portfolio contains.
//
// The filter is intentionally pure and side-effect free. It never touches the
// database, never calls a model, and never interprets an unknown filter value as
// arbitrary state — unknown status / deadline values are rejected safely and the
// filter simply behaves as if that dimension were not applied.

// Closed-status set — authoritative for the `status` filter. Preserved exactly
// from the dashboard so the on-screen "Open"/"Closed" toggle and the PDF agree.
export const CLOSED_STATUSES = new Set(['CLOSED', 'NOT RELEVANT', 'SUPERSEDED'])

// Only these two deadline windows and two statuses are ever honoured. Anything
// else is treated as "not filtered on this dimension".
export const DEADLINE_WINDOWS = ['14', '30'] as const
export const STATUS_VALUES = ['open', 'closed'] as const

export type EllonaFilters = {
  q?: string
  country?: string
  classification?: string
  theme?: string
  capability?: string
  status?: string
  deadlineWindow?: string
  followedOnly?: boolean
}

export type NormalizedFilters = {
  q: string
  country: string
  classification: string
  theme: string
  capability: string
  status: '' | 'open' | 'closed'
  deadlineWindow: '' | '14' | '30'
  followedOnly: boolean
}

// The minimal, normalised shape the filter reasons over. Both OpportunityDTO and
// ComposedOpportunity are mapped onto this via a caller-supplied adapter, so the
// filter semantics are identical regardless of the source type.
export type FilterableOpportunity = {
  id: string
  status: string
  classification: string
  buyer: string
  title: string
  country: string
  region: string | null
  themes: string[]
  capabilities: string[]
  measurementNeed: string | null
  nextAction: string | null
  supportedClaim?: string | null
  // Normalised deadline as epoch ms (or null when there is no dated deadline).
  deadlineEpoch: number | null
  // Current authoritative follow-state for this workspace.
  following: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Validate and normalise raw filter input. Unknown `status` / `deadlineWindow`
 * values collapse to '' (not applied) rather than being interpreted as state.
 */
export function normalizeFilters(filters: EllonaFilters): NormalizedFilters {
  const status = filters.status === 'open' || filters.status === 'closed' ? filters.status : ''
  const deadlineWindow = filters.deadlineWindow === '14' || filters.deadlineWindow === '30' ? filters.deadlineWindow : ''
  return {
    q: (filters.q || '').trim(),
    country: (filters.country || '').trim(),
    classification: (filters.classification || '').trim(),
    theme: (filters.theme || '').trim(),
    capability: (filters.capability || '').trim(),
    status,
    deadlineWindow,
    followedOnly: Boolean(filters.followedOnly),
  }
}

/**
 * Deterministic, case-insensitive free-text haystack for one opportunity.
 * Scoped to the DESCRIPTIVE text a user would type into the search box: the
 * title, buyer and scope-of-work text (measurement need, region, next action,
 * supported claim). Structured facets (country, classification, theme,
 * capability) are deliberately EXCLUDED here — each is matched exactly via its
 * own dropdown, never folded into the typed keyword search.
 */
function searchHaystack(o: FilterableOpportunity): string {
  return [
    o.title,
    o.buyer,
    o.measurementNeed,
    o.region,
    o.nextAction,
    o.supportedClaim,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase()
}

/** True when a single opportunity satisfies every active filter dimension. */
export function matchesFilters(o: FilterableOpportunity, filters: EllonaFilters, now: number = Date.now()): boolean {
  const f = normalizeFilters(filters)

  if (f.q) {
    // Tokenised AND search across the descriptive text only (title, buyer, scope
    // of work). Split the query into whitespace-delimited words and require EVERY
    // token to appear somewhere in the haystack, so natural multi-word searches
    // (e.g. "monitoring protection", spread across title and buyer) match without
    // demanding the whole phrase be one contiguous substring. Structured facets
    // (country, classification, theme, capability) are NOT searched here — they
    // are exact dropdown matches below.
    const haystack = searchHaystack(o)
    const tokens = f.q.toLowerCase().split(/\s+/).filter(Boolean)
    if (!tokens.every((token) => haystack.includes(token))) return false
  }
  if (f.country && o.country !== f.country) return false
  if (f.classification && o.classification !== f.classification) return false
  if (f.theme && !(o.themes || []).includes(f.theme)) return false
  if (f.capability && !(o.capabilities || []).includes(f.capability)) return false
  if (f.status === 'open' && CLOSED_STATUSES.has(o.status)) return false
  if (f.status === 'closed' && !CLOSED_STATUSES.has(o.status)) return false
  if (f.followedOnly && !o.following) return false
  if (f.deadlineWindow) {
    if (o.deadlineEpoch == null) return false
    const days = (o.deadlineEpoch - now) / DAY_MS
    if (f.deadlineWindow === '14' && (days < 0 || days > 14)) return false
    if (f.deadlineWindow === '30' && (days < 0 || days > 30)) return false
  }
  return true
}

/**
 * Filter a list of source objects using a caller-supplied adapter that maps each
 * item onto the shared FilterableOpportunity shape. Returns the ORIGINAL objects
 * that pass, preserving their order.
 */
export function filterOpportunities<T>(
  items: T[],
  toFilterable: (item: T) => FilterableOpportunity,
  filters: EllonaFilters,
  now: number = Date.now(),
): T[] {
  return items.filter((item) => matchesFilters(toFilterable(item), filters, now))
}

/**
 * Human-readable scope label describing the active filters, for the PDF heading
 * and the snapshot metadata. Examples:
 *   "Filtered to: Ireland \u00b7 Odour \u00b7 Open opportunities"
 *   "Search: wastewater \u00b7 Next 30 days"
 *   "All routed opportunities"  (when nothing is filtered)
 */
export function buildScopeLabel(filters: EllonaFilters): string {
  const f = normalizeFilters(filters)
  const parts: string[] = []
  if (f.country) parts.push(f.country)
  if (f.classification) parts.push(f.classification)
  if (f.theme) parts.push(f.theme)
  if (f.capability) parts.push(f.capability)
  if (f.status === 'open') parts.push('Open opportunities')
  else if (f.status === 'closed') parts.push('Closed opportunities')
  if (f.deadlineWindow === '14') parts.push('Next 14 days')
  else if (f.deadlineWindow === '30') parts.push('Next 30 days')
  if (f.followedOnly) parts.push('Followed only')

  if (f.q) return ['Search: ' + f.q, ...parts].join(' \u00b7 ')
  if (parts.length === 0) return 'All routed opportunities'
  return 'Filtered to: ' + parts.join(' \u00b7 ')
}

/** Build the portfolio PDF URL query string from the active filters. */
export function buildPortfolioPdfQuery(filters: EllonaFilters, basePath = '/api/ellona/portfolio/pdf'): string {
  const f = normalizeFilters(filters)
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.country) p.set('country', f.country)
  if (f.classification) p.set('classification', f.classification)
  if (f.theme) p.set('theme', f.theme)
  if (f.capability) p.set('capability', f.capability)
  if (f.status) p.set('status', f.status)
  if (f.deadlineWindow) p.set('deadlineWindow', f.deadlineWindow)
  if (f.followedOnly) p.set('followedOnly', 'true')
  const qs = p.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

/** Parse and validate filters from a URL's search params (server side). */
export function parseFiltersFromParams(params: URLSearchParams): NormalizedFilters {
  return normalizeFilters({
    q: params.get('q') || '',
    country: params.get('country') || '',
    classification: params.get('classification') || '',
    theme: params.get('theme') || '',
    capability: params.get('capability') || '',
    status: params.get('status') || '',
    deadlineWindow: params.get('deadlineWindow') || '',
    followedOnly: params.get('followedOnly') === 'true' || params.get('followedOnly') === '1',
  })
}
