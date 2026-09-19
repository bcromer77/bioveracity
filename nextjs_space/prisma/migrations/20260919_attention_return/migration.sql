CREATE TABLE "AttentionPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "actionEmail" BOOLEAN NOT NULL DEFAULT true,
  "importantChangeEmail" BOOLEAN NOT NULL DEFAULT true,
  "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
  "routineEmail" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" INTEGER,
  "quietHoursEnd" INTEGER,
  "timezone" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttentionPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttentionPreference_userId_scopeKey_key" ON "AttentionPreference"("userId","scopeKey");
CREATE INDEX "AttentionPreference_userId_idx" ON "AttentionPreference"("userId");
ALTER TABLE "AttentionPreference" ADD CONSTRAINT "AttentionPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AttentionEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "workspaceId" TEXT,
  "caseId" TEXT,
  "category" TEXT NOT NULL,
  "significance" TEXT NOT NULL,
  "requiresAction" BOOLEAN NOT NULL DEFAULT false,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "actionPath" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "AttentionEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttentionEvent_userId_dedupeKey_key" ON "AttentionEvent"("userId","dedupeKey");
CREATE INDEX "AttentionEvent_userId_occurredAt_idx" ON "AttentionEvent"("userId","occurredAt");
CREATE INDEX "AttentionEvent_scopeKey_occurredAt_idx" ON "AttentionEvent"("scopeKey","occurredAt");
ALTER TABLE "AttentionEvent" ADD CONSTRAINT "AttentionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "attentionEventId" TEXT,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "bundleKey" TEXT,
  "subject" TEXT NOT NULL,
  "actionPath" TEXT NOT NULL,
  "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
  "sentAt" TIMESTAMPTZ(3),
  "openedAt" TIMESTAMPTZ(3),
  "usefulReturnAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NotificationDelivery_userId_scheduledAt_idx" ON "NotificationDelivery"("userId","scheduledAt");
CREATE INDEX "NotificationDelivery_status_scheduledAt_idx" ON "NotificationDelivery"("status","scheduledAt");
CREATE INDEX "NotificationDelivery_bundleKey_scheduledAt_idx" ON "NotificationDelivery"("bundleKey","scheduledAt");
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_attentionEventId_fkey" FOREIGN KEY ("attentionEventId") REFERENCES "AttentionEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
