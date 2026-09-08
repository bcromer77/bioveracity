ALTER TABLE "Event" ADD COLUMN "sourcePublisher" TEXT, ADD COLUMN "sourceRetrievedAt" TIMESTAMP(3), ADD COLUMN "sourceLocation" TEXT;
ALTER TABLE "CapitalProject" ADD COLUMN "sourcePublisher" TEXT, ADD COLUMN "sourceRetrievedAt" TIMESTAMP(3), ADD COLUMN "sourceLocation" TEXT;
ALTER TABLE "Authorisation" ADD COLUMN "sourcePublisher" TEXT, ADD COLUMN "sourceRetrievedAt" TIMESTAMP(3), ADD COLUMN "sourceLocation" TEXT;
ALTER TABLE "CapitalProject" ADD COLUMN "datePrecision" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "Authorisation" ADD COLUMN "datePrecision" TEXT NOT NULL DEFAULT 'unknown';
CREATE TYPE "HoneycombCategory" AS ENUM ('WATER','RIVER','ODOUR','OPERATIONS','AIR','SOIL','WEATHER','NOISE','BIODIVERSITY','OTHER');
CREATE TYPE "ResidentSubmissionStatus" AS ENUM ('PENDING_VERIFICATION','REVIEWED','REJECTED');
CREATE TABLE "ResidentSubmission" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "assetId" TEXT NOT NULL,
 "requestId" TEXT NOT NULL, "category" "HoneycombCategory" NOT NULL,
 "description" TEXT NOT NULL, "observedAt" TIMESTAMP(3) NOT NULL,
 "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "status" "ResidentSubmissionStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
 "visibility" TEXT NOT NULL DEFAULT 'PRIVATE' CHECK ("visibility" = 'PRIVATE'),
 CONSTRAINT "ResidentSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ResidentSubmission_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ResidentSubmission_userId_requestId_key" ON "ResidentSubmission"("userId", "requestId");
CREATE INDEX "ResidentSubmission_userId_receivedAt_idx" ON "ResidentSubmission"("userId", "receivedAt");
CREATE INDEX "ResidentSubmission_status_idx" ON "ResidentSubmission"("status");
