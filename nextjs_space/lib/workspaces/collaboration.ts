import { randomUUID } from 'node:crypto'
import { WorkspaceError, type Database, type Sql } from './service'

export function collaborationService(db: Database, actor: string) {
  if (!actor) throw new WorkspaceError(401, 'Authentication required')
  async function owner(tx: Sql, w: string, c: string) {
    const rows = await tx.query('SELECT cm."userId" FROM "PrivateCaseMember" cm JOIN "PrivateWorkspaceMember" wm ON wm."workspaceId"=cm."workspaceId" AND wm."userId"=cm."userId" WHERE cm."workspaceId"=$1 AND cm."caseId"=$2 AND cm."userId"=$3 AND cm.role=\'OWNER\' AND wm.role=\'OWNER\' AND cm."revokedAt" IS NULL AND wm."revokedAt" IS NULL FOR UPDATE OF cm', [w,c,actor])
    if (!rows.length) throw new WorkspaceError(404, 'Case access management unavailable')
  }
  return {
    list(w: string,c: string) { return db.transaction(async tx=>{
      await owner(tx,w,c)
      const members=await tx.query<{userId:string;email:string;name:string|null;role:string;canExport:boolean}>('SELECT cm."userId",u.email,u.name,cm.role,cm."canExport" FROM "PrivateCaseMember" cm JOIN "User" u ON u.id=cm."userId" JOIN "PrivateWorkspaceMember" wm ON wm."workspaceId"=cm."workspaceId" AND wm."userId"=cm."userId" WHERE cm."workspaceId"=$1 AND cm."caseId"=$2 AND cm."revokedAt" IS NULL AND wm."revokedAt" IS NULL ORDER BY u.email',[w,c])
      const invitations=await tx.query<{id:string;email:string;role:string;expiresAt:Date}>('SELECT id,email,role,"expiresAt" FROM "PrivateWorkspaceInvitation" WHERE "workspaceId"=$1 AND "caseId"=$2 AND "acceptedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt">now() ORDER BY "expiresAt"',[w,c])
      return {members,invitations}
    })},
    revoke(w:string,c:string,userId:string) {return db.transaction(async tx=>{
      await owner(tx,w,c)
      if (userId===actor) throw new WorkspaceError(400,'You cannot remove your own owner access')
      const rows=await tx.query('UPDATE "PrivateCaseMember" SET "revokedAt"=now(),"canExport"=false WHERE "workspaceId"=$1 AND "caseId"=$2 AND "userId"=$3 AND role<>\'OWNER\' AND "revokedAt" IS NULL RETURNING "userId"',[w,c,userId])
      if (!rows.length) throw new WorkspaceError(404,'Removable member unavailable')
      // Old invitations must not restore the access just removed. Other cases are untouched.
      await tx.query('UPDATE "PrivateWorkspaceInvitation" SET "revokedAt"=now() WHERE "workspaceId"=$1 AND "caseId"=$2 AND email=(SELECT email FROM "User" WHERE id=$3) AND "acceptedAt" IS NULL AND "revokedAt" IS NULL',[w,c,userId])
      await tx.query('INSERT INTO "PrivateWorkspaceAudit" (id,"workspaceId","caseId","actorId",action) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),w,c,actor,'CASE_MEMBER_REVOKED'])
      return {revoked:true}
    })},
  }
}
