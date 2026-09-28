-- Kerry Place Memory V1 — additive persistent-place projection and retrieval.
--
-- This migration does not insert evidence, create a Place, enable a feature,
-- install an extension or alter the four public V1 routes. PostgreSQL JSONB is
-- used for source geometries because PostGIS availability is not established.

-- QR/citizen-science readiness on the existing immutable observation record.
-- Existing rows retain conservative defaults and no intake endpoint is added.
ALTER TABLE "ObservationEventRecord" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE "ObservationEventRecord" ADD COLUMN "originalLanguage" TEXT;
ALTER TABLE "ObservationEventRecord" ADD COLUMN "mediaReferences" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "ObservationEventRecord" ADD COLUMN "observerAttributionState" TEXT;
ALTER TABLE "ObservationEventRecord" ADD COLUMN "claimedObservation" JSONB;
ALTER TABLE "ObservationEventRecord" ADD COLUMN "machineInterpretation" JSONB;
ALTER TABLE "ObservationEventRecord" ADD COLUMN "verificationState" TEXT NOT NULL DEFAULT 'UNREVIEWED';
ALTER TABLE "ObservationEventRecord" ADD COLUMN "submissionLicence" TEXT;
ALTER TABLE "ObservationEventRecord" ADD COLUMN "submissionConsent" JSONB;
ALTER TABLE "ObservationEventRecord" ADD COLUMN "sensitiveLocation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ObservationEventRecord" ADD COLUMN "locationDisclosure" TEXT NOT NULL DEFAULT 'NAMED_ONLY';

ALTER TABLE "ObservationEventRecord" ADD CONSTRAINT "ObservationEventRecord_locationDisclosure_check"
  CHECK ("locationDisclosure" IN ('EXACT', 'GENERALISED', 'NAMED_ONLY', 'HIDDEN'));
ALTER TABLE "ObservationEventRecord" ADD CONSTRAINT "ObservationEventRecord_verificationState_check"
  CHECK ("verificationState" IN ('UNREVIEWED', 'REVIEWED', 'REJECTED', 'VERIFIED'));
ALTER TABLE "ObservationEventRecord" ADD CONSTRAINT "ObservationEventRecord_origin_check"
  CHECK ("origin" IN ('SYSTEM', 'PLATFORM_API', 'QR', 'IMPORT'));
ALTER TABLE "ObservationEventRecord" ADD CONSTRAINT "ObservationEventRecord_attribution_check"
  CHECK ("observerAttributionState" IS NULL OR "observerAttributionState" IN ('ANONYMOUS', 'PUBLIC_ATTRIBUTION', 'PRIVATE_CONTACT'));
ALTER TABLE "ObservationEventRecord" ADD CONSTRAINT "ObservationEventRecord_media_array_check"
  CHECK (jsonb_typeof("mediaReferences") = 'array');
ALTER TABLE "ObservationEventRecord" ADD CONSTRAINT "ObservationEventRecord_sensitive_location_check"
  CHECK (NOT "sensitiveLocation" OR "locationDisclosure" <> 'EXACT');

