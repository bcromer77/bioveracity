
CREATE TABLE "WildHubReview" (
 "id" TEXT PRIMARY KEY,
 "hubId" TEXT NOT NULL REFERENCES "WildHub"("id") ON DELETE CASCADE,
 "submittedBy" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "revision" INTEGER NOT NULL,
 "snapshot" JSONB NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','REJECTED')),
 "reviewedBy" TEXT REFERENCES "User"("id") ON DELETE RESTRICT,
 "reason" TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "reviewedAt" TIMESTAMP(3),
 CONSTRAINT "WildHubReview_hubId_revision_key" UNIQUE ("hubId","revision")
);
CREATE INDEX "WildHubReview_status_createdAt_idx" ON "WildHubReview"("status","createdAt");
