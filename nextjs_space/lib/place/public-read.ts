// Public-safe Place read model (Place Experience PR C). Server-only and
// Place-neutral: no individual Place, county, designation or source may be named
// here (tests/place-generic-literals.test.ts).
//
// Boundary rules:
// - Every row that can reach a DTO, a count, a facet, a search ranking or an
//   answer context first passes PUBLIC_ITEM_GATE inside the same SQL statement.
//   Lexical filtering is an extra AND on the already-gated predicate; semantic
//   re-ranking and answer contexts only ever see rows the gate returned.
// - Deny by default: an item is public only when every publication and rights
//   signal is explicitly positive. Absent/unknown/ambiguous state is excluded.
// - Output is an allowlisted DTO. Internal Place/Asset, memory, raw, evidence,
//   request, workspace, entity and key identifiers are never returned; items are
//   addressed by a one-way public handle.
// - Missing, private, unpublished, unauthorised, cross-Place and malformed
//   lookups all return the same `null` / empty result.
// - No geometry or coordinates are returned. Spatial detail is reduced only on
//   explicit disclosure metadata; anything else omits it entirely.

import type { Sql } from '@/lib/workspaces/service'
import type { AuthorisedSemanticReranker, PlaceMemoryEvidenceClass } from '@/lib/place-memory/types'
import { EVIDENCE_CLASSES } from '@/lib/place-memory/types'
import { isPlaceId } from './identity'

export const PUBLIC_ITEM_HANDLE_RE = /^pmi_[a-f0-9]{24}$/
const HANDLE_SQL = `'pmi_' || substr(encode(sha256(convert_to('bv-public-item-v1:' || m.id, 'UTF8')), 'hex'), 1, 24)`

/** Publication/rights gate. `$1` is always the server-resolved Place ID. */
export const PUBLIC_ITEM_GATE = `
  m."placeId" = $1
  AND m.status = 'ACTIVE'
  AND m.visibility = 'PUBLIC'
  AND m."rightsState" = 'CLEARED_FOR_INGEST'
  AND m."workspaceId" IS NULL
  AND p.mode = 'live'
  AND p."processingStatus" = 'PROCESSED'
  AND jsonb_typeof(p.provenance) = 'object'
  AND p.provenance->>'rights_class' = 'CLEARED_FOR_INGEST'
  AND length(btrim(COALESCE(p.provenance->>'licence', ''))) > 0
  AND EXISTS (SELECT 1 FROM "PlaceMemorySourceLink" sl
              WHERE sl."itemId" = m.id AND sl."platformEvidenceId" = p.id AND sl.relationship = 'PRIMARY')
  AND EXISTS (SELECT 1 FROM "Asset" a
              WHERE a.id = m."placeId" AND a.type = 'living_place' AND a.status = 'active')`

const GATED_FROM = `FROM "PlaceMemoryItem" m JOIN "PlatformEvidence" p ON p.id = m."platformEvidenceId"`

// Only these explicit, boolean uncertainty flags may be published.
const PUBLIC_UNCERTAINTY_FLAGS = [
  'designation_not_observation',
  'current_presence_not_established',
  'abundance_not_established',
  'condition_not_established',
  'observation_time_unknown',
  'publication_time_unknown',
  'qualifying_interest_not_current_observation',
] as const

const PUBLIC_TERM_STATUSES = ['SOURCE', 'CURATED', 'VERIFIED']
const DESIGNATION_RELATION = 'QUALIFYING_INTEREST'

export const DESIGNATION_FEATURE_NOTE =
  'A designation feature (such as a qualifying interest) records why a site is protected. It is not evidence that the feature is present or observable now, nor of its abundance, population trend or condition.'
export const CURRENT_PRESENCE_WARNING =
  'This question asks about current presence, abundance, trend or condition. The public record here cannot establish that; designation features are returned as protection context only.'

export type PublicRelationship = {
  label: string
  kind: string
  authority: string | null
  sourceIdentifier: string | null
  relationType: string
  assertionState: string
  framing: 'designation_feature' | 'subject'
  otherNames: string[]
}

