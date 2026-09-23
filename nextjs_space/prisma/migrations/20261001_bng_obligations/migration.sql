-- BNG Evidence Record: first-class obligations for private cases.
-- Additive only. Two new tables mirroring the PrivateCaseEvent / PrivateCaseEventRevision split.
-- No existing column is altered. No data is destroyed.

CREATE TABLE IF NOT EXISTS "PrivateCaseObligation" (
 id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "caseId" TEXT NOT NULL,
 "passageId" TEXT, "documentId" TEXT, "evidenceCheckId" TEXT,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 UNIQUE ("workspaceId","caseId",id),
 FOREIGN KEY ("workspaceId","caseId") REFERENCES "PrivateCase"("workspaceId",id) ON DELETE RESTRICT,
 FOREIGN KEY ("workspaceId","caseId","passageId") REFERENCES "PrivateCasePassage"("workspaceId","caseId",id) ON DELETE RESTRICT,
 FOREIGN KEY ("workspaceId","caseId","documentId") REFERENCES "PrivateCaseDocument"("workspaceId","caseId",id) ON DELETE RESTRICT,
 FOREIGN KEY ("evidenceCheckId") REFERENCES "EvidenceCheckRecord"(id) ON DELETE RESTRICT
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
