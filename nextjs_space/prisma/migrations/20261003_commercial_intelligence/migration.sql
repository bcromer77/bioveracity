-- Commercial Property Intelligence. Additive only.
-- Does not alter public Asset rows, ingestion tables, or issued private-case exports.
-- Rollback: DROP the tables below in reverse order. No production data is copied here.

CREATE TABLE "CommercialPortfolio" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommercialPortfolio_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommercialPortfolio_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PrivateWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommercialPortfolio_workspace_id_key" ON "CommercialPortfolio"("workspaceId", "id");
CREATE INDEX "CommercialPortfolio_workspace_idx" ON "CommercialPortfolio"("workspaceId");

CREATE TABLE "CommercialAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "eircode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "assetType" TEXT NOT NULL,
    "ownershipStatus" TEXT,
    "localAuthority" TEXT,
    "county" TEXT,
    "geography" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommercialAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommercialAsset_portfolio_fkey" FOREIGN KEY ("workspaceId", "portfolioId") REFERENCES "CommercialPortfolio"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CommercialAsset_portfolio_idx" ON "CommercialAsset"("workspaceId", "portfolioId");

CREATE TABLE "CommercialPortfolioGrant" (
    "workspaceId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    CONSTRAINT "CommercialPortfolioGrant_pkey" PRIMARY KEY ("workspaceId", "portfolioId", "userId"),
    CONSTRAINT "CommercialPortfolioGrant_member_fkey" FOREIGN KEY ("workspaceId", "userId") REFERENCES "PrivateWorkspaceMember"("workspaceId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommercialPortfolioGrant_portfolio_fkey" FOREIGN KEY ("workspaceId", "portfolioId") REFERENCES "CommercialPortfolio"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CommercialPortfolioGrant_user_idx" ON "CommercialPortfolioGrant"("userId", "revokedAt");

CREATE TABLE "CommercialSignalEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "registrySignalId" TEXT NOT NULL,
    "sourceAuthority" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "underlyingMatterId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "factualObservation" TEXT NOT NULL,
    "observedValue" TEXT,
    "unit" TEXT,
    "previousValue" TEXT,
    "eventDate" DATE,
    "publicationDate" DATE,
    "retrievalDate" DATE NOT NULL,
    "spatialResolution" TEXT NOT NULL,
    "geographicIdentifier" TEXT,
    "lifecycleStage" TEXT,
    "previousLifecycleStage" TEXT,
    "evidenceStatus" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommercialSignalEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommercialSignalEvent_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PrivateWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommercialSignalEvent_hash_key" ON "CommercialSignalEvent"("workspaceId", "contentHash");
CREATE INDEX "CommercialSignalEvent_signal_idx" ON "CommercialSignalEvent"("workspaceId", "registrySignalId");

CREATE TABLE "CommercialAssetSignal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "signalEventId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "distanceMetres" DOUBLE PRECISION,
    "relevanceReason" TEXT NOT NULL,
    "relevanceRuleId" TEXT NOT NULL,
    "dependencyStatus" TEXT NOT NULL,
    "spatialBand" TEXT NOT NULL,
    CONSTRAINT "CommercialAssetSignal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommercialAssetSignal_asset_fkey" FOREIGN KEY ("assetId") REFERENCES "CommercialAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommercialAssetSignal_event_fkey" FOREIGN KEY ("signalEventId") REFERENCES "CommercialSignalEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommercialAssetSignal_edge_key" ON "CommercialAssetSignal"("workspaceId", "assetId", "signalEventId", "relationshipType");
CREATE INDEX "CommercialAssetSignal_asset_idx" ON "CommercialAssetSignal"("workspaceId", "assetId");

CREATE TABLE "CommercialChange" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assetId" TEXT,
    "signalEventId" TEXT,
    "changeType" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "detectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommercialChange_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommercialChange_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PrivateWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CommercialChange_asset_idx" ON "CommercialChange"("workspaceId", "assetId", "detectedAt");

CREATE TABLE "CommercialReview" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assetSignalId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "assigneeId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommercialReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommercialReview_signal_fkey" FOREIGN KEY ("assetSignalId") REFERENCES "CommercialAssetSignal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommercialReview_actor_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CommercialReview_signal_idx" ON "CommercialReview"("workspaceId", "assetSignalId", "createdAt");

CREATE TABLE "CommercialReport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "pdfBytes" BYTEA,
    "xlsxBytes" BYTEA,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt" TIMESTAMPTZ(3),
    CONSTRAINT "CommercialReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommercialReport_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PrivateWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommercialReport_author_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CommercialReport_workspace_idx" ON "CommercialReport"("workspaceId", "status");

CREATE TABLE "CommercialSourceCheck" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "registrySignalId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "checkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommercialSourceCheck_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommercialSourceCheck_workspace_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PrivateWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CommercialSourceCheck_signal_idx" ON "CommercialSourceCheck"("workspaceId", "registrySignalId", "checkedAt");

ALTER TABLE "CommercialPortfolioGrant" ADD CONSTRAINT "commercial_grant_role" CHECK (role IN ('OWNER','EDITOR','COMMENTER','VIEWER'));
ALTER TABLE "CommercialSourceCheck" ADD CONSTRAINT "commercial_check_state" CHECK (state IN ('NO_CHANGE','NO_RECORD_FOUND','SOURCE_UNAVAILABLE','CHECK_FAILED','NOT_CHECKED','UNKNOWN','RECORD_LOCATED'));
ALTER TABLE "CommercialReport" ADD CONSTRAINT "commercial_report_status" CHECK (status IN ('DRAFT','ISSUED'));