-- Independently versioned source geometry. Area is the canonical spatial object;
-- this table is the immutable source representation of one version of it.
CREATE TABLE "PlaceSpatialVersion" (
  "id" TEXT NOT NULL,
  "areaId" TEXT NOT NULL,
  "platformEvidenceId" TEXT,
  "versionKey" TEXT NOT NULL,
  "geometry" JSONB NOT NULL,
  "geometryFormat" TEXT NOT NULL,
  "crs" TEXT NOT NULL,
  "sourceCrs" TEXT,
  "sourceScale" TEXT,
  "spatialPrecision" TEXT NOT NULL,
  "effectiveFrom" TEXT,
  "effectiveTo" TEXT,
  "effectivePrecision" TEXT NOT NULL DEFAULT 'unknown',
  "retrievedAt" TIMESTAMPTZ(3) NOT NULL,
  "publisher" TEXT NOT NULL,
  "dataset" TEXT NOT NULL,
  "sourceExternalId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "licence" TEXT NOT NULL,
  "rightsState" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceSpatialVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlaceSpatialVersion_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceSpatialVersion_platformEvidenceId_fkey" FOREIGN KEY ("platformEvidenceId") REFERENCES "PlatformEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceSpatialVersion_rightsState_check" CHECK ("rightsState" IN ('CLEARED_FOR_INGEST', 'REFERENCE_ONLY', 'PERMISSION_REQUIRED', 'NOT_CLEARED')),
  CONSTRAINT "PlaceSpatialVersion_effectivePrecision_check" CHECK ("effectivePrecision" IN ('unknown', 'year', 'month', 'day', 'time', 'interval'))
);
CREATE UNIQUE INDEX "PlaceSpatialVersion_areaId_versionKey_key" ON "PlaceSpatialVersion"("areaId", "versionKey");
CREATE INDEX "PlaceSpatialVersion_platformEvidenceId_idx" ON "PlaceSpatialVersion"("platformEvidenceId");
CREATE INDEX "PlaceSpatialVersion_sourceExternalId_idx" ON "PlaceSpatialVersion"("sourceExternalId");
CREATE INDEX "PlaceSpatialVersion_retrievedAt_idx" ON "PlaceSpatialVersion"("retrievedAt");

-- Reuse AssetArea rather than introducing a second place/spatial join. These
-- nullable provenance fields leave every existing relationship unchanged.
ALTER TABLE "AssetArea" ADD COLUMN "platformEvidenceId" TEXT;
ALTER TABLE "AssetArea" ADD COLUMN "areaVersionId" TEXT;
ALTER TABLE "AssetArea" ADD COLUMN "relationBasis" TEXT;
ALTER TABLE "AssetArea" ADD COLUMN "relationMethod" TEXT;
ALTER TABLE "AssetArea" ADD COLUMN "calculatedAt" TIMESTAMPTZ(3);
ALTER TABLE "AssetArea" ADD COLUMN "uncertainty" JSONB;
ALTER TABLE "AssetArea" ADD CONSTRAINT "AssetArea_platformEvidenceId_fkey"
  FOREIGN KEY ("platformEvidenceId") REFERENCES "PlatformEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetArea" ADD CONSTRAINT "AssetArea_areaVersionId_fkey"
  FOREIGN KEY ("areaVersionId") REFERENCES "PlaceSpatialVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AssetArea_platformEvidenceId_idx" ON "AssetArea"("platformEvidenceId");
CREATE INDEX "AssetArea_areaVersionId_idx" ON "AssetArea"("areaVersionId");