export type PublicInterpretation = {
  currentPresenceSupported: false
  abundanceSupported: false
  trendSupported: false
  conditionSupported: false
  note: string | null
}

export type PublicMemoryItem = {
  handle: string
  kind: string
  evidenceClass: PlaceMemoryEvidenceClass
  statement: string
  time: { start: string | null; end: string | null; precision: string; basis: string; unknown: boolean }
  location: { disclosure: 'NAMED_ONLY' | 'GENERALISED'; precision: string | null } | null
  uncertainty: string[]
  source: {
    publisher: string | null
    sourceIdentifier: string | null
    url: string | null
    licence: string
    attribution: string | null
    retrievedAt: string | null
    publishedAt: string | null
    observedAt: string | null
    observationPrecision: string | null
  }
  relationships: PublicRelationship[]
  interpretation: PublicInterpretation
}

export type PublicPlace = { name: string; slug: string | null; publicItemCount: number }

export type PublicSearchQuery = { q?: string; evidenceClasses?: string[]; limit?: number }
export type PublicSearchResult = {
  results: PublicMemoryItem[]
  resultCount: number
  facets: { evidenceClass: Record<string, number> }
  warning: string | null
}

export type PublicAnswerContext = {
  placeName: string
  question: string
  currentPresenceQuestion: boolean
  passages: Array<{ handle: string; text: string }>
  cautions: string[]
}

export class PublicReadInputError extends Error {
  constructor() { super('invalid_public_query') }
}

type ItemRow = {
  internalId: string
  handle: string
  kind: string
  evidenceClass: string
  originalStatement: string
  eventStart: Date | string | null
  eventEnd: Date | string | null
  timePrecision: string
  timeBasis: string
  geographyPrecision: string | null
  locationDisclosure: string
  uncertainty: unknown
  hasEvent: boolean
  eventSensitive: boolean | null
  eventDisclosure: string | null
  publisher: string | null
  sourceExternalId: string | null
  sourceUrl: string | null
  retrievalTime: Date | string | null
  publicationTime: Date | string | null
  observationTime: Date | string | null
  observationPrecision: string | null
  licence: string
  attribution: string | null
  content: string | null
}

type RelationRow = {
  internalId: string
  entityKey: string
  kind: string
  canonicalLabel: string
  authority: string | null
  externalId: string | null
  relationType: string
  assertionState: string
  term: string | null
}

const iso = (value: Date | string | null): string | null => (value == null ? null : new Date(value).toISOString())
const EMPTY_SEARCH: PublicSearchResult = Object.freeze({
  results: [], resultCount: 0, facets: { evidenceClass: {} }, warning: null,
}) as PublicSearchResult

function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try { return objectValue(JSON.parse(value)) } catch { return {} }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function publicUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function location(row: ItemRow): PublicMemoryItem['location'] {
  const allowed = (value: string | null) => value === 'NAMED_ONLY' || value === 'GENERALISED'
  if (!allowed(row.locationDisclosure)) return null // EXACT has no public surface yet; HIDDEN is hidden.
  if (row.hasEvent && (row.eventSensitive !== false || !allowed(row.eventDisclosure))) return null
  return { disclosure: row.locationDisclosure as 'NAMED_ONLY' | 'GENERALISED', precision: row.geographyPrecision }
}

function relationships(rows: RelationRow[]): PublicRelationship[] {
  const byKey = new Map<string, PublicRelationship>()
  for (const row of rows) {
    const key = `${row.entityKey}\u0000${row.relationType}\u0000${row.assertionState}`
    let rel = byKey.get(key)
    if (!rel) {
      rel = {
        label: row.canonicalLabel,
        kind: row.kind,
        authority: row.authority,
        sourceIdentifier: row.externalId,
        relationType: row.relationType,
        assertionState: row.assertionState,
        framing: row.relationType === DESIGNATION_RELATION ? 'designation_feature' : 'subject',
        otherNames: [],
      }
      byKey.set(key, rel)
    }
    if (row.term && row.term !== row.canonicalLabel && !rel.otherNames.includes(row.term)) rel.otherNames.push(row.term)
  }
  return [...byKey.values()]
}

