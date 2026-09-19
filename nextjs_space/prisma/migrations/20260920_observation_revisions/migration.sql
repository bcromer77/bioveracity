-- Additive observation foundation and immutable content snapshots.
-- No backfill, polling, data deletion or production activation.
-- If observation tables were created outside migration history, reconcile the
-- schema and migration baseline explicitly before applying; do not drop them.

CREATE TABLE "ObservationEventRecord" (
    "id" TEXT NOT NULL,
    "canonicalEventId" TEXT NOT NULL,
    "assetId" TEXT,
    "method" TEXT NOT NULL,
    "observedAt" TEXT,
    "observedPrecision" TEXT NOT NULL,
    "observedBasis" TEXT NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "placeLabel" TEXT,
    "geometry" JSONB,
    "crs" TEXT,
    "spatialUncertaintyMeters" DOUBLE PRECISION,
    "placeScopeNote" TEXT,
    "effort" JSONB,
    "coverageState" TEXT NOT NULL,
    "coverageNote" TEXT NOT NULL,
    "lineage" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservationEventRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ObservationFindingRecord" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "target" TEXT,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "ordinalValue" TEXT,
    "rawStatement" TEXT,
    "reviewStatus" TEXT NOT NULL,
    "evidenceClass" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservationFindingRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ObservationSourceRecord" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "publisher" TEXT,
    "datasetIdentifier" TEXT,
    "upstreamRecordId" TEXT,
    "upstreamEventId" TEXT,
    "sourceUrl" TEXT,
    "licence" TEXT,
    "retrievedAt" TIMESTAMPTZ(3) NOT NULL,
    "versionHash" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservationSourceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ObservationRevisionRecord" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservationRevisionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceCheckRecord" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "question" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "sourceVersions" JSONB NOT NULL,
    "method" JSONB NOT NULL,
    "resultStatus" TEXT NOT NULL,
    "resultSummary" TEXT,
    "coverage" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceCheckRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ObservationEventRecord_canonicalEventId_key" ON "ObservationEventRecord"("canonicalEventId");

CREATE INDEX "ObservationEventRecord_assetId_receivedAt_idx" ON "ObservationEventRecord"("assetId", "receivedAt");

CREATE INDEX "ObservationEventRecord_coverageState_idx" ON "ObservationEventRecord"("coverageState");

CREATE INDEX "ObservationFindingRecord_eventId_idx" ON "ObservationFindingRecord"("eventId");

CREATE INDEX "ObservationFindingRecord_target_state_idx" ON "ObservationFindingRecord"("target", "state");

CREATE INDEX "ObservationSourceRecord_eventId_idx" ON "ObservationSourceRecord"("eventId");

CREATE INDEX "ObservationSourceRecord_sourceSystem_upstreamRecordId_idx" ON "ObservationSourceRecord"("sourceSystem", "upstreamRecordId");

CREATE INDEX "ObservationSourceRecord_upstreamEventId_idx" ON "ObservationSourceRecord"("upstreamEventId");

CREATE UNIQUE INDEX "ObservationRevisionRecord_sourceId_key" ON "ObservationRevisionRecord"("sourceId");

CREATE INDEX "ObservationRevisionRecord_eventId_receivedAt_idx" ON "ObservationRevisionRecord"("eventId", "receivedAt");

CREATE INDEX "EvidenceCheckRecord_assetId_createdAt_idx" ON "EvidenceCheckRecord"("assetId", "createdAt");

CREATE INDEX "EvidenceCheckRecord_resultStatus_idx" ON "EvidenceCheckRecord"("resultStatus");

ALTER TABLE "ObservationEventRecord" ADD CONSTRAINT "ObservationEventRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ObservationFindingRecord" ADD CONSTRAINT "ObservationFindingRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ObservationEventRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ObservationSourceRecord" ADD CONSTRAINT "ObservationSourceRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ObservationEventRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ObservationRevisionRecord" ADD CONSTRAINT "ObservationRevisionRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ObservationEventRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ObservationRevisionRecord" ADD CONSTRAINT "ObservationRevisionRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ObservationSourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvidenceCheckRecord" ADD CONSTRAINT "EvidenceCheckRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
