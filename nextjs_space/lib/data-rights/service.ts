import { termsSections, privacySections } from './legal'
import { randomUUID } from 'node:crypto'
import { WorkspaceError, type Database, type Sql } from '../workspaces/service'
import { TERMS_VERSION, PRIVACY_VERSION, TERMS_LABEL, validAcceptance, requestKinds, oneCalendarMonth } from './policy'
import { isAdmin } from '../access'

export async function recordAcceptance(sql: Sql, userId: string, input: unknown, channel: string) {
  if (!validAcceptance(input)) throw new WorkspaceError(400, 'Please read and accept the current terms and acknowledge the privacy notice.')
  await sql.query('INSERT INTO "TermsAcceptance" (id,"userId","termsVersion","privacyVersion",wording,channel,"termsText","privacyText") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ("userId","termsVersion","privacyVersion") DO NOTHING', [randomUUID(), userId, TERMS_VERSION, PRIVACY_VERSION, TERMS_LABEL, channel, JSON.stringify(termsSections), JSON.stringify(privacySections)])
}
const columns = 'id,kind,details,status,response,"createdAt","dueAt","updatedAt"'
export function rightsService(db: Database, userId: string) {
  async function user(sql: Sql) {
    const [u] = await sql.query<{id:string; name:string; email:string; role:string; accessState:string; createdAt:Date}>('SELECT id,name,email,role,"accessState","createdAt" FROM "User" WHERE id=$1', [userId])
    if (!u) throw new WorkspaceError(401, 'Please sign in.')
    return u
  }
  async function admin(sql: Sql) {
    if (!isAdmin({ user: await user(sql), expires: '' })) throw new WorkspaceError(403, 'Administrator access required.')
  }
  return {
    async overview() {
      const account = await user(db)
      const acceptances = await db.query('SELECT "termsVersion","privacyVersion",wording,channel,"termsText","privacyText","acceptedAt" FROM "TermsAcceptance" WHERE "userId"=$1 ORDER BY "acceptedAt"', [userId])
      const requests = await db.query(`SELECT ${columns} FROM "DataRightsRequest" WHERE "userId"=$1 ORDER BY "createdAt" DESC`, [userId])
      const venues = await db.query(`SELECT id,profile,plan,"createdAt","updatedAt",(published IS NOT NULL AND published<>'null'::jsonb) AS "isPublished" FROM "WildHub" WHERE "ownerId"=$1`, [userId])
      const preferences = await db.query('SELECT "scopeKey","actionEmail","importantChangeEmail","weeklyDigest","routineEmail","quietHoursStart","quietHoursEnd",timezone FROM "AttentionPreference" WHERE "userId"=$1', [userId])
      const galleryReleases = await db.query(`SELECT r."photoId",r."venueName",r.version,r.wording,r."venuePublications",r."bioPublications",r."acceptedAt",r."withdrawnAt" FROM "VenuePhotoRelease" r JOIN "WildHubPhoto" p ON p.id=r."galleryPhotoId" JOIN "WildHub" h ON h.id=p."hubId" WHERE h."ownerId"=$1`, [userId])
      return { galleryReleases, account: {id:account.id,name:account.name,email:account.email,createdAt:account.createdAt}, acceptances, requests, venues, preferences }
    },
    async accept(input: unknown) { await user(db); await recordAcceptance(db, userId, input, 'account'); return {accepted:true} },
    async request(raw: Record<string, unknown>) {
      if (!requestKinds.includes(raw.kind as typeof requestKinds[number])) throw new WorkspaceError(400, 'Choose a data rights request.')
      if (typeof raw.details !== 'string' || raw.details.length > 4000) throw new WorkspaceError(400, 'Use up to 4,000 characters.')
      if (raw.kind === 'ERASURE' && raw.confirm !== 'DELETE MY DATA') throw new WorkspaceError(400, 'Type DELETE MY DATA to confirm your request.')
      return db.transaction(async sql => {
        await user(sql)
        await sql.query('SELECT id FROM "User" WHERE id=$1 FOR UPDATE', [userId])
        const [existing] = await sql.query(`SELECT ${columns} FROM "DataRightsRequest" WHERE "userId"=$1 AND kind=$2 AND status IN ('RECEIVED','IN_REVIEW')`, [userId, raw.kind])
        if (existing) return existing
        const now = new Date(), id = randomUUID()
        const [saved] = await sql.query(`INSERT INTO "DataRightsRequest" (id,"userId",kind,details,"createdAt","dueAt") VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${columns}`, [id,userId,raw.kind,String(raw.details).trim(),now,oneCalendarMonth(now)])
        await sql.query('INSERT INTO "DataRightsEvent" (id,"requestId","actorId",status) VALUES ($1,$2,$3,$4)', [randomUUID(),id,userId,'RECEIVED'])
        return saved
      })
    },
    async withdrawGalleryRelease(photoId: string) {
      await user(db)
      const rows = await db.query(`UPDATE "VenuePhotoRelease" r SET "withdrawnAt"=COALESCE(r."withdrawnAt",now()) FROM "WildHubPhoto" p JOIN "WildHub" h ON h.id=p."hubId" WHERE r."galleryPhotoId"=p.id AND p.id=$1 AND h."ownerId"=$2 RETURNING r."photoId"`,[photoId,userId])
      if (!rows.length) throw new WorkspaceError(404,'Gallery release not found.')
      return {withdrawn:true}
    },
    async unpublish(hubId: string) {
      return db.transaction(async sql => {
        await user(sql)
        const [hub] = await sql.query('UPDATE "WildHub" SET published=NULL,revision=revision+1,"updatedAt"=now() WHERE id=$1 AND "ownerId"=$2 RETURNING id', [hubId,userId])
        if (!hub) throw new WorkspaceError(404, 'Venue not found.')
        await sql.query('INSERT INTO "WildHubPublication" (id,"hubId","actorId",action) VALUES ($1,$2,$3,$4)', [randomUUID(),hubId,userId,'UNPUBLISH'])
        // Prevent a pending editor approval from unexpectedly republishing the venue.
        await sql.query(`UPDATE "WildHubReview" SET status='REJECTED',reason='Owner took the venue offline. Submit again for publication.',"reviewedAt"=now() WHERE "hubId"=$1 AND status='PENDING'`, [hubId])
        return {unpublished:true}
      })
    },
    async queue() { await admin(db); return db.query(`SELECT r.*,u.email FROM "DataRightsRequest" r JOIN "User" u ON u.id=r."userId" ORDER BY CASE WHEN status IN ('RECEIVED','IN_REVIEW') THEN 0 ELSE 1 END,r."dueAt" LIMIT 200`, []) },
    async respond(id: string, input: Record<string, unknown>) {
      if (!['IN_REVIEW','COMPLETED','PARTIALLY_COMPLETED','REFUSED'].includes(String(input.status)) || typeof input.response !== 'string' || String(input.response).trim().length < 20 || input.response.length > 4000) throw new WorkspaceError(400, 'Choose a status and explain the action, retained data or refusal (20–4,000 characters).')
      if (input.status !== 'IN_REVIEW' && input.confirm !== true) throw new WorkspaceError(400, 'Confirm the work has actually been completed and the response is accurate.')
      return db.transaction(async sql => {
        await admin(sql)
        const [saved] = await sql.query(`UPDATE "DataRightsRequest" SET status=$1,response=$2,"updatedAt"=now() WHERE id=$3 AND status IN ('RECEIVED','IN_REVIEW') RETURNING ${columns}`, [input.status,String(input.response).trim(),id])
        if (!saved) throw new WorkspaceError(409, 'Request not found or already closed.')
        await sql.query('INSERT INTO "DataRightsEvent" (id,"requestId","actorId",status,response) VALUES ($1,$2,$3,$4,$5)', [randomUUID(),id,userId,input.status,String(input.response).trim()])
        return saved
      })
    },
  }
}
