-- CreateTable
CREATE TABLE "PublicOpportunity" (
    "id" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "evidenceDocumentId" TEXT,
    "verificationState" TEXT NOT NULL DEFAULT 'VERIFIED',
    "currentVersionHash" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "officialId" TEXT,
    "procedureId" TEXT,
    "buyer" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectName" TEXT,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "classification" TEXT NOT NULL,
    "sourceStatus" TEXT NOT NULL,
    "themes" JSONB NOT NULL DEFAULT '[]',
    "measurementNeed" TEXT NOT NULL,
    "publishedValue" TEXT,
    "valueBasis" TEXT,
    "publicationDate" TEXT,
    "eventDate" TEXT,
    "clarificationDeadline" TEXT,
    "tenderDeadline" TEXT,
    "duration" TEXT,
    "supportedClaim" TEXT NOT NULL,
    "supportingPassage" TEXT NOT NULL,
    "accessLimitations" TEXT,
    "sourceReadable" BOOLEAN NOT NULL DEFAULT true,
    "locationType" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "coordSource" TEXT,
    "precision" TEXT,
    "waterbody" TEXT,
    "catchment" TEXT,
    "port" TEXT,
    "protectedSite" TEXT,
    "planningAuthority" TEXT,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "retrievedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicOpportunityVersion" (
    "id" TEXT NOT NULL,
    "publicOpportunityId" TEXT NOT NULL,
    "versionHash" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedFields" JSONB NOT NULL DEFAULT '{}',
    "previousValues" JSONB NOT NULL DEFAULT '{}',
    "detectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicOpportunityVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerMonitoringProfile" (
    "workspaceId" TEXT NOT NULL,
    "territories" JSONB NOT NULL DEFAULT '[]',
    "themes" JSONB NOT NULL DEFAULT '[]',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "immediateClassifications" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastEvidenceRefreshAt" TIMESTAMPTZ(3),
    "lastSourceAccessStatus" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerMonitoringProfile_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "PartnerAuthEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAuthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "publicOpportunityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "classification" TEXT NOT NULL,
    "buyer" TEXT,
    "title" TEXT,
    "projectName" TEXT,
    "country" TEXT,
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
    "sourceName" TEXT,
    "sourceUrl" TEXT,
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
    "workspaceRelevance" TEXT,
    "alertEligible" BOOLEAN NOT NULL DEFAULT false,
    "routedAt" TIMESTAMPTZ(3),
    "lastEvaluatedAt" TIMESTAMPTZ(3),
    "clarificationQuestions" JSONB NOT NULL DEFAULT '[]',
    "seedLabel" TEXT,
    "fetchedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityEvent" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "changedFields" JSONB NOT NULL DEFAULT '{}',
    "previousValues" JSONB NOT NULL DEFAULT '{}',
    "emailedBefore" BOOLEAN NOT NULL DEFAULT false,
    "publicVersionId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "PartnerReport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "evidenceRefreshedAt" TIMESTAMPTZ(3),
    "snapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "pdfBytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicOpportunity_canonicalKey_key" ON "PublicOpportunity"("canonicalKey");

-- CreateIndex
CREATE INDEX "PublicOpportunity_country_region_idx" ON "PublicOpportunity"("country", "region");

-- CreateIndex
CREATE INDEX "PublicOpportunity_classification_sourceStatus_idx" ON "PublicOpportunity"("classification", "sourceStatus");

-- CreateIndex
CREATE INDEX "PublicOpportunity_evidenceDocumentId_idx" ON "PublicOpportunity"("evidenceDocumentId");

-- CreateIndex
CREATE INDEX "PublicOpportunityVersion_publicOpportunityId_detectedAt_idx" ON "PublicOpportunityVersion"("publicOpportunityId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicOpportunityVersion_publicOpportunityId_versionHash_key" ON "PublicOpportunityVersion"("publicOpportunityId", "versionHash");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerTenant_contactEmail_key" ON "PartnerTenant"("contactEmail");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerInvitation_tokenHash_key" ON "PartnerInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "PartnerInvitation_workspaceId_purpose_idx" ON "PartnerInvitation"("workspaceId", "purpose");

-- CreateIndex
CREATE INDEX "PartnerAuthEvent_workspaceId_createdAt_idx" ON "PartnerAuthEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_workspaceId_status_idx" ON "Opportunity"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_workspaceId_publicOpportunityId_key" ON "Opportunity"("workspaceId", "publicOpportunityId");

-- CreateIndex
CREATE INDEX "OpportunityEvent_opportunityId_createdAt_idx" ON "OpportunityEvent"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "OpportunityEvent_publicVersionId_idx" ON "OpportunityEvent"("publicVersionId");

-- CreateIndex
CREATE INDEX "OpportunityAction_workspaceId_opportunityId_idx" ON "OpportunityAction"("workspaceId", "opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityAssessment_workspaceId_createdBy_idx" ON "OpportunityAssessment"("workspaceId", "createdBy");

-- CreateIndex
CREATE INDEX "PartnerEmail_workspaceId_kind_idx" ON "PartnerEmail"("workspaceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerEmail_workspaceId_dedupKey_key" ON "PartnerEmail"("workspaceId", "dedupKey");

-- CreateIndex
CREATE INDEX "PartnerReport_workspaceId_kind_createdAt_idx" ON "PartnerReport"("workspaceId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerReport_workspaceId_kind_version_key" ON "PartnerReport"("workspaceId", "kind", "version");

-- AddForeignKey
ALTER TABLE "PublicOpportunity" ADD CONSTRAINT "PublicOpportunity_evidenceDocumentId_fkey" FOREIGN KEY ("evidenceDocumentId") REFERENCES "EvidenceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicOpportunityVersion" ADD CONSTRAINT "PublicOpportunityVersion_publicOpportunityId_fkey" FOREIGN KEY ("publicOpportunityId") REFERENCES "PublicOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_publicOpportunityId_fkey" FOREIGN KEY ("publicOpportunityId") REFERENCES "PublicOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_publicVersionId_fkey" FOREIGN KEY ("publicVersionId") REFERENCES "PublicOpportunityVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityAction" ADD CONSTRAINT "OpportunityAction_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
