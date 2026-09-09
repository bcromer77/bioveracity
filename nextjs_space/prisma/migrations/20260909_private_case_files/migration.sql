CREATE TABLE "PrivateCaseDocument" (
 id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "caseId" TEXT NOT NULL,
 name TEXT NOT NULL, hash TEXT NOT NULL, "encryptedBytes" BYTEA NOT NULL, "byteLength" INTEGER NOT NULL,
 "mediaType" TEXT NOT NULL, status TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}', warnings JSONB NOT NULL DEFAULT '[]',
 "parentId" TEXT, "supersedesId" TEXT, "sourceUrl" TEXT, "publicationDate" TEXT,
 "parserVersion" TEXT NOT NULL, "importedBy" TEXT NOT NULL REFERENCES "User"(id), "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 UNIQUE ("workspaceId","caseId",id), UNIQUE ("workspaceId","caseId",hash),
 FOREIGN KEY ("workspaceId","caseId") REFERENCES "PrivateCase"("workspaceId",id) ON DELETE RESTRICT,
 FOREIGN KEY ("workspaceId","caseId","parentId") REFERENCES "PrivateCaseDocument"("workspaceId","caseId",id),
 FOREIGN KEY ("workspaceId","caseId","supersedesId") REFERENCES "PrivateCaseDocument"("workspaceId","caseId",id)
);
CREATE TABLE "PrivateCasePassage" (
 id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "caseId" TEXT NOT NULL, "documentId" TEXT NOT NULL,
 ordinal INTEGER NOT NULL, locator TEXT NOT NULL, text TEXT NOT NULL,
 UNIQUE ("workspaceId","caseId",id),
 FOREIGN KEY ("workspaceId","caseId","documentId") REFERENCES "PrivateCaseDocument"("workspaceId","caseId",id) ON DELETE RESTRICT
);
CREATE TABLE "PrivateCaseEvent" (
 id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "caseId" TEXT NOT NULL, "passageId" TEXT NOT NULL,
 FOREIGN KEY ("workspaceId","caseId","passageId") REFERENCES "PrivateCasePassage"("workspaceId","caseId",id) ON DELETE RESTRICT,
 UNIQUE ("workspaceId","caseId",id)
);
CREATE TABLE "PrivateCaseEventRevision" (
 "eventId" TEXT NOT NULL REFERENCES "PrivateCaseEvent"(id), revision INTEGER NOT NULL, title TEXT NOT NULL, quote TEXT NOT NULL,
 "eventDate" TEXT, precision TEXT NOT NULL CHECK (precision IN ('UNKNOWN','YEAR','MONTH','DAY')),
 status TEXT NOT NULL CHECK (status IN ('DRAFT','ACCEPTED','REJECTED')),
 "evidenceType" TEXT NOT NULL DEFAULT 'SOURCE_STATEMENT', note TEXT NOT NULL DEFAULT '',
 "reviewedBy" TEXT REFERENCES "User"(id), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 PRIMARY KEY ("eventId",revision)
);
CREATE TABLE "PrivateCaseExport" (
 id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "caseId" TEXT NOT NULL, "requestedBy" TEXT NOT NULL REFERENCES "User"(id),
 "encryptedBytes" BYTEA NOT NULL, hash TEXT NOT NULL, manifest JSONB NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 FOREIGN KEY ("workspaceId","caseId") REFERENCES "PrivateCase"("workspaceId",id) ON DELETE RESTRICT
);
CREATE INDEX ON "PrivateCasePassage" ("workspaceId","caseId","documentId");
CREATE INDEX ON "PrivateCaseEvent" ("workspaceId","caseId");
CREATE INDEX ON "PrivateCaseExport" ("workspaceId","caseId","requestedBy");
