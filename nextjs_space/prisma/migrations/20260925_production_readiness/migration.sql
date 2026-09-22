CREATE TABLE "IdentityChallenge" (
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK (purpose IN ('VERIFY_EMAIL','ADMIN_LOGIN')),
 "tokenHash" TEXT NOT NULL UNIQUE, email TEXT NOT NULL, "authVersion" INTEGER NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "IdentityChallenge_userId_idx" ON "IdentityChallenge"("userId");
CREATE INDEX "IdentityChallenge_expiresAt_idx" ON "IdentityChallenge"("expiresAt");
CREATE TABLE "OperationalDelivery" (
 key TEXT PRIMARY KEY, status TEXT NOT NULL CHECK (status IN ('SENDING','SENT','UNKNOWN')),
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3)
);
CREATE TABLE "JobHeartbeat" (
 name TEXT PRIMARY KEY, status TEXT NOT NULL CHECK (status IN ('RUNNING','SUCCEEDED','FAILED')),
 "startedAt" TIMESTAMP(3) NOT NULL, "finishedAt" TIMESTAMP(3)
);
