import type { Sql } from '@/lib/workspaces/service'
import type { MemoryActor } from './types'

type TraceRow = {
  itemId: string
  placeId: string
  itemKind: string
  evidenceClass: string
  relationType: string
  entityId: string | null
  entityLabel: string | null
  platformEvidenceId: string
  rawEvidenceId: string
  requestId: string
  mode: string
  publisher: string | null
  sourceExternalId: string | null
  sourceUrl: string | null
  retrievalTime: Date | string | null
  provenance: unknown
  rawFingerprint: string
  sourceRelationship: string
  sourceIndependenceKey: string
}

const parsed = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') {
    try { return parsed(JSON.parse(value)) } catch { return {} }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

// The access predicate is repeated intentionally at the provenance boundary:
// callers cannot turn a search hit id into a private-source existence oracle.
export async function tracePlaceMemoryProvenance(db: Sql, actor: MemoryActor, itemId: string) {
  if (!/^mem_[a-f0-9]{32}$/.test(itemId)) throw new Error('Invalid memory item id')
  const userId = actor.kind === 'user' ? actor.userId : ''
  const rows = await db.query<TraceRow>(
    `SELECT m.id AS "itemId",m."placeId",m.kind AS "itemKind",m."evidenceClass",
       COALESCE(ie."relationType",'ABOUT') AS "relationType",e.id AS "entityId",e."canonicalLabel" AS "entityLabel",
       p.id AS "platformEvidenceId",p."rawEvidenceId",p."requestId",p.mode,p.publisher,p."sourceExternalId",
       p."sourceUrl",p."retrievalTime",p.provenance,r."payloadFingerprint" AS "rawFingerprint",
       sl.relationship AS "sourceRelationship",sl."sourceIndependenceKey"
     FROM "PlaceMemoryItem" m
     JOIN "PlaceMemorySourceLink" sl ON sl."itemId"=m.id
     JOIN "PlatformEvidence" p ON p.id=sl."platformEvidenceId"
     JOIN "PlatformRawEvidence" r ON r.id=p."rawEvidenceId"
     LEFT JOIN "PlaceMemoryItemEntity" ie ON ie."itemId"=m.id
     LEFT JOIN "PlaceMemoryEntity" e ON e.id=ie."entityId"
     WHERE m.id=$1 AND m.status='ACTIVE' AND p.mode='live' AND (
       (m.visibility='PUBLIC' AND m."rightsState"='CLEARED_FOR_INGEST' AND p.mode='live')
       OR ($2 <> '' AND m.visibility='WORKSPACE_PRIVATE' AND EXISTS (
         SELECT 1 FROM "PrivateWorkspaceMember" wm
         WHERE wm."workspaceId"=m."workspaceId" AND wm."userId"=$2 AND wm."revokedAt" IS NULL
       ))
       OR ($2 <> '' AND m.visibility='RESTRICTED' AND EXISTS (
         SELECT 1 FROM "User" u WHERE u.id=$2 AND (u.role='admin' OR u."accessState"='ADMIN')
       ))
     )
     ORDER BY sl.relationship,p.id,e."externalId" NULLS LAST,e.id`,
    [itemId, userId],
  )
  if (!rows.length) return null
  const first = rows[0]
  const sources = new Map<string, ReturnType<typeof source>>()
  for (const row of rows) if (!sources.has(row.platformEvidenceId)) sources.set(row.platformEvidenceId, source(row))
  const entities = new Map<string, { id: string; label: string; relationship: string }>()
  for (const row of rows) if (row.entityId && row.entityLabel) entities.set(row.entityId, {
    id: row.entityId, label: row.entityLabel, relationship: row.relationType,
  })
  return {
    answerEvidenceId: first.itemId,
    placeId: first.placeId,
    itemKind: first.itemKind,
    evidenceClass: first.evidenceClass,
    entities: [...entities.values()],
    sources: [...sources.values()],
  }
}

function source(row: TraceRow) {
  const provenance = parsed(row.provenance)
  return {
    platformEvidenceId: row.platformEvidenceId,
    rawEvidenceId: row.rawEvidenceId,
    requestId: row.requestId,
    mode: row.mode,
    publisher: row.publisher,
    sourceExternalId: row.sourceExternalId,
    sourceUrl: row.sourceUrl,
    retrievalTime: row.retrievalTime == null ? null : new Date(row.retrievalTime).toISOString(),
    licence: typeof provenance.licence === 'string' ? provenance.licence : null,
    rightsClass: typeof provenance.rights_class === 'string' ? provenance.rights_class : null,
    attribution: typeof provenance.attribution === 'string' ? provenance.attribution : null,
    sourceRelationship: row.sourceRelationship,
    sourceIndependenceKey: row.sourceIndependenceKey,
    // Hash proves which immutable raw record was used without exposing its body.
    rawFingerprint: row.rawFingerprint,
  }
}
