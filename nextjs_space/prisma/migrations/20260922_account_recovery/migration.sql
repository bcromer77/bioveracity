-- Account recovery and session invalidation (additive, safe for existing rows).

-- Per-user authority version. Incremented on password reset so that any JWT
-- minted beforehand is rejected and existing sessions lose access.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authVersion" INTEGER NOT NULL DEFAULT 0;

-- Single-use, expiring password reset tokens. Only the SHA-256 hash of each
-- token is stored; the raw token exists solely inside the emailed link.
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- Persistent, fixed-window rate-limit counters shared across all instances.
CREATE TABLE IF NOT EXISTS "AuthRateLimit" (
  "id" TEXT PRIMARY KEY,
  "bucket" TEXT NOT NULL,
  "identifierHash" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthRateLimit_bucket_identifierHash_windowStart_key" ON "AuthRateLimit"("bucket","identifierHash","windowStart");
CREATE INDEX IF NOT EXISTS "AuthRateLimit_windowStart_idx" ON "AuthRateLimit"("windowStart");
