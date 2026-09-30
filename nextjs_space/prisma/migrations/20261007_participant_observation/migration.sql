-- PILOT-001 Natural England demo: private participant observations at a Place.
-- Additive only. A participant observation is its own record type: it is not an
-- Asset, not PlatformEvidence, not a search document and not a timeline event.
-- Machine interpretation and human verification are future, separate records;
-- nothing here can express either, and status is pinned to UNVERIFIED.

-- Observation is enabled per Place, separately from listening. The map centre is a
-- participation viewport for "choose approximately on map"; it is not Place geometry
-- and is never shown on the public Place page.
ALTER TABLE "PlaceParticipation" ADD COLUMN "observationEnabledAt" TIMESTAMPTZ(3);
ALTER TABLE "PlaceParticipation" ADD COLUMN "mapCentreLat" DOUBLE PRECISION;
ALTER TABLE "PlaceParticipation" ADD COLUMN "mapCentreLng" DOUBLE PRECISION;
ALTER TABLE "PlaceParticipation" ADD CONSTRAINT "PlaceParticipation_mapCentre_check"
  CHECK (("mapCentreLat" IS NULL) = ("mapCentreLng" IS NULL)
    AND ("mapCentreLat" IS NULL OR ("mapCentreLat" BETWEEN -90 AND 90 AND "mapCentreLng" BETWEEN -180 AND 180)));

CREATE TABLE "ParticipantObservation" (
  id TEXT PRIMARY KEY,
  -- Owned through the participant's Place-linked history: deleting the history or the
  -- account (User -> ListeningPlot cascade) deletes the observation and its media.
  "plotId" TEXT NOT NULL REFERENCES "ListeningPlot"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "placeId" TEXT NOT NULL REFERENCES "Asset"(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('PHOTO','SOUND','NOTE')),
  category TEXT NOT NULL CHECK (category IN ('ANIMAL','PLANT','WATER','HABITAT','DISTURBANCE','OTHER')),
  "observedAt" TIMESTAMPTZ(3) NOT NULL,
  "observedAtSource" TEXT NOT NULL,
  "observedAtProvenance" TEXT NOT NULL CHECK ("observedAtProvenance" IN ('DEVICE_NOW','PARTICIPANT_CORRECTED')),
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  "participantIdentification" TEXT,
  "participantConfidence" TEXT CHECK ("participantConfidence" IS NULL OR "participantConfidence" IN ('NOT_SURE','FAIRLY_SURE','CERTAIN')),
  "locationMethod" TEXT NOT NULL CHECK ("locationMethod" IN ('DEVICE','MAP_APPROXIMATE','NONE')),
  -- Private, as captured. Never rounded up in precision, never shown publicly.
  "capturedLat" DOUBLE PRECISION,
  "capturedLng" DOUBLE PRECISION,
  "capturedAccuracyM" DOUBLE PRECISION,
  "locationSharing" TEXT NOT NULL CHECK ("locationSharing" IN ('PRIVATE','APPROXIMATE','EXACT')),
  -- Reserved for future sensitive-species/location rules, which may only reduce disclosure.
  "disclosureOverride" TEXT CHECK ("disclosureOverride" IS NULL OR "disclosureOverride" IN ('WITHHOLD','APPROXIMATE_ONLY')),
  status TEXT NOT NULL DEFAULT 'PARTICIPANT_UNVERIFIED' CHECK (status = 'PARTICIPANT_UNVERIFIED'),
  "payloadHash" TEXT NOT NULL,
  -- COALESCE(..., false): a NULL comparison must fail the CHECK, not pass it.
  CONSTRAINT "ParticipantObservation_location_check" CHECK (COALESCE(
    ("locationMethod" = 'NONE' AND "capturedLat" IS NULL AND "capturedLng" IS NULL AND "capturedAccuracyM" IS NULL AND "locationSharing" = 'PRIVATE')
    OR ("locationMethod" = 'DEVICE' AND "capturedLat" BETWEEN -90 AND 90 AND "capturedLng" BETWEEN -180 AND 180 AND "capturedAccuracyM" > 0)
    OR ("locationMethod" = 'MAP_APPROXIMATE' AND "capturedLat" BETWEEN -90 AND 90 AND "capturedLng" BETWEEN -180 AND 180 AND "capturedAccuracyM" IS NULL), false)),
  CONSTRAINT "ParticipantObservation_note_check" CHECK (kind <> 'NOTE' OR note IS NOT NULL)
);
CREATE INDEX "ParticipantObservation_plotId_observedAt_idx" ON "ParticipantObservation"("plotId","observedAt");
CREATE INDEX "ParticipantObservation_placeId_idx" ON "ParticipantObservation"("placeId");

-- DEMO STORAGE: participant media bytes in a separate private table. Not the
-- segregated quarantine/originals/derivatives storage required before any real
-- opening; see the PR description. The original is kept byte-for-byte (sha256);
-- a metadata-stripped display derivative is kept for photos.
CREATE TABLE "ParticipantObservationMedia" (
  "observationId" TEXT PRIMARY KEY REFERENCES "ParticipantObservation"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "mediaType" TEXT NOT NULL CHECK ("mediaType" IN ('PHOTO','SOUND')),
  mime TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL CHECK ("byteLength" > 0),
  sha256 TEXT NOT NULL,
  -- Reported by the participant's device; not measured by BioVeracity.
  "durationMs" INTEGER CHECK ("durationMs" IS NULL OR "durationMs" >= 0),
  original BYTEA NOT NULL,
  "displayMime" TEXT,
  display BYTEA,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
