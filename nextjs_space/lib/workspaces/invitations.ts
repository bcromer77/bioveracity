import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Database, Sql } from './service'
import { WorkspaceError, permits } from './service'

export type InviteRole = 'OWNER' | 'CONTRIBUTOR' | 'REVIEWER' | 'VIEWER'

export function normaliseEmail(value: unknown): string {
  if (typeof value !== 'string') throw new WorkspaceError(400, 'Valid email is required')
  const email = value.trim().toLowerCase()
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new WorkspaceError(400, 'Valid email is required')
  return email
}

export function passwordInput(value: unknown): string {
  if (typeof value !== 'string' || value.length < 10 || value.length > 200) {
    throw new WorkspaceError(400, 'Password must be at least 10 characters')
  }
  return value
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function institutionalInviteService(db: Database, actorId: string) {
  if (!actorId) throw new WorkspaceError(401, 'Authentication required')

  async function ownerAccess(tx: Sql, workspaceId: string) {
    const rows = await tx.query<{ role: string }>(
      'SELECT role FROM "PrivateWorkspaceMember" WHERE "workspaceId"=$1 AND "userId"=$2 AND "revokedAt" IS NULL FOR SHARE',
      [workspaceId, actorId],
    )
    if (!rows[0] || rows[0].role !== 'OWNER') throw new WorkspaceError(404, 'Workspace unavailable')
  }

  return {
    async create(input: { workspaceId: string; caseId?: string | null; email: unknown; role: InviteRole; canExport?: boolean; expiresInHours?: number }) {
      const email = normaliseEmail(input.email)
      if (!permits(input.role, 'read')) throw new WorkspaceError(400, 'Invalid invitation role')
      const expiresInHours = input.expiresInHours ?? 168
      if (!Number.isFinite(expiresInHours) || expiresInHours < 1 || expiresInHours > 24 * 30) throw new WorkspaceError(400, 'Invalid invitation lifetime')
      return db.transaction(async tx => {
        await ownerAccess(tx, input.workspaceId)
        if (input.caseId) {
          const rows = await tx.query<{ id: string }>('SELECT id FROM "PrivateCase" WHERE "workspaceId"=$1 AND id=$2 FOR SHARE', [input.workspaceId, input.caseId])
          if (!rows[0]) throw new WorkspaceError(404, 'Workspace or case unavailable')
        }
        await tx.query(
          'UPDATE "PrivateWorkspaceInvitation" SET "revokedAt"=now() WHERE "workspaceId"=$1 AND email=$2 AND "acceptedAt" IS NULL AND "revokedAt" IS NULL',
          [input.workspaceId, email],
        )
        const token = randomBytes(32).toString('base64url')
        const id = randomUUID()
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        await tx.query(
          'INSERT INTO "PrivateWorkspaceInvitation" (id,"workspaceId","caseId",email,role,"canExport","tokenHash","invitedBy","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [id, input.workspaceId, input.caseId ?? null, email, input.role, Boolean(input.canExport), hashInvitationToken(token), actorId, expiresAt],
        )
        await tx.query('INSERT INTO "PrivateWorkspaceAudit" (id,"workspaceId","caseId","actorId",action) VALUES ($1,$2,$3,$4,$5)',
          [randomUUID(), input.workspaceId, input.caseId ?? null, actorId, 'INVITATION_CREATED'])
        return { id, token, expiresAt }
      })
    },

    async revoke(workspaceId: string, invitationId: string) {
      return db.transaction(async tx => {
        await ownerAccess(tx, workspaceId)
        const rows = await tx.query<{ caseId: string | null }>(
          'UPDATE "PrivateWorkspaceInvitation" SET "revokedAt"=now() WHERE id=$1 AND "workspaceId"=$2 AND "acceptedAt" IS NULL AND "revokedAt" IS NULL RETURNING "caseId"',
          [invitationId, workspaceId],
        )
        if (!rows[0]) throw new WorkspaceError(404, 'Invitation unavailable')
        await tx.query('INSERT INTO "PrivateWorkspaceAudit" (id,"workspaceId","caseId","actorId",action) VALUES ($1,$2,$3,$4,$5)',
          [randomUUID(), workspaceId, rows[0].caseId, actorId, 'INVITATION_REVOKED'])
        return { revoked: true }
      })
    },
  }
}

export function invitationAcceptanceService(db: Database, userId: string, userEmail: string) {
  if (!userId) throw new WorkspaceError(401, 'Authentication required')
  const email = normaliseEmail(userEmail)

  return {
    async accept(token: string) {
      if (!token || token.length > 200) throw new WorkspaceError(400, 'Invalid invitation')
      const tokenHash = hashInvitationToken(token)
      return db.transaction(async tx => {
        const rows = await tx.query<{ id: string; workspaceId: string; caseId: string | null; email: string; role: InviteRole; canExport: boolean; expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null }>(
          'SELECT id,"workspaceId","caseId",email,role,"canExport","expiresAt","acceptedAt","revokedAt" FROM "PrivateWorkspaceInvitation" WHERE "tokenHash"=$1 FOR UPDATE',
          [tokenHash],
        )
        const invite = rows[0]
        if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) throw new WorkspaceError(410, 'Invitation is no longer available')
        if (invite.email !== email) throw new WorkspaceError(403, 'This invitation is for a different email address')

        const workspaceMembership = await tx.query<{ role: string; revokedAt: Date | null }>(
          'SELECT role,"revokedAt" FROM "PrivateWorkspaceMember" WHERE "workspaceId"=$1 AND "userId"=$2 FOR UPDATE',
          [invite.workspaceId, userId],
        )
        if (!workspaceMembership[0]) {
          await tx.query('INSERT INTO "PrivateWorkspaceMember" ("workspaceId","userId",role) VALUES ($1,$2,$3)', [invite.workspaceId, userId, invite.role])
        } else if (workspaceMembership[0].revokedAt) {
          await tx.query('UPDATE "PrivateWorkspaceMember" SET "revokedAt"=NULL, role=$3 WHERE "workspaceId"=$1 AND "userId"=$2', [invite.workspaceId, userId, invite.role])
        }

        if (invite.caseId) {
          const existing = await tx.query<{ role: string; canExport: boolean; revokedAt: Date | null }>(
            'SELECT role,"canExport","revokedAt" FROM "PrivateCaseMember" WHERE "workspaceId"=$1 AND "caseId"=$2 AND "userId"=$3 FOR UPDATE',
            [invite.workspaceId, invite.caseId, userId],
          )
          if (!existing[0]) {
            await tx.query(
              'INSERT INTO "PrivateCaseMember" ("workspaceId","caseId","userId",role,"canExport") VALUES ($1,$2,$3,$4,$5)',
              [invite.workspaceId, invite.caseId, userId, invite.role, invite.canExport],
            )
          } else if (existing[0].revokedAt) {
            await tx.query(
              'UPDATE "PrivateCaseMember" SET "revokedAt"=NULL, role=$4,"canExport"=$5 WHERE "workspaceId"=$1 AND "caseId"=$2 AND "userId"=$3',
              [invite.workspaceId, invite.caseId, userId, invite.role, invite.canExport],
            )
          }
        }

        await tx.query(
          'UPDATE "PrivateWorkspaceInvitation" SET "acceptedAt"=now(),"acceptedBy"=$2 WHERE id=$1',
          [invite.id, userId],
        )
        await tx.query('INSERT INTO "PrivateWorkspaceAudit" (id,"workspaceId","caseId","actorId",action) VALUES ($1,$2,$3,$4,$5)',
          [randomUUID(), invite.workspaceId, invite.caseId, userId, 'INVITATION_ACCEPTED'])

        const destination = invite.caseId
          ? `/workspace/${encodeURIComponent(invite.workspaceId)}?case=${encodeURIComponent(invite.caseId)}`
          : `/workspace/${encodeURIComponent(invite.workspaceId)}`
        return { workspaceId: invite.workspaceId, caseId: invite.caseId, destination }
      })
    },
  }
}
