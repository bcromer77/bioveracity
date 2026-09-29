import { EVIDENCE_CLASSES, type AuthorisedSemanticReranker, type MemoryActor, type MemoryMatchedEntity, type MemorySearchHit, type MemorySearchQuery, type MemorySearchResponse, type PlaceMemoryEvidenceClass } from './types'
import { normaliseMemoryTerm } from './memory-utils'
import { isPlaceId } from '../place/identity'
import type { Sql } from '@/lib/workspaces/service'

type CandidateRow = {
  id: string
  placeId: string
  kind: string
  evidenceClass: PlaceMemoryEvidenceClass
  visibility: string
  rightsState: string
  originalStatement: string
  eventStart: Date | string | null
  eventEnd: Date | string | null
  timePrecision: string
  geographyPrecision: string | null
  locationDisclosure: string
  content: string
  sourceMode: 'test' | 'live' | null
  publisher: string | null
  sourceExternalId: string | null
  sourceUrl: string | null
  retrievalTime: Date | string | null
}

type EntityRow = {
  itemId: string
  id: string
  kind: string
  canonicalLabel: string
  externalId: string | null
  relationType: string
  assertionState: string
  term: string | null
  normalized: string | null
}

const day = /^\d{4}-\d{2}-\d{2}$/
const iso = (value: Date | string | null): string | null => value == null ? null : new Date(value).toISOString()