function toItem(row: ItemRow, rels: RelationRow[]): PublicMemoryItem {
  const flags = objectValue(row.uncertainty)
  const relationshipList = relationships(rels)
  const designation = row.kind === 'DESIGNATION' || relationshipList.some((r) => r.framing === 'designation_feature')
  return {
    handle: row.handle,
    kind: row.kind,
    evidenceClass: row.evidenceClass as PlaceMemoryEvidenceClass,
    statement: row.originalStatement,
    time: {
      start: iso(row.eventStart),
      end: iso(row.eventEnd),
      precision: row.timePrecision,
      basis: row.timeBasis,
      unknown: row.eventStart == null && row.eventEnd == null,
    },
    location: location(row),
    uncertainty: PUBLIC_UNCERTAINTY_FLAGS.filter((flag) => flags[flag] === true),
    source: {
      publisher: row.publisher,
      sourceIdentifier: row.sourceExternalId,
      url: publicUrl(row.sourceUrl),
      licence: row.licence.trim(),
      attribution: row.attribution && row.attribution.trim() ? row.attribution.trim() : null,
      retrievedAt: iso(row.retrievalTime),
      publishedAt: iso(row.publicationTime),
      observedAt: iso(row.observationTime),
      observationPrecision: row.observationPrecision,
    },
    relationships: relationshipList,
    interpretation: {
      currentPresenceSupported: false,
      abundanceSupported: false,
      trendSupported: false,
      conditionSupported: false,
      note: designation ? DESIGNATION_FEATURE_NOTE : null,
    },
  }
}

async function gatedItems(
  db: Sql,
  placeId: string,
  extra: { handle?: string; q?: string; evidenceClasses?: string[]; limit: number },
): Promise<ItemRow[]> {
  const values: unknown[] = [placeId]
  const where = [PUBLIC_ITEM_GATE]
  if (extra.handle) {
    values.push(extra.handle)
    where.push(`${HANDLE_SQL} = $${values.length}`)
  }
  if (extra.evidenceClasses?.length) {
    const refs = extra.evidenceClasses.map((value) => { values.push(value); return `$${values.length}` })
    where.push(`m."evidenceClass" IN (${refs.join(',')})`)
  }
  if (extra.q) {
    values.push(extra.q)
    const q = `$${values.length}`
    where.push(`(to_tsvector('english', sd.content) @@ websearch_to_tsquery('english', ${q})
      OR to_tsvector('simple', sd.content) @@ websearch_to_tsquery('simple', ${q}))`)
  }
  values.push(extra.limit)
  return db.query<ItemRow>(
    `SELECT m.id AS "internalId", ${HANDLE_SQL} AS handle, m.kind, m."evidenceClass", m."originalStatement",
       m."eventStart", m."eventEnd", m."timePrecision", m."timeBasis", m."geographyPrecision",
       m."locationDisclosure", m.uncertainty, (m."observationEventId" IS NOT NULL) AS "hasEvent",
       oe."sensitiveLocation" AS "eventSensitive", oe."locationDisclosure" AS "eventDisclosure",
       p.publisher, p."sourceExternalId", p."sourceUrl", p."retrievalTime", p."publicationTime",
       p."observationTime", p."observationPrecision",
       p.provenance->>'licence' AS licence, p.provenance->>'attribution' AS attribution, sd.content
     ${GATED_FROM}
     LEFT JOIN "PlaceMemorySearchDocument" sd ON sd."itemId" = m.id
     LEFT JOIN "ObservationEventRecord" oe ON oe.id = m."observationEventId"
     WHERE ${where.join(' AND ')}
     ORDER BY m."createdAt", m.id
     LIMIT $${values.length}`,
    values,
  )
}

