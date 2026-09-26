-- PR54: Register interest. Additive only. Captures lightweight demand without
-- touching any User, workspace, WildHub, publication, subscription or payment.
CREATE TABLE "InterestLead" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "organisation" TEXT,
  "category" TEXT NOT NULL,
  "message" TEXT,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "InterestLead_createdAt_idx" ON "InterestLead"("createdAt");
CREATE INDEX "InterestLead_source_idx" ON "InterestLead"("source");