function validate(query: MemorySearchQuery) {
  if (!isPlaceId(query.placeId)) throw new Error('Invalid place id')
  if ((query.q?.length ?? 0) > 300 || /[\u0000-\u001f]/.test(query.q ?? '')) throw new Error('Invalid search text')
  for (const value of [query.from, query.to]) {
    if (value && (!day.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) {
      throw new Error('Invalid date filter')
    }
  }
  if (query.from && query.to && query.from > query.to) throw new Error('Reversed date range')
  if (query.evidenceClasses?.some((value) => !(EVIDENCE_CLASSES as readonly string[]).includes(value))) {
    throw new Error('Invalid evidence class')
  }
  if ((query.entityIds?.length ?? 0) > 50 || query.entityIds?.some((id) => !/^[-_:a-z0-9.]{1,160}$/i.test(id))) {
    throw new Error('Invalid entity filter')
  }
  if ((query.publisher?.length ?? 0) > 300 || (query.sourceExternalId?.length ?? 0) > 300) {
    throw new Error('Invalid source filter')
  }
}

function currentPresenceQuestion(q: string): boolean {
  return /\b(definitely|certainly|guaranteed)\b.*\b(see|find|present|here)\b|\b(see|present|here)\b.*\b(today|now)\b/i.test(q)
}

function significantTerms(q: string): string[] {
  const stop = new Set(['a', 'an', 'the', 'is', 'are', 'there', 'with', 'what', 'which', 'for', 'here', 'this', 'that', 'can', 'i', 'of', 'in', 'at', 'to', 'and'])
  return normaliseMemoryTerm(q).split(' ').filter((term) => term.length > 1 && !stop.has(term))
}

function parameter(values: unknown[], value: unknown): string {
  values.push(value)
  return `$${values.length}`
}

async function candidates(
  db: Sql,
  actor: MemoryActor,
  query: MemorySearchQuery,
  applyTextFilter: boolean,
): Promise<CandidateRow[]> {
  const values: unknown[] = []
  const place = parameter(values, query.placeId)
  const actorId = parameter(values, actor.kind === 'user' ? actor.userId : '')
  const where = [
    `m."placeId"=${place}`,
    `m.status='ACTIVE'`,
    // Test-mode transport records are never searchable Place Memory, even for
    // an otherwise-authorised workspace member or administrator.
    `(p.id IS NULL OR p.mode='live')`,
    `(
      (m.visibility='PUBLIC' AND m."rightsState"='CLEARED_FOR_INGEST')
      OR (${actorId} <> '' AND m.visibility='WORKSPACE_PRIVATE' AND EXISTS (
        SELECT 1 FROM "PrivateWorkspaceMember" wm
        WHERE wm."workspaceId"=m."workspaceId" AND wm."userId"=${actorId} AND wm."revokedAt" IS NULL
      ))
      OR (${actorId} <> '' AND m.visibility='RESTRICTED' AND EXISTS (
        SELECT 1 FROM "User" u WHERE u.id=${actorId} AND (u.role='admin' OR u."accessState"='ADMIN')
      ))
    )`,
  ]
  if (query.from) where.push(`m."eventEnd" >= ${parameter(values, `${query.from}T00:00:00.000Z`)}::timestamptz`)
  if (query.to) where.push(`m."eventStart" <= ${parameter(values, `${query.to}T23:59:59.999Z`)}::timestamptz`)
  if (query.publisher) where.push(`p.publisher = ${parameter(values, query.publisher)}`)
  if (query.sourceExternalId) where.push(`p."sourceExternalId" = ${parameter(values, query.sourceExternalId)}`)
  if (query.evidenceClasses?.length) {
    const refs = query.evidenceClasses.map((value) => parameter(values, value))
    where.push(`m."evidenceClass" IN (${refs.join(',')})`)
  }
  if (query.entityIds?.length) {
    const refs = query.entityIds.map((value) => parameter(values, value))
    where.push(`EXISTS (SELECT 1 FROM "PlaceMemoryItemEntity" ie WHERE ie."itemId"=m.id AND ie."entityId" IN (${refs.join(',')}))`)
  }
  if (applyTextFilter && query.q?.trim()) {
    const q = parameter(values, query.q.trim())
    where.push(`(
      to_tsvector('english', sd.content) @@ websearch_to_tsquery('english', ${q})
      OR to_tsvector('simple', sd.content) @@ websearch_to_tsquery('simple', ${q})
    )`)
  }
  const max = Math.min(200, Math.max(query.limit ?? 30, 30))
  values.push(max)
  return db.query<CandidateRow>(
    `SELECT m.id,m."placeId",m.kind,m."evidenceClass",m.visibility,m."rightsState",m."originalStatement",
       m."eventStart",m."eventEnd",m."timePrecision",m."geographyPrecision",m."locationDisclosure",sd.content,
       p.mode AS "sourceMode",p.publisher,p."sourceExternalId",p."sourceUrl",p."retrievalTime"
     FROM "PlaceMemoryItem" m
     JOIN "PlaceMemorySearchDocument" sd ON sd."itemId"=m.id
     LEFT JOIN "PlatformEvidence" p ON p.id=m."platformEvidenceId"
     WHERE ${where.join(' AND ')}
     ORDER BY m."createdAt",m.id LIMIT $${values.length}`,
    values,
  )
}

async function loadEntities(db: Sql, itemIds: string[]): Promise<Map<string, EntityRow[]>> {
  const map = new Map<string, EntityRow[]>()
  if (!itemIds.length) return map
  const values: unknown[] = []
  const refs = itemIds.map((id) => parameter(values, id))
  const rows = await db.query<EntityRow>(
    `SELECT ie."itemId",e.id,e.kind,e."canonicalLabel",e."externalId",ie."relationType",ie."assertionState",
       t.term,t.normalized
     FROM "PlaceMemoryItemEntity" ie
     JOIN "PlaceMemoryEntity" e ON e.id=ie."entityId"
     LEFT JOIN "PlaceMemoryTerm" t ON t."entityId"=e.id
     WHERE ie."itemId" IN (${refs.join(',')})
     ORDER BY ie."itemId",e."externalId" NULLS LAST,e.id,t.term`,
    values,
  )
  for (const row of rows) map.set(row.itemId, [...(map.get(row.itemId) ?? []), row])
  return map
}

function entitiesFor(rows: EntityRow[], q: string): MemoryMatchedEntity[] {
  const query = normaliseMemoryTerm(q)
  const tokens = significantTerms(q)
  const byId = new Map<string, MemoryMatchedEntity>()
  for (const row of rows) {
    let entity = byId.get(row.id)
    if (!entity) {
      entity = {
        id: row.id,
        kind: row.kind,
        canonicalLabel: row.canonicalLabel,
        externalId: row.externalId,
        relationType: row.relationType,
        assertionState: row.assertionState,
        matchedTerms: [],
      }
      byId.set(row.id, entity)
    }
    if (row.term && row.normalized) {
      const termTokens = row.normalized.split(' ')
      const direct = query.includes(row.normalized) || row.normalized.includes(query)
      const overlap = termTokens.length >= 2 && termTokens.filter((token) => tokens.includes(token)).length >= Math.min(3, termTokens.length)
      if ((direct || overlap) && !entity.matchedTerms.includes(row.term)) entity.matchedTerms.push(row.term)
    }
  }
  const all = [...byId.values()]
  const matched = all.filter((entity) => entity.matchedTerms.length)
  return matched.length ? matched : all
}

function hit(row: CandidateRow, q: string, entityRows: EntityRow[], presenceGuard: boolean, semantic: boolean): MemorySearchHit {
  const entities = entitiesFor(entityRows, q)
  const identifier = Boolean(q && [row.id, row.sourceExternalId ?? '', ...entities.map((e) => e.externalId ?? '')]
    .some((value) => value && normaliseMemoryTerm(q).includes(normaliseMemoryTerm(value))))
  const concept = entities.some((entity) => entity.matchedTerms.length)
  const matchType = semantic ? 'semantic' : !q || presenceGuard ? 'browse' : identifier ? 'identifier' : concept ? 'concept' : 'lexical'
  const matchReason = presenceGuard
    ? 'Returned as designation context only; the question asks for current presence, which this evidence cannot establish.'
    : matchType === 'concept'
      ? 'Matched separate concept vocabulary; the underlying source assertion remains unchanged.'
      : matchType === 'identifier'
        ? 'Matched a source/place/taxon identifier.'
        : matchType === 'semantic'
          ? 'Ranked from the access-authorised search representation; evidence facts were not changed.'
          : matchType === 'lexical'
            ? 'Matched words in the rebuildable search representation.'
            : 'Included in the authorised place-memory record.'
  return {
    id: row.id,
    placeId: row.placeId,
    kind: row.kind,
    evidenceClass: row.evidenceClass,
    sourceMode: row.sourceMode,
    originalStatement: row.originalStatement,
    eventStart: iso(row.eventStart),
    eventEnd: iso(row.eventEnd),
    timePrecision: row.timePrecision,
    geographyPrecision: row.geographyPrecision,
    // Search never returns geometry. This label tells a later presentation layer
    // what it may disclose without placing coordinates in the response at all.
    locationDisclosure: row.locationDisclosure,
    publisher: row.publisher,
    sourceExternalId: row.sourceExternalId,
    sourceUrl: row.sourceUrl,
    retrievalTime: iso(row.retrievalTime),
    rightsState: row.rightsState,
    matchType,
    matchReason,
    entities,
    currentPresenceSupported: false,
  }
}

export async function searchPlaceMemory(
  db: Sql,
  actor: MemoryActor,
  query: MemorySearchQuery,
  semantic?: AuthorisedSemanticReranker,
): Promise<MemorySearchResponse> {
  validate(query)
  const q = query.q?.trim() ?? ''
  const presenceGuard = currentPresenceQuestion(q)
  const useSemantic = Boolean(semantic && q && !presenceGuard)
  const rows = await candidates(db, actor, query, Boolean(q && !presenceGuard && !useSemantic))
  const authorisedCandidateCount = rows.length
  let ordered = rows
  if (useSemantic && semantic) {
    const order = await semantic.rerank(q, rows.map((row) => ({ itemId: row.id, content: row.content })))
    const rank = new Map(order.map((id, index) => [id, index]))
    ordered = rows.filter((row) => rank.has(row.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  }
  const limit = Math.min(50, Math.max(1, query.limit ?? 30))
  ordered = ordered.slice(0, limit)
  const entityRows = await loadEntities(db, ordered.map((row) => row.id))
  return {
    hits: ordered.map((row) => hit(row, q, entityRows.get(row.id) ?? [], presenceGuard, useSemantic)),
    authorisedCandidateCount,
    warning: presenceGuard
      ? 'A protected-site qualifying interest is not proof that a species is present or observable today.'
      : null,
  }
}
