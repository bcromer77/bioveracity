CREATE TABLE "PrivateWorkspaceInvitation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "caseId" TEXT,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "canExport" BOOLEAN NOT NULL DEFAULT false,
  "tokenHash" TEXT NOT NULL,
  "invitedBy" TEXT NOT NULL,
  "acceptedBy" TEXT,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "acceptedAt" TIMESTAMPTZ(3),
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateWorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivateWorkspaceInvitation_tokenHash_key" ON "PrivateWorkspaceInvitation"("tokenHash");
CREATE INDEX "PrivateWorkspaceInvitation_workspaceId_createdAt_idx" ON "PrivateWorkspaceInvitation"("workspaceId", "createdAt");
CREATE INDEX "PrivateWorkspaceInvitation_email_revokedAt_acceptedAt_idx" ON "PrivateWorkspaceInvitation"("email", "revokedAt", "acceptedAt");
CREATE INDEX "PrivateWorkspaceInvitation_expiresAt_idx" ON "PrivateWorkspaceInvitation"("expiresAt");

ALTER TABLE "PrivateWorkspaceInvitation"
  ADD CONSTRAINT "PrivateWorkspaceInvitation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "PrivateWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrivateWorkspaceInvitation"
  ADD CONSTRAINT "PrivateWorkspaceInvitation_workspaceId_caseId_fkey"
  FOREIGN KEY ("workspaceId","caseId") REFERENCES "PrivateCase"("workspaceId","id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrivateWorkspaceInvitation"
  ADD CONSTRAINT "PrivateWorkspaceInvitation_invitedBy_fkey"
  FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrivateWorkspaceInvitation"
  ADD CONSTRAINT "PrivateWorkspaceInvitation_acceptedBy_fkey"
  FOREIGN KEY ("acceptedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
