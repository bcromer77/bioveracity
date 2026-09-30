-- PILOT-001: link private listening histories to an immutable Place ID and add
-- DB-backed, Place-level participation enablement. Additive only: existing
-- standalone ListeningPlot rows keep their county and get placeId NULL.
ALTER TABLE "ListeningPlot" ADD COLUMN "placeId" TEXT;
ALTER TABLE "ListeningPlot" ALTER COLUMN county DROP NOT NULL;
ALTER TABLE "ListeningPlot" ADD CONSTRAINT "ListeningPlot_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Asset"(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
-- A plot is either standalone (county) or Place-linked (placeId); never neither.
ALTER TABLE "ListeningPlot" ADD CONSTRAINT "ListeningPlot_scope_check"
  CHECK ("placeId" IS NOT NULL OR county IS NOT NULL);
-- One private history per owner per Place (NULLs stay distinct: standalone plots unaffected).
CREATE UNIQUE INDEX "ListeningPlot_ownerId_placeId_key" ON "ListeningPlot"("ownerId","placeId");
CREATE INDEX "ListeningPlot_placeId_idx" ON "ListeningPlot"("placeId");

CREATE TABLE "PlaceParticipation" (
  "placeId" TEXT PRIMARY KEY,
  "listeningEnabledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceParticipation_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Asset"(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
