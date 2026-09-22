-- Additive application-database migration. Reconcile historical migrations first.
CREATE TABLE "ClubSubscription" (
 "id" TEXT PRIMARY KEY, "hubId" TEXT NOT NULL UNIQUE REFERENCES "WildHub"("id") ON DELETE RESTRICT,
 "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "mode" TEXT NOT NULL CHECK ("mode" IN ('sandbox','live')), "planId" TEXT NOT NULL, "variationId" TEXT NOT NULL,
 "termsVersion" TEXT NOT NULL, "taxLabel" TEXT NOT NULL,
 "amount" INTEGER NOT NULL DEFAULT 8000 CHECK ("amount"=8000), "currency" TEXT NOT NULL DEFAULT 'EUR' CHECK ("currency"='EUR'),
 "customerId" TEXT, "subscriptionId" TEXT UNIQUE, "setupOrderId" TEXT,
 "state" TEXT NOT NULL DEFAULT 'CREATING', "providerUpdatedAt" TIMESTAMPTZ,
 "paidUntil" TIMESTAMPTZ, "paymentState" TEXT NOT NULL DEFAULT 'unknown',
 "revision" INTEGER NOT NULL DEFAULT 1, "checkedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE "RevolutReceipt" (
 "hash" TEXT PRIMARY KEY, "subscriptionId" TEXT NOT NULL, "event" TEXT NOT NULL,
 "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "processedAt" TIMESTAMPTZ
);
CREATE INDEX "RevolutReceipt_pending" ON "RevolutReceipt"("processedAt", "receivedAt");
CREATE TABLE "ClubWatch" (
 "hubId" TEXT PRIMARY KEY REFERENCES "WildHub"("id") ON DELETE CASCADE,
 "config" JSONB NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
 "enabled" BOOLEAN NOT NULL DEFAULT false, "configuredBy" TEXT NOT NULL REFERENCES "User"("id"),
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE "ClubSourceRecord" (
 "id" TEXT PRIMARY KEY, "hubId" TEXT NOT NULL REFERENCES "ClubWatch"("hubId") ON DELETE CASCADE,
 "configVersion" INTEGER NOT NULL, "source" TEXT NOT NULL CHECK ("source" IN ('planning','epa')),
 "sourceKey" TEXT NOT NULL, "hash" TEXT NOT NULL, "content" JSONB NOT NULL,
 "current" BOOLEAN NOT NULL DEFAULT true, "review" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("review" IN ('PENDING','APPROVED','REJECTED')),
 "reviewedBy" TEXT REFERENCES "User"("id"), "reviewNote" TEXT, "reviewedAt" TIMESTAMPTZ,
 "firstSeenAt" TIMESTAMPTZ NOT NULL, "lastSeenAt" TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX "ClubSourceRecord_current" ON "ClubSourceRecord"("hubId","configVersion","source","sourceKey") WHERE "current";
CREATE INDEX "ClubSourceRecord_review" ON "ClubSourceRecord"("hubId","review","current");
CREATE TABLE "ClubSourceRun" (
 "id" TEXT PRIMARY KEY, "hubId" TEXT NOT NULL REFERENCES "ClubWatch"("hubId") ON DELETE CASCADE,
 "configVersion" INTEGER NOT NULL, "source" TEXT NOT NULL, "status" TEXT NOT NULL,
 "count" INTEGER NOT NULL DEFAULT 0, "note" TEXT NOT NULL, "checkedAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "ClubSourceRun_latest" ON "ClubSourceRun"("hubId","checkedAt");
