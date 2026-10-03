CREATE TABLE "TermsAcceptance" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "termsVersion" TEXT NOT NULL,
  "privacyVersion" TEXT NOT NULL,
  wording TEXT NOT NULL,
  channel TEXT NOT NULL,
  "termsText" TEXT NOT NULL,
  "privacyText" TEXT NOT NULL,
  "acceptedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("userId", "termsVersion", "privacyVersion")
);
CREATE TABLE "DataRightsRequest" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('ACCESS','ERASURE','RECTIFICATION','RESTRICTION','OBJECTION','PORTABILITY')),
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','IN_REVIEW','COMPLETED','PARTIALLY_COMPLETED','REFUSED')),
  response TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "dueAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "DataRightsRequest_user" ON "DataRightsRequest" ("userId", "createdAt");
CREATE INDEX "DataRightsRequest_queue" ON "DataRightsRequest" (status, "dueAt");
CREATE UNIQUE INDEX "DataRightsRequest_open" ON "DataRightsRequest" ("userId", kind) WHERE status IN ('RECEIVED','IN_REVIEW');
CREATE TABLE "DataRightsEvent" (
  id TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "DataRightsRequest"(id) ON DELETE CASCADE,
  "actorId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  response TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Separate private contact/release record: never join to public photo queries.
CREATE TABLE "VenuePhotoRelease" (
 "photoId" TEXT PRIMARY KEY,
 "journalPhotoId" TEXT UNIQUE REFERENCES "VenuePhoto"(id) ON DELETE CASCADE,
 "galleryPhotoId" TEXT UNIQUE REFERENCES "WildHubPhoto"(id) ON DELETE CASCADE,
 CHECK (("journalPhotoId" = "photoId" AND "galleryPhotoId" IS NULL) OR ("galleryPhotoId" = "photoId" AND "journalPhotoId" IS NULL)),
 CHECK ("journalPhotoId" IS NOT NULL OR "galleryPhotoId" IS NOT NULL),
 "contactName" TEXT NOT NULL,
 "contactEmail" TEXT NOT NULL,
 "venueName" TEXT NOT NULL,
 version TEXT NOT NULL,
 wording TEXT NOT NULL,
 "venuePublications" BOOLEAN NOT NULL DEFAULT false,
 "bioPublications" BOOLEAN NOT NULL DEFAULT false,
 "acceptedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 "withdrawnAt" TIMESTAMPTZ,
 "contactVerifiedAt" TIMESTAMPTZ,
 "verifiedBy" TEXT,
 "verificationNote" TEXT NOT NULL DEFAULT ''
);
