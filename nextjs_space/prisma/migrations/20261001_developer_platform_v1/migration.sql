-- Developer Platform V1 — SDK-first ingestion boundary (Stripe-inspired).
--
-- STATUS: IMPLEMENTED (generated), NOT DEPLOYED. Do not run against production
-- without explicit migration-safety review by the deployment authority.
--
-- Additive only: creates five new tables and their indexes. It does NOT alter,
-- drop or rename any existing table, column, constraint or index. All CREATE
-- statements are guarded with IF NOT EXISTS so the migration is safe to re-run
-- and safe against partially-applied state.

-- 1. API credentials. Plaintext secret is never stored; only its SHA-256 hash.
CREATE TABLE IF NOT EXISTS "PlatformApiKey" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "mode"        TEXT NOT NULL,
  "lookupId"    TEXT NOT NULL,
  "secretHash"  TEXT NOT NULL,
  "scopes"      TEXT NOT NULL DEFAULT 'evidence:write,evidence:read',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"  TIMESTAMP(3),
  "revokedAt"   TIMESTAMP(3),
  "rotatedFrom" TEXT,
  "ownerLabel"  TEXT,
  CONSTRAINT "PlatformApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformApiKey_lookupId_key" ON "PlatformApiKey"("lookupId");
CREATE INDEX IF NOT EXISTS "PlatformApiKey_mode_idx" ON "PlatformApiKey"("mode");
CREATE INDEX IF NOT EXISTS "PlatformApiKey_revokedAt_idx" ON "PlatformApiKey"("revokedAt");

-- 2. RAW FIRST: durable raw record written before any interpretation.
CREATE TABLE IF NOT EXISTS "PlatformRawEvidence" (
  "id"                 TEXT NOT NULL,
  "apiKeyId"           TEXT NOT NULL,
  "mode"               TEXT NOT NULL,
  "payloadFingerprint" TEXT NOT NULL,
  "rawBody"            JSONB NOT NULL,
  "idempotencyKey"     TEXT,
  "requestId"          TEXT NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformRawEvidence_pkey" PRIMARY KEY ("id")
);
-- Dedup uniqueness is per-key: identical payloads from two independent API keys
-- must not collide. Scope = (apiKeyId, mode, payloadFingerprint).
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformRawEvidence_apiKeyId_mode_payloadFingerprint_key"
  ON "PlatformRawEvidence"("apiKeyId", "mode", "payloadFingerprint");
CREATE INDEX IF NOT EXISTS "PlatformRawEvidence_apiKeyId_idx" ON "PlatformRawEvidence"("apiKeyId");
CREATE INDEX IF NOT EXISTS "PlatformRawEvidence_requestId_idx" ON "PlatformRawEvidence"("requestId");

-- 3. Canonical evidence with a durable public ev_* id. Uncertainty preserved.
CREATE TABLE IF NOT EXISTS "PlatformEvidence" (
  "id"                   TEXT NOT NULL,
  "apiKeyId"             TEXT NOT NULL,
  "mode"                 TEXT NOT NULL,
  "rawEvidenceId"        TEXT NOT NULL,
  "contractVersion"      TEXT NOT NULL DEFAULT 'v1',
  "provider"             TEXT NOT NULL,
  "sourceExternalId"     TEXT,
  "evidenceType"         TEXT NOT NULL,
  "publisher"            TEXT,
  "sourceUrl"            TEXT,
  "geography"            JSONB,
  "observationTime"      TIMESTAMP(3),
  "observationPrecision" TEXT,
  "publicationTime"      TIMESTAMP(3),
  "retrievalTime"        TIMESTAMP(3),
  "sourceData"           JSONB NOT NULL,
  "metadata"             JSONB,
  "provenance"           JSONB,
  "processingStatus"     TEXT NOT NULL DEFAULT 'RAW_PERSISTED',
  "processingError"      TEXT,
  "idempotencyKey"       TEXT,
  "requestId"            TEXT NOT NULL,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformEvidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformEvidence_rawEvidenceId_key" ON "PlatformEvidence"("rawEvidenceId");
CREATE INDEX IF NOT EXISTS "PlatformEvidence_apiKeyId_idx" ON "PlatformEvidence"("apiKeyId");
CREATE INDEX IF NOT EXISTS "PlatformEvidence_mode_idx" ON "PlatformEvidence"("mode");
CREATE INDEX IF NOT EXISTS "PlatformEvidence_processingStatus_idx" ON "PlatformEvidence"("processingStatus");
CREATE INDEX IF NOT EXISTS "PlatformEvidence_requestId_idx" ON "PlatformEvidence"("requestId");

-- 4. Idempotency ledger. Unique per (apiKey, mode, key).
CREATE TABLE IF NOT EXISTS "PlatformIdempotency" (
  "id"             TEXT NOT NULL,
  "apiKeyId"       TEXT NOT NULL,
  "mode"           TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash"    TEXT NOT NULL,
  "evidenceId"     TEXT,
  "rawEvidenceId"  TEXT,
  "requestId"      TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformIdempotency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformIdempotency_apiKeyId_mode_idempotencyKey_key"
  ON "PlatformIdempotency"("apiKeyId", "mode", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "PlatformIdempotency_apiKeyId_idx" ON "PlatformIdempotency"("apiKeyId");

-- 5. Request traceability. One row per request; never stores credentials.
CREATE TABLE IF NOT EXISTS "PlatformRequest" (
  "id"             TEXT NOT NULL,
  "apiKeyId"       TEXT,
  "mode"           TEXT,
  "method"         TEXT NOT NULL,
  "path"           TEXT NOT NULL,
  "status"         INTEGER NOT NULL,
  "errorType"      TEXT,
  "errorCode"      TEXT,
  "evidenceId"     TEXT,
  "rawEvidenceId"  TEXT,
  "idempotencyKey" TEXT,
  "trace"          JSONB NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlatformRequest_apiKeyId_idx" ON "PlatformRequest"("apiKeyId");
CREATE INDEX IF NOT EXISTS "PlatformRequest_createdAt_idx" ON "PlatformRequest"("createdAt");

-- Foreign keys (additive; guarded so re-runs do not error).
DO $$ BEGIN
  ALTER TABLE "PlatformRawEvidence"
    ADD CONSTRAINT "PlatformRawEvidence_apiKeyId_fkey"
    FOREIGN KEY ("apiKeyId") REFERENCES "PlatformApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformEvidence"
    ADD CONSTRAINT "PlatformEvidence_apiKeyId_fkey"
    FOREIGN KEY ("apiKeyId") REFERENCES "PlatformApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformEvidence"
    ADD CONSTRAINT "PlatformEvidence_rawEvidenceId_fkey"
    FOREIGN KEY ("rawEvidenceId") REFERENCES "PlatformRawEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformIdempotency"
    ADD CONSTRAINT "PlatformIdempotency_apiKeyId_fkey"
    FOREIGN KEY ("apiKeyId") REFERENCES "PlatformApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlatformRequest"
    ADD CONSTRAINT "PlatformRequest_apiKeyId_fkey"
    FOREIGN KEY ("apiKeyId") REFERENCES "PlatformApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
