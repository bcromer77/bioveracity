-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "accessState" TEXT NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "region" TEXT NOT NULL,
    "regionSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "statusDetail" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "summary" TEXT,
    "description" TEXT,
    "operatorName" TEXT,
    "regulatorName" TEXT,
    "jurisdiction" TEXT,
    "imageUrl" TEXT,
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "eventType" TEXT NOT NULL,
    "evidenceClass" TEXT NOT NULL,
    "severity" TEXT,
    "changeType" TEXT NOT NULL DEFAULT 'event',
    "sourceUrl" TEXT,
    "sourceDomain" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Divergence" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'The evidence starts to disagree here',
    "date" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "before" TEXT NOT NULL,
    "theChange" TEXT NOT NULL,
    "theDifference" TEXT NOT NULL,
    "whatHappenedNext" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unresolved',
    "sourceUrl" TEXT,
    "sourceDomain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Divergence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Authorisation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "permitRef" TEXT,
    "type" TEXT NOT NULL,
    "grantedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "authority" TEXT,
    "conditions" TEXT,
    "description" TEXT,
    "sourceUrl" TEXT,
    "evidenceClass" TEXT NOT NULL DEFAULT 'R',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Authorisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalProject" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "contractor" TEXT,
    "proofRequired" TEXT,
    "sourceUrl" TEXT,
    "evidenceClass" TEXT NOT NULL DEFAULT 'O',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryActivity" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3),
    "regulator" TEXT,
    "type" TEXT NOT NULL,
    "outcome" TEXT,
    "sourceUrl" TEXT,
    "evidenceClass" TEXT NOT NULL DEFAULT 'R',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "station" TEXT,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "evidenceClass" TEXT NOT NULL DEFAULT 'R',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReport" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3),
    "reportedBy" TEXT,
    "type" TEXT NOT NULL,
    "corroborated" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "evidenceClass" TEXT NOT NULL DEFAULT 'C',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "sourceDomain" TEXT,
    "sourceUrl" TEXT,
    "region" TEXT,
    "category" TEXT,
    "evidenceClass" TEXT NOT NULL DEFAULT 'M',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceGap" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "consequence" TEXT,
    "dataRequired" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "assetId" TEXT NOT NULL,
    "email" TEXT,
    "alertTypes" TEXT NOT NULL DEFAULT 'all',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "assetId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organisation" TEXT,
    "role" TEXT,
    "assetName" TEXT,
    "issue" TEXT NOT NULL,
    "disputed" TEXT,
    "decisionMatters" TEXT,
    "orgsInvolved" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "assetId" TEXT,
    "region" TEXT,
    "askedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'answered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawIngest" (
    "id" TEXT NOT NULL,
    "sourceAgent" TEXT,
    "schemaVersion" TEXT,
    "category" TEXT,
    "targetRegion" TEXT,
    "demoTag" TEXT,
    "stream" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB NOT NULL,
    "analysis" JSONB,
    "payloadFingerprint" TEXT NOT NULL,
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateHits" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'FOUND',
    "error" TEXT,
    "foundAt" TIMESTAMP(3),
    "parsedAt" TIMESTAMP(3),
    "verificationPendingAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "normalisedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawIngest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationCandidate" (
    "id" TEXT NOT NULL,
    "rawIngestId" TEXT NOT NULL,
    "candidateType" TEXT,
    "observationType" TEXT,
    "title" TEXT,
    "description" TEXT,
    "coordinatesProposalLat" DOUBLE PRECISION,
    "coordinatesProposalLng" DOUBLE PRECISION,
    "confidenceProposal" TEXT,
    "metricAssetsInCa" INTEGER,
    "metricWithSpillCount" INTEGER,
    "metricSumSpills" INTEGER,
    "metricSumDurationHoursParsed" DOUBLE PRECISION,
    "reportingYear" INTEGER,
    "geoFilteringMethodology" TEXT,
    "datasetIdentifier" TEXT,
    "jurisdiction" TEXT,
    "sourceUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3),
    "demoTag" TEXT,
    "resolvedAssetId" TEXT,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'UNRESOLVED',
    "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "verificationMethod" TEXT,
    "verificationNote" TEXT,
    "reviewedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "normalisedTargetType" TEXT,
    "normalisedPayload" JSONB,
    "normalisedRecordType" TEXT,
    "normalisedRecordId" TEXT,
    "normalisedAt" TIMESTAMP(3),
    "lifecyclePublishedAt" TIMESTAMP(3),
    "rawObservation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservationCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialSignal" (
    "id" TEXT NOT NULL,
    "rawIngestId" TEXT NOT NULL,
    "possibleBuyer" TEXT,
    "commercialOpportunity" TEXT,
    "sensorOpportunity" TEXT,
    "proofOfEffectOpportunity" TEXT,
    "rawCommercial" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityCandidate" (
    "id" TEXT NOT NULL,
    "rawIngestId" TEXT NOT NULL,
    "proposedType" TEXT,
    "officialIdentifier" TEXT,
    "canonicalName" TEXT,
    "aliases" TEXT,
    "jurisdiction" TEXT,
    "matchedAssetId" TEXT,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'UNRESOLVED',
    "rawProposal" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "publisher" TEXT,
    "title" TEXT,
    "url" TEXT,
    "documentIdentifier" TEXT,
    "documentType" TEXT,
    "publicationDate" TIMESTAMP(3),
    "eventDate" TIMESTAMP(3),
    "retrievalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jurisdiction" TEXT,
    "sourceTier" TEXT,
    "rawIngestId" TEXT,
    "metadata" JSONB,
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetIdentifier" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "identifierType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "sourceUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAlias" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasNormalized" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "sourceUrl" TEXT,
    "verificationState" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "officialIdentifier" TEXT,
    "parentAreaId" TEXT,
    "sourceDocumentId" TEXT,
    "geometry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetArea" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL DEFAULT 'WITHIN',
    "sourceDocumentId" TEXT,
    "verificationState" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetRelation" (
    "id" TEXT NOT NULL,
    "fromAssetId" TEXT NOT NULL,
    "toAssetId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "sourceUrl" TEXT,
    "verificationState" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetCoverage" (
    "id" TEXT NOT NULL,
    "datasetName" TEXT NOT NULL,
    "publisher" TEXT,
    "jurisdiction" TEXT,
    "areaId" TEXT,
    "reportingPeriod" TEXT,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "recordsAvailable" INTEGER,
    "recordsProcessed" INTEGER,
    "recordsNormalised" INTEGER,
    "recordsLinked" INTEGER,
    "recordsUnresolved" INTEGER,
    "methodology" TEXT,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasetCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRecord" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "areaId" TEXT,
    "sourceDocumentId" TEXT,
    "changeType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "materialityState" TEXT NOT NULL DEFAULT 'IMMATERIAL',
    "previousState" JSONB,
    "newState" JSONB,
    "resolutionQuestionId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnresolvedQuestion" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "areaId" TEXT,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "materialityInternal" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnresolvedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionPath" (
    "id" TEXT NOT NULL,
    "unresolvedQuestionId" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priorityInternal" TEXT,
    "estimatedCost" TEXT,
    "estimatedDuration" TEXT,
    "supplierCategory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDENTIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolutionPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "targetType" TEXT NOT NULL,
    "assetId" TEXT,
    "areaId" TEXT,
    "portfolioId" TEXT,
    "email" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_slug_key" ON "Asset"("slug");

-- CreateIndex
CREATE INDEX "Asset_region_idx" ON "Asset"("region");

-- CreateIndex
CREATE INDEX "Asset_type_idx" ON "Asset"("type");

-- CreateIndex
CREATE INDEX "Asset_slug_idx" ON "Asset"("slug");

-- CreateIndex
CREATE INDEX "Event_assetId_idx" ON "Event"("assetId");

-- CreateIndex
CREATE INDEX "Event_date_idx" ON "Event"("date");

-- CreateIndex
CREATE INDEX "Divergence_assetId_idx" ON "Divergence"("assetId");

-- CreateIndex
CREATE INDEX "Divergence_date_idx" ON "Divergence"("date");

-- CreateIndex
CREATE INDEX "Authorisation_assetId_idx" ON "Authorisation"("assetId");

-- CreateIndex
CREATE INDEX "CapitalProject_assetId_idx" ON "CapitalProject"("assetId");

-- CreateIndex
CREATE INDEX "RegulatoryActivity_assetId_idx" ON "RegulatoryActivity"("assetId");

-- CreateIndex
CREATE INDEX "Measurement_assetId_idx" ON "Measurement"("assetId");

-- CreateIndex
CREATE INDEX "Measurement_date_idx" ON "Measurement"("date");

-- CreateIndex
CREATE INDEX "CommunityReport_assetId_idx" ON "CommunityReport"("assetId");

-- CreateIndex
CREATE INDEX "NewsItem_assetId_idx" ON "NewsItem"("assetId");

-- CreateIndex
CREATE INDEX "NewsItem_date_idx" ON "NewsItem"("date");

-- CreateIndex
CREATE INDEX "EvidenceGap_assetId_idx" ON "EvidenceGap"("assetId");

-- CreateIndex
CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");

-- CreateIndex
CREATE INDEX "Watchlist_assetId_idx" ON "Watchlist"("assetId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Question_createdAt_idx" ON "Question"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RawIngest_payloadFingerprint_key" ON "RawIngest"("payloadFingerprint");

-- CreateIndex
CREATE INDEX "RawIngest_status_idx" ON "RawIngest"("status");

-- CreateIndex
CREATE INDEX "RawIngest_demoTag_idx" ON "RawIngest"("demoTag");

-- CreateIndex
CREATE INDEX "RawIngest_targetRegion_idx" ON "RawIngest"("targetRegion");

-- CreateIndex
CREATE INDEX "RawIngest_receivedAt_idx" ON "RawIngest"("receivedAt");

-- CreateIndex
CREATE INDEX "ObservationCandidate_rawIngestId_idx" ON "ObservationCandidate"("rawIngestId");

-- CreateIndex
CREATE INDEX "ObservationCandidate_candidateType_idx" ON "ObservationCandidate"("candidateType");

-- CreateIndex
CREATE INDEX "ObservationCandidate_resolutionStatus_idx" ON "ObservationCandidate"("resolutionStatus");

-- CreateIndex
CREATE INDEX "ObservationCandidate_status_idx" ON "ObservationCandidate"("status");

-- CreateIndex
CREATE INDEX "CommercialSignal_rawIngestId_idx" ON "CommercialSignal"("rawIngestId");

-- CreateIndex
CREATE INDEX "EntityCandidate_rawIngestId_idx" ON "EntityCandidate"("rawIngestId");

-- CreateIndex
CREATE INDEX "EntityCandidate_resolutionStatus_idx" ON "EntityCandidate"("resolutionStatus");

-- CreateIndex
CREATE INDEX "SourceDocument_publisher_idx" ON "SourceDocument"("publisher");

-- CreateIndex
CREATE INDEX "SourceDocument_documentIdentifier_idx" ON "SourceDocument"("documentIdentifier");

-- CreateIndex
CREATE INDEX "SourceDocument_rawIngestId_idx" ON "SourceDocument"("rawIngestId");

-- CreateIndex
CREATE INDEX "SourceDocument_contentHash_idx" ON "SourceDocument"("contentHash");

-- CreateIndex
CREATE INDEX "AssetIdentifier_assetId_idx" ON "AssetIdentifier"("assetId");

-- CreateIndex
CREATE INDEX "AssetIdentifier_value_idx" ON "AssetIdentifier"("value");

-- CreateIndex
CREATE UNIQUE INDEX "AssetIdentifier_authority_identifierType_value_key" ON "AssetIdentifier"("authority", "identifierType", "value");

-- CreateIndex
CREATE INDEX "AssetAlias_aliasNormalized_idx" ON "AssetAlias"("aliasNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "AssetAlias_assetId_aliasNormalized_key" ON "AssetAlias"("assetId", "aliasNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Area_slug_key" ON "Area"("slug");

-- CreateIndex
CREATE INDEX "Area_type_idx" ON "Area"("type");

-- CreateIndex
CREATE INDEX "Area_parentAreaId_idx" ON "Area"("parentAreaId");

-- CreateIndex
CREATE INDEX "AssetArea_assetId_idx" ON "AssetArea"("assetId");

-- CreateIndex
CREATE INDEX "AssetArea_areaId_idx" ON "AssetArea"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetArea_assetId_areaId_relationshipType_key" ON "AssetArea"("assetId", "areaId", "relationshipType");

-- CreateIndex
CREATE INDEX "AssetRelation_fromAssetId_relationshipType_idx" ON "AssetRelation"("fromAssetId", "relationshipType");

-- CreateIndex
CREATE INDEX "AssetRelation_toAssetId_relationshipType_idx" ON "AssetRelation"("toAssetId", "relationshipType");

-- CreateIndex
CREATE INDEX "DatasetCoverage_status_idx" ON "DatasetCoverage"("status");

-- CreateIndex
CREATE INDEX "DatasetCoverage_areaId_idx" ON "DatasetCoverage"("areaId");

-- CreateIndex
CREATE INDEX "ChangeRecord_assetId_idx" ON "ChangeRecord"("assetId");

-- CreateIndex
CREATE INDEX "ChangeRecord_areaId_idx" ON "ChangeRecord"("areaId");

-- CreateIndex
CREATE INDEX "ChangeRecord_changeType_idx" ON "ChangeRecord"("changeType");

-- CreateIndex
CREATE INDEX "ChangeRecord_published_idx" ON "ChangeRecord"("published");

-- CreateIndex
CREATE INDEX "UnresolvedQuestion_assetId_idx" ON "UnresolvedQuestion"("assetId");

-- CreateIndex
CREATE INDEX "UnresolvedQuestion_areaId_idx" ON "UnresolvedQuestion"("areaId");

-- CreateIndex
CREATE INDEX "UnresolvedQuestion_status_idx" ON "UnresolvedQuestion"("status");

-- CreateIndex
CREATE INDEX "ResolutionPath_unresolvedQuestionId_idx" ON "ResolutionPath"("unresolvedQuestionId");

-- CreateIndex
CREATE INDEX "Watch_userId_idx" ON "Watch"("userId");

-- CreateIndex
CREATE INDEX "Watch_assetId_idx" ON "Watch"("assetId");

-- CreateIndex
CREATE INDEX "Watch_areaId_idx" ON "Watch"("areaId");

-- CreateIndex
CREATE INDEX "Watch_targetType_idx" ON "Watch"("targetType");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Divergence" ADD CONSTRAINT "Divergence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authorisation" ADD CONSTRAINT "Authorisation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalProject" ADD CONSTRAINT "CapitalProject_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryActivity" ADD CONSTRAINT "RegulatoryActivity_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsItem" ADD CONSTRAINT "NewsItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceGap" ADD CONSTRAINT "EvidenceGap_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationCandidate" ADD CONSTRAINT "ObservationCandidate_rawIngestId_fkey" FOREIGN KEY ("rawIngestId") REFERENCES "RawIngest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialSignal" ADD CONSTRAINT "CommercialSignal_rawIngestId_fkey" FOREIGN KEY ("rawIngestId") REFERENCES "RawIngest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityCandidate" ADD CONSTRAINT "EntityCandidate_rawIngestId_fkey" FOREIGN KEY ("rawIngestId") REFERENCES "RawIngest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetIdentifier" ADD CONSTRAINT "AssetIdentifier_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAlias" ADD CONSTRAINT "AssetAlias_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_parentAreaId_fkey" FOREIGN KEY ("parentAreaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetArea" ADD CONSTRAINT "AssetArea_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetArea" ADD CONSTRAINT "AssetArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRelation" ADD CONSTRAINT "AssetRelation_fromAssetId_fkey" FOREIGN KEY ("fromAssetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRelation" ADD CONSTRAINT "AssetRelation_toAssetId_fkey" FOREIGN KEY ("toAssetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetCoverage" ADD CONSTRAINT "DatasetCoverage_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRecord" ADD CONSTRAINT "ChangeRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRecord" ADD CONSTRAINT "ChangeRecord_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnresolvedQuestion" ADD CONSTRAINT "UnresolvedQuestion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnresolvedQuestion" ADD CONSTRAINT "UnresolvedQuestion_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionPath" ADD CONSTRAINT "ResolutionPath_unresolvedQuestionId_fkey" FOREIGN KEY ("unresolvedQuestionId") REFERENCES "UnresolvedQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