async function relationRows(db: Sql, placeId: string, items: ItemRow[]): Promise<Map<string, RelationRow[]>> {
  const map = new Map<string, RelationRow[]>()
  if (!items.length) return map
  const values: unknown[] = [placeId]
  const refs = items.map((item) => { values.push(item.internalId); return `$${values.length}` })
  values.push(PUBLIC_TERM_STATUSES)
  // The gate is re-applied so this query can never widen what the item query saw.
  const rows = await db.query<RelationRow>(
    `SELECT m.id AS "internalId", e.id AS "entityKey", e.kind, e."canonicalLabel", e.authority, e."externalId",
       ie."relationType", ie."assertionState", t.term
     ${GATED_FROM}
     JOIN "PlaceMemoryItemEntity" ie ON ie."itemId" = m.id
     JOIN "PlaceMemoryEntity" e ON e.id = ie."entityId"
     LEFT JOIN "PlaceMemoryTerm" t ON t."entityId" = e.id AND t.status = ANY($${values.length}::text[])
     WHERE ${PUBLIC_ITEM_GATE} AND m.id IN (${refs.join(',')})
     ORDER BY m.id, e."externalId" NULLS LAST, e.id, t.term`,
    values,
  )
  for (const row of rows) map.set(row.internalId, [...(map.get(row.internalId) ?? []), row])
  return map
}

async function hydrate(db: Sql, placeId: string, rows: ItemRow[]): Promise<PublicMemoryItem[]> {
  const rels = await relationRows(db, placeId, rows)
  return rows.map((row) => toItem(row, rels.get(row.internalId) ?? []))
}

/** Public Place header. `null` unless the Place exists, is active and has at least one public item. */
export async function readPublicPlace(db: Sql, placeId: string): Promise<PublicPlace | null> {
  if (typeof placeId !== 'string' || !isPlaceId(placeId)) return null
  const rows = await db.query<{ name: string; slug: string | null; count: number }>(
    `SELECT a.name,
       (SELECT s.slug FROM "PlaceSlug" s WHERE s."placeId" = a.id AND s."retiredAt" IS NULL) AS slug,
       (SELECT COUNT(*)::int ${GATED_FROM} WHERE ${PUBLIC_ITEM_GATE}) AS count
     FROM "Asset" a
     WHERE a.id = $1 AND a.type = 'living_place' AND a.status = 'active'`,
    [placeId],
  )
  const row = rows[0]
  if (!row || Number(row.count) < 1) return null
  return { name: row.name, slug: row.slug, publicItemCount: Number(row.count) }
}

export async function listPublicPlaceMemory(db: Sql, placeId: string, limit = 50): Promise<PublicMemoryItem[]> {
  if (typeof placeId !== 'string' || !isPlaceId(placeId)) return []
  const rows = await gatedItems(db, placeId, { limit: Math.min(100, Math.max(1, Math.trunc(limit) || 1)) })
  return hydrate(db, placeId, rows)
}

export async function readPublicMemoryItem(db: Sql, placeId: string, handle: string): Promise<PublicMemoryItem | null> {
  if (typeof placeId !== 'string' || !isPlaceId(placeId)) return null
  if (typeof handle !== 'string' || !PUBLIC_ITEM_HANDLE_RE.test(handle)) return null
  const rows = await gatedItems(db, placeId, { handle, limit: 1 })
  if (!rows.length) return null
  return (await hydrate(db, placeId, rows))[0]
}

export function isCurrentPresenceQuestion(q: string): boolean {
  return /\b(now|today|currently|current|still|present|presence|see|seen|spot|find|there right now|abundan\w*|how many|numbers?|population|trend\w*|declin\w*|increas\w*|condition|health)\b/i.test(q)
}

function validateQuery(query: PublicSearchQuery) {
  const q = query.q ?? ''
  if (typeof q !== 'string' || q.length > 300 || /[\u0000-\u001f]/.test(q)) throw new PublicReadInputError()
  if (query.evidenceClasses?.some((value) => !(EVIDENCE_CLASSES as readonly string[]).includes(value))) {
    throw new PublicReadInputError()
  }
}

