import { createHash } from 'node:crypto'

export type Precision = 'unknown' | 'day' | 'month' | 'year'
export function parseEvidenceDate(value: unknown, precision?: unknown): { value: string | null; precision: Precision } {
  if (value == null || value === '') {
    if (precision && precision !== 'unknown') throw new Error('Missing date for stated precision')
    return { value: null, precision: 'unknown' }
  }
  if (typeof value !== 'string') throw new Error('Dates must be ISO date strings')
  const inferred: Precision = /^\d{4}$/.test(value) ? 'year' : /^\d{4}-\d{2}$/.test(value) ? 'month' : /^\d{4}-\d{2}-\d{2}$/.test(value) ? 'day' : 'unknown'
  if (inferred === 'unknown' || (precision && precision !== inferred)) throw new Error('Date precision mismatch')
  const full = inferred === 'year' ? `${value}-01-01` : inferred === 'month' ? `${value}-01` : value
  const date = new Date(`${full}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== full) throw new Error('Invalid calendar date')
  return { value, precision: inferred }
}

function string(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid ${name}`)
  return value.trim()
}
export function httpsUrl(value: unknown): string {
  const raw = string(value, 'source URL', 2048)
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('HTTPS source URL required')
  url.hash = ''
  return url.toString()
}
export function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function validateEvidence(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Record required')
  const r = input as Record<string, unknown>
  const event = parseEvidenceDate(r.event_date, r.event_date_precision)
  const publication = parseEvidenceDate(r.publication_date)
  const retrievedAt = string(r.retrieved_at, 'retrieval timestamp', 50)
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(retrievedAt) || !Number.isFinite(Date.parse(retrievedAt))) throw new Error('Retrieval timestamp requires timezone')
  if (Date.parse(retrievedAt) > Date.now() + 300000) throw new Error('Future retrieval timestamp')
  if (!['source_text', 'source_excerpt'].includes(String(r.content_kind))) throw new Error('Only source text/excerpts accepted; summaries require a separate claim review')
  if (!Array.isArray(r.sections) || !r.sections.length || r.sections.length > 200) throw new Error('Source sections required')
  const sections = r.sections.map((v: unknown) => {
    if (!v || typeof v !== 'object') throw new Error('Invalid section')
    const s = v as Record<string, unknown>
    return { locator: string(s.locator, 'source locator', 500), text: string(s.text, 'source text', 100000) }
  })
  if (sections.reduce((n, s) => n + s.text.length, 0) > 500000) throw new Error('Record exceeds text limit')
  // Caller-supplied verification/access flags never become authoritative. An
  // incoming sensitivity warning is preserved for audit only; acquisition
  // permission is recorded so unresolved permission falls back to a catalogue
  // reference instead of storing the underlying dataset.
  const incomingSensitivity = incomingLabel(r)
  const acquisitionPermitted = r.acquisition_permitted === true
  const content = {
    url: httpsUrl(r.url), title: string(r.title, 'title', 1000), publisher: string(r.publisher, 'publisher', 300),
    authority_id: string(r.authority_id, 'authority ID', 200), jurisdiction: string(r.jurisdiction, 'jurisdiction', 100),
    representation_id: typeof r.representation_id === 'string' ? string(r.representation_id, 'representation', 500) : 'full',
    content_kind: String(r.content_kind), event_date: event.value, event_date_precision: event.precision,
    publication_date: publication.value, sections,
  }
  return { content, observedAt: new Date(retrievedAt), versionHash: digest(content),
    documentKey: digest([content.url, content.content_kind, content.representation_id]),
    incomingSensitivity, acquisitionPermitted }
}

function incomingLabel(r: Record<string, unknown>): string | null {
  const raw = r.incoming_sensitivity ?? r.access_label ?? r.sensitivity
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed && trimmed.length <= 100 ? trimmed : null
}

export type Sensitivity = 'UNKNOWN' | 'PUBLIC' | 'RESTRICTED'
export type ReusePermission = 'UNKNOWN' | 'PERMITTED' | 'PROHIBITED' | 'CATALOGUE_ONLY'

// Server-side classification at ingest. Ingest can never yield PUBLIC or
// PERMITTED: a VERIFIED claim is not automatically licensed for redistribution
// or external embedding (control #1), and records are never defaulted to public
// (control #2). Content-level sensitivity or an inherited restriction forces
// RESTRICTED/PROHIBITED and cannot be relaxed by a later import (controls #4, #7).
// Unresolved acquisition permission yields CATALOGUE_ONLY (control #5).
export function classifyOnIngest(opts: { contentSensitive: boolean; inheritedRestricted: boolean; catalogueOnly: boolean }): { sensitivity: Sensitivity; reusePermission: ReusePermission } {
  if (opts.contentSensitive || opts.inheritedRestricted) return { sensitivity: 'RESTRICTED', reusePermission: 'PROHIBITED' }
  if (opts.catalogueOnly) return { sensitivity: 'UNKNOWN', reusePermission: 'CATALOGUE_ONLY' }
  return { sensitivity: 'UNKNOWN', reusePermission: 'UNKNOWN' }
}

// Admin classification decision. PUBLIC + PERMITTED (the only searchable/embeddable
// combination) is allowed only when content screening is clean and reuse is
// explicitly permitted. Any sensitive content forces RESTRICTED regardless of the
// requested label.
export function classifyByReviewer(opts: { requestedSensitivity: Sensitivity; requestedReuse: ReusePermission; contentSensitive: boolean }): { sensitivity: Sensitivity; reusePermission: ReusePermission } {
  if (opts.contentSensitive) return { sensitivity: 'RESTRICTED', reusePermission: 'PROHIBITED' }
  const sensitivity: Sensitivity = ['UNKNOWN', 'PUBLIC', 'RESTRICTED'].includes(opts.requestedSensitivity) ? opts.requestedSensitivity : 'UNKNOWN'
  const reuse: ReusePermission = ['UNKNOWN', 'PERMITTED', 'PROHIBITED', 'CATALOGUE_ONLY'].includes(opts.requestedReuse) ? opts.requestedReuse : 'UNKNOWN'
  if (sensitivity === 'RESTRICTED') return { sensitivity, reusePermission: reuse === 'PERMITTED' ? 'PROHIBITED' : reuse }
  return { sensitivity, reusePermission: reuse }
}

export function validateReview(input: unknown, sections: { locator: string; text: string }[]) {
  if (!input || typeof input !== 'object') throw new Error('Review required')
  const r = input as Record<string, unknown>
  if (r.sourceChecked !== true || r.claimSupported !== true || r.publicationPermitted !== true) throw new Error('Confirm source, claim support and publication permission')
  const claim = string(r.claim, 'checked claim', 1500)
  const excerpt = string(r.excerpt, 'supporting excerpt', 1200)
  const locator = string(r.locator, 'supporting locator', 500)
  if (!sections.some(s => s.locator === locator && s.text.includes(excerpt))) throw new Error('Excerpt must exactly match the retained source section')
  const basis = string(r.basis, 'review explanation', 2000)
  if (!['measurement', 'regulator_finding', 'operator_statement', 'community_observation', 'council_record'].includes(String(r.evidenceType))) throw new Error('Evidence type required')
  // Matching text is necessary, not sufficient: a named authenticated reviewer attests support.
  return { claim, excerpt, locator, basis, evidenceType: String(r.evidenceType) }
}