-- A bounded knowledge item. Original evidence and any derived/search
-- representation stay separate; classes are descriptive, never a universal
-- ranking. A Platform item can yield many entity relations without turning a
-- source document into the primary knowledge object.
CREATE TABLE "PlaceMemoryItem" (
  "id" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "platformEvidenceId" TEXT,
  "observationEventId" TEXT,
  "spatialVersionId" TEXT,
  "workspaceId" TEXT,
  "kind" TEXT NOT NULL,
  "evidenceClass" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "rightsState" TEXT NOT NULL,
  "originalStatement" TEXT NOT NULL,
  "sourceIndependenceKey" TEXT NOT NULL,
  "eventStart" TIMESTAMPTZ(3),
  "eventEnd" TIMESTAMPTZ(3),
  "timePrecision" TEXT NOT NULL DEFAULT 'unknown',
  "timeBasis" TEXT NOT NULL DEFAULT 'source',
  "geographyPrecision" TEXT,
  "locationDisclosure" TEXT NOT NULL DEFAULT 'NAMED_ONLY',
  "uncertainty" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceMemoryItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlaceMemoryItem_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemoryItem_platformEvidenceId_fkey" FOREIGN KEY ("platformEvidenceId") REFERENCES "PlatformEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemoryItem_observationEventId_fkey" FOREIGN KEY ("observationEventId") REFERENCES "ObservationEventRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemoryItem_spatialVersionId_fkey" FOREIGN KEY ("spatialVersionId") REFERENCES "PlaceSpatialVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemoryItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PrivateWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemoryItem_kind_check" CHECK ("kind" IN ('DESIGNATION', 'OBSERVATION', 'MEASUREMENT', 'EVENT', 'CLAIM', 'INTERVENTION', 'MODEL_OUTPUT', 'ANALYSIS')),
  CONSTRAINT "PlaceMemoryItem_evidenceClass_check" CHECK ("evidenceClass" IN ('AUTHORITATIVE_STATUTORY', 'AUTHORITATIVE_MONITORING', 'PROFESSIONAL_OBSERVATION', 'STRUCTURED_CITIZEN_OBSERVATION', 'UNVERIFIED_PUBLIC_SUBMISSION', 'MODEL_DERIVED_OUTPUT', 'BIOVERACITY_DERIVED_ANALYSIS')),
  CONSTRAINT "PlaceMemoryItem_visibility_check" CHECK ("visibility" IN ('PUBLIC', 'WORKSPACE_PRIVATE', 'RESTRICTED')),
  CONSTRAINT "PlaceMemoryItem_rightsState_check" CHECK ("rightsState" IN ('CLEARED_FOR_INGEST', 'REFERENCE_ONLY', 'PERMISSION_REQUIRED', 'NOT_CLEARED')),
  CONSTRAINT "PlaceMemoryItem_timePrecision_check" CHECK ("timePrecision" IN ('unknown', 'year', 'month', 'day', 'time', 'interval')),
  CONSTRAINT "PlaceMemoryItem_locationDisclosure_check" CHECK ("locationDisclosure" IN ('EXACT', 'GENERALISED', 'NAMED_ONLY', 'HIDDEN')),
  CONSTRAINT "PlaceMemoryItem_status_check" CHECK ("status" IN ('ACTIVE', 'SUPERSEDED', 'WITHDRAWN')),
  CONSTRAINT "PlaceMemoryItem_public_rights_check" CHECK ("visibility" <> 'PUBLIC' OR "rightsState" = 'CLEARED_FOR_INGEST'),
  CONSTRAINT "PlaceMemoryItem_workspace_scope_check" CHECK (("visibility" = 'WORKSPACE_PRIVATE') = ("workspaceId" IS NOT NULL))
);
CREATE UNIQUE INDEX "PlaceMemoryItem_platformEvidenceId_itemKey_key" ON "PlaceMemoryItem"("platformEvidenceId", "itemKey");
CREATE INDEX "PlaceMemoryItem_placeId_status_idx" ON "PlaceMemoryItem"("placeId", "status");
CREATE INDEX "PlaceMemoryItem_workspaceId_visibility_idx" ON "PlaceMemoryItem"("workspaceId", "visibility");
CREATE INDEX "PlaceMemoryItem_evidenceClass_idx" ON "PlaceMemoryItem"("evidenceClass");
CREATE INDEX "PlaceMemoryItem_eventStart_eventEnd_idx" ON "PlaceMemoryItem"("eventStart", "eventEnd");
CREATE INDEX "PlaceMemoryItem_observationEventId_idx" ON "PlaceMemoryItem"("observationEventId");
CREATE INDEX "PlaceMemoryItem_spatialVersionId_idx" ON "PlaceMemoryItem"("spatialVersionId");

CREATE TABLE "PlaceMemorySourceLink" (
  "itemId" TEXT NOT NULL,
  "platformEvidenceId" TEXT NOT NULL,
  "relationship" TEXT NOT NULL,
  "sourceIndependenceKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceMemorySourceLink_pkey" PRIMARY KEY ("itemId", "platformEvidenceId"),
  CONSTRAINT "PlaceMemorySourceLink_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlaceMemoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemorySourceLink_platformEvidenceId_fkey" FOREIGN KEY ("platformEvidenceId") REFERENCES "PlatformEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemorySourceLink_relationship_check" CHECK ("relationship" IN ('PRIMARY', 'SAME_UNDERLYING_RECORD', 'SUPERSEDING_VERSION'))
);
CREATE INDEX "PlaceMemorySourceLink_sourceIndependenceKey_idx" ON "PlaceMemorySourceLink"("sourceIndependenceKey");