/**
 * Public search. Query-shape errors are data-independent (thrown before any DB
 * access); an unknown, private or unpublished Place yields the same empty result.
 */
export async function searchPublicPlaceMemory(
  db: Sql,
  placeId: string,
  query: PublicSearchQuery,
  semantic?: AuthorisedSemanticReranker,
): Promise<PublicSearchResult> {
  validateQuery(query)
  if (typeof placeId !== 'string' || !isPlaceId(placeId)) return { ...EMPTY_SEARCH, facets: { evidenceClass: {} } }
  const q = (query.q ?? '').trim()
  const presence = Boolean(q) && isCurrentPresenceQuestion(q)
  const useSemantic = Boolean(semantic && q && !presence)
  const rows = await gatedItems(db, placeId, {
    q: q && !presence && !useSemantic ? q : undefined,
    evidenceClasses: query.evidenceClasses,
    limit: 200,
  })
  let ordered = rows
  if (useSemantic && semantic) {
    const order = await semantic.rerank(q, rows.map((row) => ({ itemId: row.handle, content: row.content ?? row.originalStatement })))
    const rank = new Map(order.map((handle, index) => [handle, index]))
    ordered = rows.filter((row) => rank.has(row.handle)).sort((a, b) => rank.get(a.handle)! - rank.get(b.handle)!)
  }
  const facets: Record<string, number> = {}
  for (const row of ordered) facets[row.evidenceClass] = (facets[row.evidenceClass] ?? 0) + 1
  const limited = ordered.slice(0, Math.min(50, Math.max(1, Math.trunc(query.limit ?? 30) || 1)))
  return {
    results: await hydrate(db, placeId, limited),
    resultCount: ordered.length,
    facets: { evidenceClass: facets },
    warning: presence ? CURRENT_PRESENCE_WARNING : null,
  }
}

function passage(item: PublicMemoryItem): string {
  const lines = [
    `${item.statement} [${item.kind}; ${item.evidenceClass}]`,
    `Source: ${item.source.publisher ?? 'unknown publisher'}${item.source.sourceIdentifier ? ` (${item.source.sourceIdentifier})` : ''}; licence ${item.source.licence}.`,
    `Dates: ${item.time.unknown ? 'event date unknown' : `${item.time.start ?? '?'} to ${item.time.end ?? '?'} (${item.time.precision})`}; retrieved ${item.source.retrievedAt ?? 'unknown'}.`,
  ]
  const features = item.relationships.filter((r) => r.framing === 'designation_feature')
  if (features.length) lines.push(`Designation features (not current observations): ${features.map((r) => r.label).join('; ')}.`)
  const subjects = item.relationships.filter((r) => r.framing === 'subject')
  if (subjects.length) lines.push(`Subjects: ${subjects.map((r) => r.label).join('; ')}.`)
  if (item.uncertainty.length) lines.push(`Uncertainty: ${item.uncertainty.join(', ')}.`)
  return lines.join('\n')
}

/**
 * Deterministic answer context for a future Ask surface. Built only from public
 * DTOs produced by the gated search; makes no model or provider call.
 */
export async function buildPublicAnswerContext(db: Sql, placeId: string, question: string): Promise<PublicAnswerContext | null> {
  validateQuery({ q: question })
  const place = await readPublicPlace(db, placeId)
  if (!place) return null
  const search = await searchPublicPlaceMemory(db, placeId, { q: question, limit: 10 })
  const items = search.results.length ? search.results : await listPublicPlaceMemory(db, placeId, 10)
  const cautions: string[] = []
  if (search.warning) cautions.push(search.warning)
  if (items.some((item) => item.interpretation.note)) cautions.push(DESIGNATION_FEATURE_NOTE)
  return {
    placeName: place.name,
    question: question.trim(),
    currentPresenceQuestion: Boolean(search.warning),
    passages: items.map((item) => ({ handle: item.handle, text: passage(item) })),
    cautions,
  }
}
