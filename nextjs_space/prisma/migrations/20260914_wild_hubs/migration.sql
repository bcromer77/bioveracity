CREATE TABLE "WildHub" (
 "id" TEXT PRIMARY KEY,
 "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "profile" JSONB NOT NULL,
 "plan" JSONB,
 "trend" JSONB,
 "published" JSONB,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "scanCount" INTEGER NOT NULL DEFAULT 0,
 "scanWindow" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WildHub_ownerId_idx" ON "WildHub"("ownerId");
CREATE TABLE "WildHubPhoto" (
 "id" TEXT PRIMARY KEY,
 "hubId" TEXT NOT NULL REFERENCES "WildHub"("id") ON DELETE CASCADE,
 "caption" TEXT NOT NULL,
 "credit" TEXT NOT NULL,
 "hash" TEXT NOT NULL,
 "bytes" BYTEA NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WildHubPhoto_hubId_hash_key" UNIQUE("hubId","hash")
);
CREATE INDEX "WildHubPhoto_hubId_idx" ON "WildHubPhoto"("hubId");
CREATE TABLE "WildHubPublication" (
 "id" TEXT PRIMARY KEY,
 "hubId" TEXT NOT NULL REFERENCES "WildHub"("id") ON DELETE CASCADE,
 "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "action" TEXT NOT NULL CHECK ("action" IN ('PUBLISH','UNPUBLISH')),
 "snapshot" JSONB,
 "hash" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WildHubPublication_hubId_idx" ON "WildHubPublication"("hubId");
