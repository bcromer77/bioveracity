CREATE TABLE "BillingAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "planKey" TEXT,
  "priceId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NONE',
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "currentPeriodEnd" TIMESTAMPTZ(3),
  "lastStripeEventCreated" INTEGER,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingAccount_userId_key" ON "BillingAccount"("userId");
CREATE UNIQUE INDEX "BillingAccount_stripeCustomerId_key" ON "BillingAccount"("stripeCustomerId");
CREATE UNIQUE INDEX "BillingAccount_stripeSubscriptionId_key" ON "BillingAccount"("stripeSubscriptionId");
CREATE INDEX "BillingAccount_status_idx" ON "BillingAccount"("status");
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "created" INTEGER NOT NULL,
  "livemode" BOOLEAN NOT NULL,
  "processedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StripeWebhookEvent_type_processedAt_idx" ON "StripeWebhookEvent"("type","processedAt");
