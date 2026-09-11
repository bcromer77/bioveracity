-- Cross-instance pacing cursor for the shared Cloudmersive provider key.
-- A single row (id = 'global') holds the epoch-millisecond timestamp of the
-- next free 1-second scan slot. Reserving a slot is an atomic upsert.
CREATE TABLE IF NOT EXISTS "ScanPacing" (
  "id" TEXT NOT NULL,
  "nextMs" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "ScanPacing_pkey" PRIMARY KEY ("id")
);
