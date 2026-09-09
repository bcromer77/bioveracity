CREATE TABLE "EvidenceDocument" (
  "id" TEXT PRIMARY KEY, "documentKey" TEXT NOT NULL, "versionHash" TEXT NOT NULL UNIQUE,
  "observedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "url" TEXT NOT NULL, "title" TEXT NOT NULL, "publisher" TEXT NOT NULL,
  "authorityId" TEXT NOT NULL, "jurisdiction" TEXT NOT NULL,
  "eventDate" TEXT, "eventPrecision" TEXT NOT NULL, "publicationDate" TEXT,
  "contentKind" TEXT NOT NULL, "sections" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW', "activeReviewId" TEXT
);
CREATE INDEX "EvidenceDocument_documentKey_observedAt_idx" ON "EvidenceDocument"("documentKey", "observedAt");
CREATE INDEX "EvidenceDocument_authorityId_idx" ON "EvidenceDocument"("authorityId");
CREATE TABLE "EvidenceReview" (
  "id" TEXT PRIMARY KEY, "documentId" TEXT NOT NULL REFERENCES "EvidenceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reviewer" TEXT NOT NULL, "claim" TEXT NOT NULL, "excerpt" TEXT NOT NULL,
  "locator" TEXT NOT NULL, "basis" TEXT NOT NULL, "evidenceType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EvidenceReview_documentId_idx" ON "EvidenceReview"("documentId");
