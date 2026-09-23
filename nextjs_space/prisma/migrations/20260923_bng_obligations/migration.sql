-- BNG Evidence Record: first-class obligations for private cases.
-- Additive only. New tables mirroring the PrivateCaseEvent / PrivateCaseEventRevision split,
-- plus a case-scoped evidence-check table so provenance cannot point outside its own case.
-- No existing column is altered. No data is destroyed.

-- A bounded evidence check that belongs to exactly one case. Unlike the global
-- EvidenceCheckRecord (asset-tied), this is tenanted: an obligation may only link a
-- check that lives in the same workspace and case, closing the cross-case provenance hole.
CREATE TABLE IF NOT EXISTS "PrivateCaseEvidenceCheck" (
 id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "caseId" TEXT NOT NULL,
 question TEXT NOT NULL,
 "reviewedScope" TEXT NOT NULL,
 "resultStatus" TEXT NOT NULL DEFAULT 'NOT_LOCATED_IN_REVIEWED_SCOPE',
 "resultSummary" TEXT NOT NULL DEFAULT '',
 "createdBy" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 UNIQUE ("workspaceId","caseId",id),
 FOREIGN KEY ("workspaceId","caseId") REFERENCES "PrivateCase"("workspaceId",id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "PrivateCaseEvidenceCheck_workspace_case_idx" ON "PrivateCaseEvidenceCheck" ("workspaceId","caseId");

CREATE TABLE IF NOT EXISTS "PrivateCaseObligation" (
 id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "caseId" TEXT NOT NULL,
 "passageId" TEXT, "documentId" TEXT, "evidenceCheckId" TEXT,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 UNIQUE ("workspaceId","caseId",id),
 FOREIGN KEY ("workspaceId","caseId") REFERENCES "PrivateCase"("workspaceId",id) ON DELETE RESTRICT,
 FOREIGN KEY ("workspaceId","caseId","passageId") REFERENCES "PrivateCasePassage"("workspaceId","caseId",id) ON DELETE RESTRICT,
 FOREIGN KEY ("workspaceId","caseId","documentId") REFERENCES "PrivateCaseDocument"("workspaceId","caseId",id) ON DELETE RESTRICT,
 FOREIGN KEY ("workspaceId","caseId","evidenceCheckId") REFERENCES "PrivateCaseEvidenceCheck"("workspaceId","caseId",id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "PrivateCaseObligationRevision" (
 "obligationId" TEXT NOT NULL REFERENCES "PrivateCaseObligation"(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL,
 "sourceObligation" TEXT NOT NULL,
 "responsibleParty" TEXT NOT NULL DEFAULT '',
 "dueDate" TEXT,
 "duePrecision" TEXT NOT NULL DEFAULT 'UNKNOWN',
 recurrence TEXT NOT NULL DEFAULT 'NONE',
 "expectedEvidence" TEXT NOT NULL DEFAULT '',
 "evidenceStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
 "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT',
 "reviewedBy" TEXT REFERENCES "User"(id) ON DELETE RESTRICT,
 note TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 PRIMARY KEY ("obligationId",revision)
);

CREATE INDEX IF NOT EXISTS "PrivateCaseObligation_workspace_case_idx" ON "PrivateCaseObligation" ("workspaceId","caseId");

-- Widen the case-template CHECK to admit 'BNG'. Additive: the set only grows, so no
-- existing PrivateCase row can be invalidated. Without this the service accepts a 'BNG'
-- template but the database rejects the insert, making the feature impossible to use.
ALTER TABLE "PrivateCase" DROP CONSTRAINT IF EXISTS "private_case_template";
ALTER TABLE "PrivateCase" ADD CONSTRAINT "private_case_template" CHECK (template IN ('PLANNING','FARMER','ESG','FREIGHT','BNG','GENERAL'));
