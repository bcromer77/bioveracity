-- Ellona Environmental Opportunity Watch — ADDITIVE ONLY (new tables).
CREATE TABLE "PartnerTenant" (
  "workspaceId" TEXT NOT NULL,
  "orgName" TEXT NOT NULL,
  "workspaceName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "partnerRole" TEXT NOT NULL DEFAULT 'partner_member',
  "originatorName" TEXT NOT NULL,
  "originatorOrg" TEXT NOT NULL,
  "deliveryProduct" TEXT NOT NULL DEFAULT 'BioVeracity',
  "territories" TEXT NOT NULL DEFAULT '',
  "trialDays" INTEGER NOT NULL DEFAULT 14,
  "trialState" TEXT NOT NULL DEFAULT 'INVITED_NOT_ACTIVATED',
  "activatedAt" TIMESTAMPTZ(3),
  "firstLoginAt" TIMESTAMPTZ(3),
  "lastLoginAt" TIMESTAMPTZ(3),
  "trialStartedAt" TIMESTAMPTZ(3),
  "trialEndsAt" TIMESTAMPTZ(3),
  "alertsPaused" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerTenant_pkey" PRIMARY KEY ("workspaceId")
);
CREATE UNIQUE INDEX "PartnerTenant_contactEmail_key" ON "PartnerTenant"("contactEmail");

CREATE TABLE "PartnerInvitation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerInvitation_tokenHash_key" ON "PartnerInvitation"("tokenHash");
CREATE INDEX "PartnerInvitation_workspaceId_purpose_idx" ON "PartnerInvitation"("workspaceId","purpose");

CREATE TABLE "PartnerAuthEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "detail" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerAuthEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerAuthEvent_workspaceId_createdAt_idx" ON "PartnerAuthEvent"("workspaceId","createdAt");

CREATE TABLE "Opportunity" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "classification" TEXT NOT NULL,
  "buyer" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "projectName" TEXT,
  "country" TEXT NOT NULL,
  "region" TEXT,
  "themes" JSONB NOT NULL DEFAULT '[]',
  "capabilities" JSONB NOT NULL DEFAULT '[]',
  "measurementNeed" TEXT,
  "publishedValue" TEXT,
  "valueBasis" TEXT,
  "publicationDate" TEXT,
  "clarificationDeadline" TEXT,
  "tenderDeadline" TEXT,
  "duration" TEXT,
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "officialId" TEXT,
  "procedureId" TEXT,
  "provenance" JSONB NOT NULL DEFAULT '{}',
  "locationType" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "coordSource" TEXT,
  "precision" TEXT,
  "geocodeDate" TEXT,
  "geocodeMethod" TEXT,
  "waterbody" TEXT,
  "catchment" TEXT,
  "port" TEXT,
  "protectedSite" TEXT,
  "planningAuthority" TEXT,
  "nextAction" TEXT,
  "clarificationQuestions" JSONB NOT NULL DEFAULT '[]',
  "seedLabel" TEXT,
  "fetchedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Opportunity_workspaceId_status_idx" ON "Opportunity"("workspaceId","status");

CREATE TABLE "OpportunityEvent" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "changedFields" JSONB NOT NULL DEFAULT '{}',
  "previousValues" JSONB NOT NULL DEFAULT '{}',
  "emailedBefore" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OpportunityEvent_opportunityId_createdAt_idx" ON "OpportunityEvent"("opportunityId","createdAt");
ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OpportunityAction" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "detail" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OpportunityAction_workspaceId_opportunityId_idx" ON "OpportunityAction"("workspaceId","opportunityId");
ALTER TABLE "OpportunityAction" ADD CONSTRAINT "OpportunityAction_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OpportunityAssessment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "decisionType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'EXTRACTED',
  "documentName" TEXT NOT NULL,
  "documentHash" TEXT NOT NULL,
  "encryptedBytes" BYTEA NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "mediaType" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "extraction" JSONB NOT NULL DEFAULT '{}',
  "corrections" JSONB NOT NULL DEFAULT '{}',
  "comments" JSONB NOT NULL DEFAULT '[]',
  "reviewedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityAssessment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OpportunityAssessment_workspaceId_createdBy_idx" ON "OpportunityAssessment"("workspaceId","createdBy");

CREATE TABLE "PartnerEmail" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "senderIdentity" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "renderedHtml" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RENDERED',
  "dedupKey" TEXT,
  "sandbox" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerEmail_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerEmail_workspaceId_kind_idx" ON "PartnerEmail"("workspaceId","kind");
CREATE UNIQUE INDEX "PartnerEmail_workspaceId_dedupKey_key" ON "PartnerEmail"("workspaceId","dedupKey");