CREATE TABLE "PlaceMemoryEntity" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "canonicalLabel" TEXT NOT NULL,
  "authority" TEXT,
  "externalId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceMemoryEntity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlaceMemoryEntity_authority_externalId_key" ON "PlaceMemoryEntity"("authority", "externalId");
CREATE INDEX "PlaceMemoryEntity_kind_idx" ON "PlaceMemoryEntity"("kind");
CREATE INDEX "PlaceMemoryEntity_canonicalLabel_idx" ON "PlaceMemoryEntity"("canonicalLabel");

CREATE TABLE "PlaceMemoryTerm" (
  "id" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "termType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "provenance" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceMemoryTerm_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlaceMemoryTerm_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "PlaceMemoryEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemoryTerm_status_check" CHECK ("status" IN ('SOURCE', 'CURATED', 'MACHINE_INTERPRETATION', 'VERIFIED'))
);
CREATE UNIQUE INDEX "PlaceMemoryTerm_entityId_language_normalized_termType_key" ON "PlaceMemoryTerm"("entityId", "language", "normalized", "termType");
CREATE INDEX "PlaceMemoryTerm_normalized_idx" ON "PlaceMemoryTerm"("normalized");
CREATE INDEX "PlaceMemoryTerm_language_termType_idx" ON "PlaceMemoryTerm"("language", "termType");

CREATE TABLE "PlaceMemoryItemEntity" (
  "itemId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "relationType" TEXT NOT NULL,
  "assertionState" TEXT NOT NULL,
  "sourceAssertion" JSONB NOT NULL,
  "uncertainty" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceMemoryItemEntity_pkey" PRIMARY KEY ("itemId", "entityId", "relationType", "assertionState"),
  CONSTRAINT "PlaceMemoryItemEntity_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlaceMemoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemoryItemEntity_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "PlaceMemoryEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemoryItemEntity_assertionState_check" CHECK ("assertionState" IN ('SOURCE_ASSERTION', 'CLAIMED', 'MACHINE_INTERPRETATION', 'VERIFIED_IDENTIFICATION'))
);
CREATE INDEX "PlaceMemoryItemEntity_entityId_relationType_idx" ON "PlaceMemoryItemEntity"("entityId", "relationType");

CREATE TABLE "PlaceMemoryRelation" (
  "id" TEXT NOT NULL,
  "fromItemId" TEXT NOT NULL,
  "toItemId" TEXT NOT NULL,
  "relationType" TEXT NOT NULL,
  "uncertainty" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceMemoryRelation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlaceMemoryRelation_fromItemId_fkey" FOREIGN KEY ("fromItemId") REFERENCES "PlaceMemoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemoryRelation_toItemId_fkey" FOREIGN KEY ("toItemId") REFERENCES "PlaceMemoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaceMemoryRelation_self_check" CHECK ("fromItemId" <> "toItemId")
);
CREATE UNIQUE INDEX "PlaceMemoryRelation_fromItemId_toItemId_relationType_key" ON "PlaceMemoryRelation"("fromItemId", "toItemId", "relationType");
CREATE INDEX "PlaceMemoryRelation_toItemId_relationType_idx" ON "PlaceMemoryRelation"("toItemId", "relationType");

-- Search representation remains rebuildable and independently versioned. The
-- evidence row and source assertions remain immutable if terminology changes.
CREATE TABLE "PlaceMemorySearchDocument" (
  "itemId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "representationVersion" TEXT NOT NULL,
  "conceptTerms" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceMemorySearchDocument_pkey" PRIMARY KEY ("itemId"),
  CONSTRAINT "PlaceMemorySearchDocument_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlaceMemoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PlaceMemorySearchDocument_english_fts_idx"
  ON "PlaceMemorySearchDocument" USING GIN (to_tsvector('english', "content"));
CREATE INDEX "PlaceMemorySearchDocument_simple_fts_idx"
  ON "PlaceMemorySearchDocument" USING GIN (to_tsvector('simple', "content"));
