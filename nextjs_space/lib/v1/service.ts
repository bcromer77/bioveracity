// ==========================================================================
// Developer Platform V1 — core service.
//
// Operates on the shared { Database, Sql } abstraction (lib/workspaces/service)
// so it runs identically against Prisma in production and PGlite in tests. It
// owns the platform's guarantees:
//   • RAW FIRST      — the raw submission is durably stored before, and
//                      independently of, any downstream interpretation.
//   • IDEMPOTENCY    — first-class idempotency keys + payload-fingerprint dedup,
//                      safe under concurrent retries, with conflict detection.
//   • TRACEABILITY   — an ordered stage trace per request.
// No business/domain interpretation lives here beyond storage + status.
// ==========================================================================

import { randomBytes } from 'node:crypto'
import type { Database, Sql } from '@/lib/workspaces/service'
import { CONTRACT_VERSION, fingerprint, type EvidenceCreate } from './contract'
import { idempotencyConflict, internalError } from './errors'
import { generateApiKey, redactSecrets, type KeyMode } from './keys'

// ---- Row + public shapes -------------------------------------------------

export interface ApiKeyRow {
  id: string
  name: string
  mode: KeyMode
  lookupId: string
  secretHash: string
  scopes: string
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
  rotatedFrom: string | null
  ownerLabel: string | null
}

export interface EvidencePublic {
  id: string
  object: 'evidence'
  mode: KeyMode
  contract_version: string
  raw_evidence_id: string
  provider: string
  source_external_id: string | null
  evidence_type: string
  publisher: string | null
  source_url: string | null
  geography: unknown
  observation_time: string | null
  observation_precision: string | null
  publication_time: string | null
  retrieval_time: string | null
  source_data: unknown
  metadata: unknown
  provenance: unknown
  processing_status: string
  request_id: string
  created_at: string
}

export type TraceStage =
  | 'received'
  | 'authenticated'
  | 'validated'
  | 'raw_persisted'
  | 'evidence_id'
  | 'processing'
  | 'replayed'
  | 'error'

export interface TraceEntry {
  stage: TraceStage
  at: string
  detail?: string
}

export interface ServiceOptions {
  now?: () => Date
  genId?: (prefix: string) => string
  // Downstream interpretation hook. Runs AFTER raw + canonical evidence are
  // durably committed; a throw marks processing failed but never destroys the
  // stored evidence.
  processor?: (evidence: EvidencePublic) => Promise<void>
}

const isUniqueViolation = (e: unknown): boolean => {
  const err = e as { code?: string; message?: string }
  return err?.code === '23505' || /duplicate key|unique constraint/i.test(err?.message ?? '')
}

const asJson = (v: unknown): unknown => {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return v
    }
  }
  return v
}

