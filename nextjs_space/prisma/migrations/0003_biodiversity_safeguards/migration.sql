-- Biodiversity safeguards (additive). Applies to the evidence database only.
-- Never run against the primary application database. No extension required.
--
-- Adds authoritative server-side classification to every evidence document and
-- an approved source/dataset register. Existing rows adopt safe defaults
-- (UNKNOWN sensitivity + UNKNOWN reuse permission) so nothing is treated as
-- public or embeddable until a reviewer classifies it.

ALTER TABLE "EvidenceDocument" ADD COLUMN IF NOT EXISTS "sensitivity" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "EvidenceDocument" ADD COLUMN IF NOT EXISTS "reusePermission" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "EvidenceDocument" ADD COLUMN IF NOT EXISTS "incomingSensitivity" TEXT;
ALTER TABLE "EvidenceDocument" ADD COLUMN IF NOT EXISTS "catalogueOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EvidenceDocument" ADD COLUMN IF NOT EXISTS "sourceRegisterId" TEXT;

CREATE TABLE IF NOT EXISTS "EvidenceSourceRegister" (
  "id" TEXT PRIMARY KEY,
  "publisher" TEXT NOT NULL,
  "datasetIdentifier" TEXT NOT NULL,
  "licence" TEXT NOT NULL,
  "licenceVersion" TEXT,
  "link" TEXT,
  "requiredAttribution" TEXT NOT NULL,
  "permittedUses" TEXT NOT NULL,
  "commercialUseConditions" TEXT,
  "spatialResolution" TEXT,
  "specificPermissions" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EvidenceSourceRegister_publisher_datasetIdentifier_key" ON "EvidenceSourceRegister"("publisher", "datasetIdentifier");

-- Link documents to their approved register entry. RESTRICT keeps a register row
-- from being deleted while documents still depend on its licence/attribution.
DO $$ BEGIN
  ALTER TABLE "EvidenceDocument"
    ADD CONSTRAINT "EvidenceDocument_sourceRegisterId_fkey"
    FOREIGN KEY ("sourceRegisterId") REFERENCES "EvidenceSourceRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "EvidenceDocument_sensitivity_reusePermission_idx" ON "EvidenceDocument"("sensitivity", "reusePermission");
CREATE INDEX IF NOT EXISTS "EvidenceDocument_sourceRegisterId_idx" ON "EvidenceDocument"("sourceRegisterId");