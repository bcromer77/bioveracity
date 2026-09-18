-- Wild Counties Living Field Journal (PR57)
-- Additive only. Extends the existing WildHub media + adds a distinct
-- visitor community-observation record. No destructive changes.

-- Panorama / media-kind support on the existing owner photo table.
-- kind: 'photo' (default) | 'panorama'. meta carries panorama hotspots.
ALTER TABLE "WildHubPhoto"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'photo',
  ADD COLUMN "meta" JSONB;

-- Per-hub contribution rate-limit counters (mirrors scanCount/scanWindow).
ALTER TABLE "WildHub"
  ADD COLUMN "contribCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "contribWindow" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Visitor community observations. Distinct evidence class from professional
-- ecological evidence; publication never upgrades evidenceClass.
CREATE TABLE "WildContribution" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "photoBytes" BYTEA NOT NULL,
  "photoHash" TEXT NOT NULL,
  "broadCategory" TEXT NOT NULL,
  "whatYouThink" TEXT NOT NULL DEFAULT '',
  "note" TEXT NOT NULL DEFAULT '',
  "observedAt" TIMESTAMP(3),
  "coarseLocation" TEXT NOT NULL DEFAULT '',
  "permissionToPublish" BOOLEAN NOT NULL DEFAULT false,
  "evidenceClass" TEXT NOT NULL DEFAULT 'community-observation',
  "publicationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "sensitiveHidden" BOOLEAN NOT NULL DEFAULT false,
  "moderatorId" TEXT,
  "moderatorNote" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "moderatedAt" TIMESTAMP(3),
  CONSTRAINT "WildContribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WildContribution_publicationStatus_check"
    CHECK ("publicationStatus" IN ('PENDING','PUBLISHED','REJECTED')),
  CONSTRAINT "WildContribution_hubId_fkey"
    FOREIGN KEY ("hubId") REFERENCES "WildHub"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WildContribution_moderatorId_fkey"
    FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "WildContribution_hubId_publicationStatus_idx"
  ON "WildContribution" ("hubId", "publicationStatus");
