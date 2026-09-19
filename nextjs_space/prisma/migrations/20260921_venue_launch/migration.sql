-- Additive managed venue intake. No accounts, invitations or hubs are seeded.

CREATE TABLE "WildVenueSetup" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "acceptedBy" TEXT,
    "hubId" TEXT,
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "acceptedAt" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WildVenueSetup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WildVenueSetupEvent" (
    "id" TEXT NOT NULL,
    "setupId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WildVenueSetupEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WildVenueSetup_reference_key" ON "WildVenueSetup"("reference");

CREATE UNIQUE INDEX "WildVenueSetup_hubId_key" ON "WildVenueSetup"("hubId");

CREATE UNIQUE INDEX "WildVenueSetup_tokenHash_key" ON "WildVenueSetup"("tokenHash");

CREATE INDEX "WildVenueSetup_createdAt_idx" ON "WildVenueSetup"("createdAt");

CREATE INDEX "WildVenueSetupEvent_setupId_createdAt_idx" ON "WildVenueSetupEvent"("setupId", "createdAt");

ALTER TABLE "WildVenueSetup" ADD CONSTRAINT "WildVenueSetup_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WildVenueSetup" ADD CONSTRAINT "WildVenueSetup_acceptedBy_fkey" FOREIGN KEY ("acceptedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WildVenueSetup" ADD CONSTRAINT "WildVenueSetup_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "WildHub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WildVenueSetupEvent" ADD CONSTRAINT "WildVenueSetupEvent_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "WildVenueSetup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WildVenueSetupEvent" ADD CONSTRAINT "WildVenueSetupEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
