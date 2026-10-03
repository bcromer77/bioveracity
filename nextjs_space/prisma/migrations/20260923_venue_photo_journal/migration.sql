CREATE TABLE "VenuePhotoSettings" (
 "hubId" TEXT PRIMARY KEY REFERENCES "WildHub"("id") ON DELETE CASCADE,
 "contributionsEnabled" BOOLEAN NOT NULL DEFAULT false,
 "weeklyEnabled" BOOLEAN NOT NULL DEFAULT false,
 "scanCount" INTEGER NOT NULL DEFAULT 0,
 "scanWindow" TIMESTAMPTZ NOT NULL DEFAULT now(),
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE "VenuePhoto" (
 "id" TEXT PRIMARY KEY,
 "hubId" TEXT NOT NULL REFERENCES "WildHub"("id") ON DELETE CASCADE,
 "caption" TEXT NOT NULL,
 "credit" TEXT NOT NULL,
 "location" TEXT NOT NULL,
 "observedOn" TEXT,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 "hash" TEXT NOT NULL,
 "bytes" BYTEA NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'RECEIVED' CHECK ("status" IN ('RECEIVED','REVIEW','PUBLISHED','REJECTED','WITHDRAWN')),
 "revision" INTEGER NOT NULL DEFAULT 1,
 "consentVersion" TEXT NOT NULL,
 "withdrawalHash" TEXT NOT NULL,
 "reason" TEXT NOT NULL DEFAULT '',
 UNIQUE ("hubId", "hash")
);
CREATE INDEX "VenuePhoto_hubId_createdAt_idx" ON "VenuePhoto"("hubId","createdAt");
CREATE INDEX "VenuePhoto_status_createdAt_idx" ON "VenuePhoto"("status","createdAt");
CREATE TABLE "VenuePhotoEvent" (
 "id" TEXT PRIMARY KEY,
 "photoId" TEXT NOT NULL REFERENCES "VenuePhoto"("id") ON DELETE CASCADE,
 "actorId" TEXT,
 "action" TEXT NOT NULL,
 "reason" TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "VenuePhotoEvent_photoId_idx" ON "VenuePhotoEvent"("photoId");
CREATE TABLE "VenuePhotoDigest" (
 "id" TEXT PRIMARY KEY,
 "hubId" TEXT NOT NULL REFERENCES "WildHub"("id") ON DELETE CASCADE,
 "ownerId" TEXT NOT NULL,
 "emailHash" TEXT NOT NULL,
 "weekStart" TIMESTAMPTZ NOT NULL,
 "status" TEXT NOT NULL CHECK ("status" IN ('SENDING','SENT','UNKNOWN')),
 "tokenHash" TEXT NOT NULL,
 "photoIds" JSONB NOT NULL,
 "expiresAt" TIMESTAMPTZ NOT NULL,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 "sentAt" TIMESTAMPTZ,
 UNIQUE ("hubId", "weekStart")
);
