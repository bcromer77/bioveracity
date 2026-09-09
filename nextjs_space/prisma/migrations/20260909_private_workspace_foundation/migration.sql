-- CreateTable
CREATE TABLE "PrivateWorkspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateWorkspaceMember" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PrivateWorkspaceMember_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- CreateTable
CREATE TABLE "PrivateCase" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateCaseMember" (
    "workspaceId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PrivateCaseMember_pkey" PRIMARY KEY ("workspaceId","caseId","userId")
);

-- CreateTable
CREATE TABLE "PrivateCaseSite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "PrivateCaseSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateWorkspaceAudit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "caseId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateWorkspaceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivateWorkspaceMember_userId_revokedAt_idx" ON "PrivateWorkspaceMember"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateCase_workspaceId_id_key" ON "PrivateCase"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "PrivateCaseMember_userId_revokedAt_idx" ON "PrivateCaseMember"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "PrivateCaseSite_workspaceId_caseId_idx" ON "PrivateCaseSite"("workspaceId", "caseId");

-- CreateIndex
CREATE INDEX "PrivateWorkspaceAudit_workspaceId_createdAt_idx" ON "PrivateWorkspaceAudit"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "PrivateWorkspaceMember" ADD CONSTRAINT "PrivateWorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PrivateWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateWorkspaceMember" ADD CONSTRAINT "PrivateWorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateCase" ADD CONSTRAINT "PrivateCase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PrivateWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateCaseMember" ADD CONSTRAINT "PrivateCaseMember_workspaceId_caseId_fkey" FOREIGN KEY ("workspaceId", "caseId") REFERENCES "PrivateCase"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateCaseMember" ADD CONSTRAINT "PrivateCaseMember_workspaceId_userId_fkey" FOREIGN KEY ("workspaceId", "userId") REFERENCES "PrivateWorkspaceMember"("workspaceId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateCaseSite" ADD CONSTRAINT "PrivateCaseSite_workspaceId_caseId_fkey" FOREIGN KEY ("workspaceId", "caseId") REFERENCES "PrivateCase"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateWorkspaceAudit" ADD CONSTRAINT "PrivateWorkspaceAudit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PrivateWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateWorkspaceAudit" ADD CONSTRAINT "PrivateWorkspaceAudit_workspaceId_caseId_fkey" FOREIGN KEY ("workspaceId", "caseId") REFERENCES "PrivateCase"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateWorkspaceAudit" ADD CONSTRAINT "PrivateWorkspaceAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Defence in depth: Prisma cannot express CHECK constraints; retain these in future migrations.
ALTER TABLE "PrivateWorkspaceMember" ADD CONSTRAINT "private_workspace_role" CHECK (role IN ('OWNER','CONTRIBUTOR','REVIEWER','VIEWER'));
ALTER TABLE "PrivateCaseMember" ADD CONSTRAINT "private_case_role" CHECK (role IN ('OWNER','CONTRIBUTOR','REVIEWER','VIEWER'));
ALTER TABLE "PrivateCase" ADD CONSTRAINT "private_case_template" CHECK (template IN ('PLANNING','FARMER','ESG','FREIGHT','GENERAL'));
ALTER TABLE "PrivateCaseSite" ADD CONSTRAINT "private_site_coordinates" CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));