const iso = (v: unknown): string | null => {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function platformService(db: Database, options: ServiceOptions = {}) {
  const now = options.now ?? (() => new Date())
  const genId = options.genId ?? ((prefix: string) => `${prefix}_${randomBytes(16).toString('hex')}`)
  const nowIso = () => now().toISOString()

  function toPublic(row: any): EvidencePublic {
    return {
      id: row.id,
      object: 'evidence',
      mode: row.mode,
      contract_version: row.contractVersion,
      raw_evidence_id: row.rawEvidenceId,
      provider: row.provider,
      source_external_id: row.sourceExternalId ?? null,
      evidence_type: row.evidenceType,
      publisher: row.publisher ?? null,
      source_url: row.sourceUrl ?? null,
      geography: asJson(row.geography ?? null),
      observation_time: iso(row.observationTime),
      observation_precision: row.observationPrecision ?? null,
      publication_time: iso(row.publicationTime),
      retrieval_time: iso(row.retrievalTime),
      source_data: asJson(row.sourceData),
      metadata: asJson(row.metadata ?? null),
      provenance: asJson(row.provenance ?? null),
      processing_status: row.processingStatus,
      request_id: row.requestId,
      created_at: iso(row.createdAt) ?? nowIso(),
    }
  }

  async function loadEvidenceById(tx: Sql, id: string): Promise<EvidencePublic | null> {
    const rows = await tx.query<any>('SELECT * FROM "PlatformEvidence" WHERE "id" = $1', [id])
    return rows[0] ? toPublic(rows[0]) : null
  }
  async function loadEvidenceByRaw(tx: Sql, rawId: string): Promise<EvidencePublic | null> {
    const rows = await tx.query<any>('SELECT * FROM "PlatformEvidence" WHERE "rawEvidenceId" = $1', [rawId])
    return rows[0] ? toPublic(rows[0]) : null
  }

  // ---- API KEYS ----------------------------------------------------------

  async function createKey(input: { name: string; mode: KeyMode; scopes?: string; ownerLabel?: string | null }) {
    const gen = generateApiKey(input.mode, genId('ak'))
    const scopes = input.scopes?.trim() || 'evidence:write,evidence:read'
    await db.query(
      `INSERT INTO "PlatformApiKey" ("id","name","mode","lookupId","secretHash","scopes","createdAt","ownerLabel")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [gen.id, input.name, input.mode, gen.lookupId, gen.secretHash, scopes, nowIso(), input.ownerLabel ?? null],
    )
    // The plaintext token is returned exactly once, here, and never stored.
    return {
      id: gen.id,
      name: input.name,
      mode: input.mode,
      scopes,
      created_at: nowIso(),
      token: gen.token,
    }
  }

  async function revokeKey(id: string): Promise<boolean> {
    const rows = await db.query<{ id: string }>(
      'UPDATE "PlatformApiKey" SET "revokedAt" = $1 WHERE "id" = $2 AND "revokedAt" IS NULL RETURNING "id"',
      [nowIso(), id],
    )
    return rows.length > 0
  }

  // Rotation: mint a replacement in the same mode/scope, revoke the old key,
  // and record the lineage. Returns the new plaintext token once.
  async function rotateKey(id: string) {
    const rows = await db.query<ApiKeyRow>('SELECT * FROM "PlatformApiKey" WHERE "id" = $1', [id])
    const old = rows[0]
    if (!old) return null
    const gen = generateApiKey(old.mode as KeyMode, genId('ak'))
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO "PlatformApiKey" ("id","name","mode","lookupId","secretHash","scopes","createdAt","rotatedFrom","ownerLabel")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [gen.id, old.name, old.mode, gen.lookupId, gen.secretHash, old.scopes, nowIso(), old.id, old.ownerLabel ?? null],
      )
      await tx.query('UPDATE "PlatformApiKey" SET "revokedAt" = $1 WHERE "id" = $2 AND "revokedAt" IS NULL', [nowIso(), old.id])
    })
    return { id: gen.id, name: old.name, mode: old.mode, scopes: old.scopes, created_at: nowIso(), token: gen.token, rotated_from: old.id }
  }

  async function findKeyByLookup(lookupId: string): Promise<ApiKeyRow | null> {
    const rows = await db.query<ApiKeyRow>('SELECT * FROM "PlatformApiKey" WHERE "lookupId" = $1', [lookupId])
    return rows[0] ?? null
  }

  async function markKeyUsed(id: string): Promise<void> {
    await db.query('UPDATE "PlatformApiKey" SET "lastUsedAt" = $1 WHERE "id" = $2', [nowIso(), id])
  }

  // ---- EVIDENCE (raw-first + idempotent) --------------------------------

  // Look up an already-committed result for this operation, if any. Throws on
  // an idempotency-key/payload conflict. Returns null when nothing matches.
  async function resolveExisting(
    tx: Sql,
    apiKey: ApiKeyRow,
    fp: string,
    idempotencyKey: string | null,
  ): Promise<{ evidence: EvidencePublic } | null> {
    if (idempotencyKey) {
      const rows = await tx.query<any>(
        'SELECT * FROM "PlatformIdempotency" WHERE "apiKeyId" = $1 AND "mode" = $2 AND "idempotencyKey" = $3',
        [apiKey.id, apiKey.mode, idempotencyKey],
      )
      const rec = rows[0]
      if (rec) {
        if (rec.requestHash !== fp) throw idempotencyConflict()
        const ev = rec.evidenceId ? await loadEvidenceById(tx, rec.evidenceId) : null
        if (ev) return { evidence: ev }
      }
    }
    const rawRows = await tx.query<any>(
      'SELECT "id" FROM "PlatformRawEvidence" WHERE "mode" = $1 AND "payloadFingerprint" = $2',
      [apiKey.mode, fp],
    )
    if (rawRows[0]) {
      const ev = await loadEvidenceByRaw(tx, rawRows[0].id)
      if (ev) return { evidence: ev }
    }
    return null
  }

  async function createEvidence(input: {
    apiKey: ApiKeyRow
    body: EvidenceCreate
    rawBody: unknown
    idempotencyKey?: string | null
    requestId: string
  }): Promise<{ evidence: EvidencePublic; replayed: boolean }> {
    const { apiKey, body, rawBody, requestId } = input
    const idempotencyKey = input.idempotencyKey ?? null
    const fp = fingerprint(rawBody)

    // Fast path: already committed?
    const pre = await resolveExisting(db, apiKey, fp, idempotencyKey)
    if (pre) return { evidence: pre.evidence, replayed: true }

    const rawId = genId('raw')
    const evId = genId('ev')

    try {
      await db.transaction(async (tx) => {
        // RAW FIRST — the untouched submission is durable before anything else.
        await tx.query(
          `INSERT INTO "PlatformRawEvidence" ("id","apiKeyId","mode","payloadFingerprint","rawBody","idempotencyKey","requestId","createdAt")
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
          [rawId, apiKey.id, apiKey.mode, fp, JSON.stringify(rawBody), idempotencyKey, requestId, nowIso()],
        )
        // Canonical evidence id, marked RAW_PERSISTED (processing not yet run).
        await tx.query(
          `INSERT INTO "PlatformEvidence"
             ("id","apiKeyId","mode","rawEvidenceId","contractVersion","provider","sourceExternalId","evidenceType",
              "publisher","sourceUrl","geography","observationTime","observationPrecision","publicationTime","retrievalTime",
              "sourceData","metadata","provenance","processingStatus","idempotencyKey","requestId","createdAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18::jsonb,$19,$20,$21,$22)`,
          [
            evId, apiKey.id, apiKey.mode, rawId, CONTRACT_VERSION,
            body.provider, body.source_external_id ?? null, body.evidence_type,
            body.publisher ?? null, body.source_url ?? null,
            body.geography ? JSON.stringify(body.geography) : null,
            body.observation_time ?? null, body.observation_precision ?? null,
            body.publication_time ?? null, body.retrieval_time ?? null,
            JSON.stringify(body.source_data),
            body.metadata ? JSON.stringify(body.metadata) : null,
            body.provenance ? JSON.stringify(body.provenance) : null,
            'RAW_PERSISTED', idempotencyKey, requestId, nowIso(),
          ],
        )
        if (idempotencyKey) {
          await tx.query(
            `INSERT INTO "PlatformIdempotency" ("id","apiKeyId","mode","idempotencyKey","requestHash","evidenceId","rawEvidenceId","requestId","createdAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [genId('idem'), apiKey.id, apiKey.mode, idempotencyKey, fp, evId, rawId, requestId, nowIso()],
          )
        }
      })
    } catch (e) {
      // Concurrent retry lost the race — re-read the winner's committed result.
      if (isUniqueViolation(e)) {
        const existing = await resolveExisting(db, apiKey, fp, idempotencyKey)
        if (existing) return { evidence: existing.evidence, replayed: true }
      }
      throw e
    }

    // Downstream interpretation runs AFTER the raw-first guarantee is met.
    let evidence = await loadEvidenceById(db, evId)
    if (!evidence) throw internalError()
    if (options.processor) {
      try {
        await options.processor(evidence)
        await db.query('UPDATE "PlatformEvidence" SET "processingStatus" = $1 WHERE "id" = $2', ['PROCESSED', evId])
      } catch (e) {
        const detail = redactSecrets(String((e as Error)?.message ?? e)).slice(0, 500)
        await db.query('UPDATE "PlatformEvidence" SET "processingStatus" = $1, "processingError" = $2 WHERE "id" = $3', [
          'PROCESSING_FAILED', detail, evId,
        ])
      }
      evidence = await loadEvidenceById(db, evId)
    }
    return { evidence: evidence!, replayed: false }
  }

  // Reads are always scoped to the authenticated key's id AND mode, enforcing
  // test/live isolation and preventing cross-tenant access.
  async function getEvidence(apiKey: ApiKeyRow, id: string): Promise<EvidencePublic | null> {
    const rows = await db.query<any>(
      'SELECT * FROM "PlatformEvidence" WHERE "id" = $1 AND "apiKeyId" = $2 AND "mode" = $3',
      [id, apiKey.id, apiKey.mode],
    )
    return rows[0] ? toPublic(rows[0]) : null
  }

  // ---- REQUEST LOG / TRACE ----------------------------------------------

  async function recordRequest(entry: {
    id: string
    apiKeyId: string | null
    mode: string | null
    method: string
    path: string
    status: number
    errorType?: string | null
    errorCode?: string | null
    evidenceId?: string | null
    rawEvidenceId?: string | null
    idempotencyKey?: string | null
    trace: TraceEntry[]
  }): Promise<void> {
    await db.query(
      `INSERT INTO "PlatformRequest"
         ("id","apiKeyId","mode","method","path","status","errorType","errorCode","evidenceId","rawEvidenceId","idempotencyKey","trace","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)`,
      [
        entry.id, entry.apiKeyId, entry.mode, entry.method, entry.path, entry.status,
        entry.errorType ?? null, entry.errorCode ?? null, entry.evidenceId ?? null,
        entry.rawEvidenceId ?? null, entry.idempotencyKey ?? null, JSON.stringify(entry.trace), nowIso(),
      ],
    )
  }

  async function getRequest(apiKey: ApiKeyRow, id: string) {
    const rows = await db.query<any>(
      'SELECT * FROM "PlatformRequest" WHERE "id" = $1 AND "apiKeyId" = $2',
      [id, apiKey.id],
    )
    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      object: 'request' as const,
      mode: row.mode,
      method: row.method,
      path: row.path,
      status: row.status,
      error_type: row.errorType ?? null,
      error_code: row.errorCode ?? null,
      evidence_id: row.evidenceId ?? null,
      raw_evidence_id: row.rawEvidenceId ?? null,
      idempotency_key: row.idempotencyKey ?? null,
      trace: asJson(row.trace),
      created_at: iso(row.createdAt),
    }
  }

  return {
    createKey,
    revokeKey,
    rotateKey,
    findKeyByLookup,
    markKeyUsed,
    createEvidence,
    getEvidence,
    getRequest,
    recordRequest,
    genId,
    nowIso,
  }
}

export type PlatformService = ReturnType<typeof platformService>
