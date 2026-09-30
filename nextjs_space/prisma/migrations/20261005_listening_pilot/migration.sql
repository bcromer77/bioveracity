-- Additive application-database migration. Controlled isolated QA first.
CREATE TABLE "ListeningPlot" (
  id TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name TEXT NOT NULL,
  county TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ListeningPlot_ownerId_idx" ON "ListeningPlot"("ownerId");
CREATE TABLE "ListeningVisit" (
  id TEXT PRIMARY KEY,
  "plotId" TEXT NOT NULL REFERENCES "ListeningPlot"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "observedAt" TIMESTAMPTZ(3) NOT NULL,
  payload JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ListeningVisit_plotId_observedAt_idx" ON "ListeningVisit"("plotId","observedAt");
