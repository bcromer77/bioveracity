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

// A unique violation must be recognised across drivers. Prisma's raw-query path
// ($queryRawUnsafe) wraps the underlying Postgres error as P2010, with the real
// SQLSTATE (23505) and phrasing ("... already exists") only in the MESSAGE — the
// top-level code is NOT 23505. Prisma's typed path uses P2002. PGlite surfaced yet
// another shape. So we match on code AND on the message text to be driver-agnostic.
const isUniqueViolation = (e: unknown): boolean => {
  const err = e as { code?: string; message?: string }
  const msg = err?.message ?? ''
  return (
    err?.code === '23505' ||
    err?.code === 'P2002' ||
    /\b23505\b|already exists|duplicate key|unique constraint/i.test(msg)
  )
}

// Under real Postgres SERIALIZABLE isolation, a concurrent identical write may
// lose the race with a serialization failure (SQLSTATE 40001, surfaced by Prisma
// as P2034 or wrapped in a P2010 message) rather than a unique violation. Either
// way the loser's transaction rolled back and the winner committed, so the correct
// idempotent response is to re-read the winner's row — not to return a 500. PGlite
// never exercised this path.
const isRaceLoss = (e: unknown): boolean => {
  if (isUniqueViolation(e)) return true
  const err = e as { code?: string; message?: string }
  const msg = err?.message ?? ''
  return (
    err?.code === '40001' ||
    err?.code === 'P2034' ||
    /\b40001\b|serialization failure|could not serialize|write conflict|deadlock/i.test(msg)
  )
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
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8)`,
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
      'UPDATE "PlatformApiKey" SET "revokedAt" = $1::timestamptz WHERE "id" = $2 AND "revokedAt" IS NULL RETURNING "id"',
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
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9)`,
        [gen.id, old.name, old.mode, gen.lookupId, gen.secretHash, old.scopes, nowIso(), old.id, old.ownerLabel ?? null],
      )
      await tx.query('UPDATE "PlatformApiKey" SET "revokedAt" = $1::timestamptz WHERE "id" = $2 AND "revokedAt" IS NULL', [nowIso(), old.id])
    })
    return { id: gen.id, name: old.name, mode: old.mode, scopes: old.scopes, created_at: nowIso(), token: gen.token, rotated_from: old.id }
  }

  async function findKeyByLookup(lookupId: string): Promise<ApiKeyRow | null> {
    const rows = await db.query<ApiKeyRow>('SELECT * FROM "PlatformApiKey" WHERE "lookupId" = $1', [lookupId])
    return rows[0] ?? null
  }

  async function markKeyUsed(id: string): Promise<void> {
    await db.query('UPDATE "PlatformApiKey" SET "lastUsedAt" = $1::timestamptz WHERE "id" = $2', [nowIso(), id])
  }

  // ---- EVIDENCE (raw-first + idempotent) --------------------------------

  // Look up an already-committed result for this operation, if any. Throws on
  // an idempotency-key/payload conflict. Returns null when nothing matches.
  //
  // `viaKey` reports HOW the result was resolved: true when an existing
  // PlatformIdempotency ledger entry for the supplied key was matched (so the
  // key is already durably bound), false when resolution came only from
  // payload-fingerprint dedup (so a supplied key still needs binding). The
  // caller uses this to decide whether to bind the key before replaying.
  async function resolveExisting(
    tx: Sql,
    apiKey: ApiKeyRow,
    fp: string,
    idempotencyKey: string | null,
  ): Promise<{ evidence: EvidencePublic; viaKey: boolean } | null> {
    if (idempotencyKey) {
      const rows = await tx.query<any>(
        'SELECT * FROM "PlatformIdempotency" WHERE "apiKeyId" = $1 AND "mode" = $2 AND "idempotencyKey" = $3',
        [apiKey.id, apiKey.mode, idempotencyKey],
      )
      const rec = rows[0]
      if (rec) {
        if (rec.requestHash !== fp) throw idempotencyConflict()
        const ev = rec.evidenceId ? await loadEvidenceById(tx, rec.evidenceId) : null
        if (ev) return { evidence: ev, viaKey: true }
      }
    }
    // Dedup boundary is per-key: (apiKeyId, mode, payloadFingerprint). Two
    // independent keys submitting an identical payload must NEVER collide, and
    // one key must never resolve to another key's evidence object.
    const rawRows = await tx.query<any>(
      'SELECT "id" FROM "PlatformRawEvidence" WHERE "apiKeyId" = $1 AND "mode" = $2 AND "payloadFingerprint" = $3',
      [apiKey.id, apiKey.mode, fp],
    )
    if (rawRows[0]) {
      const ev = await loadEvidenceByRaw(tx, rawRows[0].id)
      if (ev) return { evidence: ev, viaKey: false }
    }
    return null
  }

  // Durably bind a supplied idempotency key to the payload/evidence it first
  // represented. Called when a replay was resolved by payload-fingerprint dedup
  // but the key itself is not yet in the ledger. Safe to call repeatedly and
  // under concurrency: the unique constraint (apiKeyId, mode, idempotencyKey)
  // makes the first writer win. A loser re-reads the committed row and either
  // accepts an identical binding (idempotent no-op) or raises the structured
  // 409 when the same key is being reused for a materially different payload.
  async function bindIdempotencyKey(
    apiKey: ApiKeyRow,
    idempotencyKey: string,
    fp: string,
    evidenceId: string,
    rawEvidenceId: string,
    requestId: string,
  ): Promise<void> {
    const readBinding = async () => {
      const rows = await db.query<any>(
        'SELECT * FROM "PlatformIdempotency" WHERE "apiKeyId" = $1 AND "mode" = $2 AND "idempotencyKey" = $3',
        [apiKey.id, apiKey.mode, idempotencyKey],
      )
      return rows[0] ?? null
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await db.query(
          `INSERT INTO "PlatformIdempotency" ("id","apiKeyId","mode","idempotencyKey","requestHash","evidenceId","rawEvidenceId","requestId","createdAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)`,
          [genId('idem'), apiKey.id, apiKey.mode, idempotencyKey, fp, evidenceId, rawEvidenceId, requestId, nowIso()],
        )
        return
      } catch (e) {
        // A concurrent writer already bound this key (unique violation) or the
        // write lost a serialization race — re-read and reconcile.
        if (!isRaceLoss(e)) throw e
        const rec = await readBinding()
        if (rec) {
          if (rec.requestHash !== fp) throw idempotencyConflict()
          return // identical binding already present — idempotent no-op
        }
        await new Promise((r) => setTimeout(r, 20))
      }
    }
    // Exhausted retries without the row becoming visible — final reconciliation.
    const rec = await readBinding()
    if (rec) {
      if (rec.requestHash !== fp) throw idempotencyConflict()
      return
    }
    throw internalError()
  }

  // Resolve an already-committed result AND ensure any supplied idempotency key
  // is durably bound to it before returning the replay. This closes the gap
  // where a fingerprint-dedup replay returned without recording the new key,
  // which would let that key later be reused with a different payload.
  async function resolveAndBind(
    apiKey: ApiKeyRow,
    fp: string,
    idempotencyKey: string | null,
    requestId: string,
  ): Promise<{ evidence: EvidencePublic } | null> {
    const found = await resolveExisting(db, apiKey, fp, idempotencyKey)
    if (!found) return null
    if (idempotencyKey && !found.viaKey) {
      await bindIdempotencyKey(
        apiKey,
        idempotencyKey,
        fp,
        found.evidence.id,
        found.evidence.raw_evidence_id,
        requestId,
      )
    }
    return { evidence: found.evidence }
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

    // Fast path: already committed? Bind the supplied key to the existing
    // result before replaying, so a fingerprint-dedup hit never leaves a fresh
    // key unbound.
    const pre = await resolveAndBind(apiKey, fp, idempotencyKey, requestId)
    if (pre) return { evidence: pre.evidence, replayed: true }

    const rawId = genId('raw')
    const evId = genId('ev')

    try {
      await db.transaction(async (tx) => {
        // RAW FIRST — the untouched submission is durable before anything else.
        await tx.query(
          `INSERT INTO "PlatformRawEvidence" ("id","apiKeyId","mode","payloadFingerprint","rawBody","idempotencyKey","requestId","createdAt")
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::timestamptz)`,
          [rawId, apiKey.id, apiKey.mode, fp, JSON.stringify(rawBody), idempotencyKey, requestId, nowIso()],
        )
        // Canonical evidence id, marked RAW_PERSISTED (processing not yet run).
        await tx.query(
          `INSERT INTO "PlatformEvidence"
             ("id","apiKeyId","mode","rawEvidenceId","contractVersion","provider","sourceExternalId","evidenceType",
              "publisher","sourceUrl","geography","observationTime","observationPrecision","publicationTime","retrievalTime",
              "sourceData","metadata","provenance","processingStatus","idempotencyKey","requestId","createdAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::timestamptz,$13,$14::timestamptz,$15::timestamptz,$16::jsonb,$17::jsonb,$18::jsonb,$19,$20,$21,$22::timestamptz)`,
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
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)`,
            [genId('idem'), apiKey.id, apiKey.mode, idempotencyKey, fp, evId, rawId, requestId, nowIso()],
          )
        }
      })
    } catch (e) {
      // Concurrent retry lost the race (unique violation OR serialization failure
      // under real SERIALIZABLE isolation) — re-read the winner's committed result.
      // The winner has committed by the time either error surfaces; a couple of
      // bounded re-read attempts absorb any brief read-visibility timing.
      if (isRaceLoss(e)) {
        for (let attempt = 0; attempt < 3; attempt++) {
          // Bind the supplied key to the winner's result as part of recovery,
          // so every concurrent submission's key is durably recorded even
          // though only one raw/evidence row was written.
          const existing = await resolveAndBind(apiKey, fp, idempotencyKey, requestId)
          if (existing) return { evidence: existing.evidence, replayed: true }
          await new Promise((r) => setTimeout(r, 20))
        }
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
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::timestamptz)`,
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
