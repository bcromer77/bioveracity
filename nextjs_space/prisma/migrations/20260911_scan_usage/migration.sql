-- Monthly scan-usage counter for the Cloudmersive free-tier quota (600/month).
-- Shared across all app instances via the common database.
CREATE TABLE IF NOT EXISTS "ScanUsage" (
  "month" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ScanUsage_pkey" PRIMARY KEY ("month")
);
