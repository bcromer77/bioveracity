import { releaseInput, RELEASE_CORE, RELEASE_VENUE, RELEASE_BIO, RELEASE_LIMITS, type ReleaseInput } from './release'
import { randomUUID } from 'node:crypto'
import type { Database, Sql } from '../workspaces/service'
import { isAdmin } from '../access'
import { HubError } from '../wild-hubs/domain'
import { CONSENT_VERSION, MAX_PHOTOS, hashToken, newToken, photoColumns, type JournalPhoto } from './domain'
const releasePhotos = `(SELECT id,caption,credit,status,"hubId" FROM "VenuePhoto" UNION ALL SELECT g.id,g.caption,g.credit,CASE WHEN h.published->'photoIds' ? g.id THEN 'PUBLISHED' ELSE 'RECEIVED' END AS status,g."hubId" FROM "WildHubPhoto" g JOIN "WildHub" h ON h.id=g."hubId")`
type Settings = { contributionsEnabled: boolean; weeklyEnabled: boolean }
export function journalService(db: Database, actorId: string | null) {
 async function owner(sql: Sql, hubId: string, lock = false) {
  const [hub] = await sql.query<{ id: string }>(`SELECT "id" FROM "WildHub" WHERE "id"=$1 AND "ownerId"=$2${lock ? ' FOR UPDATE' : ''}`, [hubId, actorId])
  if (!hub) throw new HubError(404, 'Venue not found.')
 }
 async function reviewer(sql: Sql) {
  const [user] = await sql.query<{ id: string; role: string; accessState: string }>('SELECT "id","role","accessState" FROM "User" WHERE "id"=$1', [actorId])
  if (!user || !isAdmin({ user, expires: '' })) throw new HubError(403, 'Administrator access required.')
 }
 async function accepting(sql: Sql, hubId: string) {
  const [hub] = await sql.query<{ id: string }>('SELECT h."id" FROM "WildHub" h JOIN "VenuePhotoSettings" s ON s."hubId"=h."id" WHERE h."id"=$1 AND h."published" IS NOT NULL AND s."contributionsEnabled"=true', [hubId])
  if (!hub) throw new HubError(404, 'This venue is not accepting photographs.')
 }
 async function event(sql: Sql, photoId: string, action: string, reason = '') {
  await sql.query('INSERT INTO "VenuePhotoEvent" ("id","photoId","actorId","action","reason") VALUES ($1,$2,$3,$4,$5)', [randomUUID(), photoId, actorId, action, reason])
 }
 return {
  async settings(hubId: string) {
   await owner(db, hubId)
   const [saved] = await db.query<Settings>('SELECT "contributionsEnabled","weeklyEnabled" FROM "VenuePhotoSettings" WHERE "hubId"=$1', [hubId])
   return saved || { contributionsEnabled: false, weeklyEnabled: false }
  },
  async configure(hubId: string, input: Settings) {
   if (typeof input.contributionsEnabled !== 'boolean' || typeof input.weeklyEnabled !== 'boolean') throw new HubError(400, 'Choose photo and email preferences.')
   return db.transaction(async sql => {
    await owner(sql, hubId, true)
    await sql.query('INSERT INTO "VenuePhotoSettings" ("hubId","contributionsEnabled","weeklyEnabled") VALUES ($1,$2,$3) ON CONFLICT ("hubId") DO UPDATE SET "contributionsEnabled"=$2,"weeklyEnabled"=$3,"updatedAt"=now()', [hubId, input.contributionsEnabled, input.weeklyEnabled])
    return input
   })
  },
  async list(hubId: string) {
   await owner(db, hubId)
   return db.query<JournalPhoto>(`SELECT ${photoColumns} FROM "VenuePhoto" p WHERE p."hubId"=$1 AND p."status"<>'WITHDRAWN' ORDER BY p."observedOn" DESC NULLS LAST,p."createdAt" DESC,p."id" LIMIT $2`, [hubId, MAX_PHOTOS])
  },
  async reserveScan(hubId: string) {
   return db.transaction(async sql => {
    await sql.query('SELECT "id" FROM "WildHub" WHERE "id"=$1 FOR UPDATE', [hubId])
    await accepting(sql, hubId)
    const [usage] = await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM "VenuePhoto" WHERE "hubId"=$1', [hubId])
    if (usage.n >= MAX_PHOTOS) throw new HubError(429, 'This venue’s photo journal is full. Please contact the venue.')
    const [slot] = await sql.query<{ hubId: string }>(`UPDATE "VenuePhotoSettings" SET "scanCount"=CASE WHEN "scanWindow">now()-interval '1 hour' THEN "scanCount"+1 ELSE 1 END,"scanWindow"=CASE WHEN "scanWindow">now()-interval '1 hour' THEN "scanWindow" ELSE now() END WHERE "hubId"=$1 AND ("scanCount"<12 OR "scanWindow"<=now()-interval '1 hour') RETURNING "hubId"`, [hubId])
    if (!slot) throw new HubError(429, 'This venue has reached its hourly photo limit. Please try later.')
   })
  },
  async contribute(hubId: string, photo: { caption: string; credit: string; location: string; observedOn: string | null; hash: string; bytes: Buffer } & ReleaseInput) {
   return db.transaction(async sql => {
    await sql.query('SELECT "id" FROM "WildHub" WHERE "id"=$1 FOR UPDATE', [hubId])
    await accepting(sql, hubId)
    const [usage] = await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM "VenuePhoto" WHERE "hubId"=$1', [hubId])
    if (usage.n >= MAX_PHOTOS) throw new HubError(429, 'This venue’s photo journal is full.')
    const id = randomUUID(), withdrawalToken = newToken()
    const rows = await sql.query<{ id: string }>('INSERT INTO "VenuePhoto" ("id","hubId","caption","credit","location","observedOn","hash","bytes","consentVersion","withdrawalHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT ("hubId","hash") DO NOTHING RETURNING "id"', [id,hubId,photo.caption,photo.credit,photo.location,photo.observedOn,photo.hash,photo.bytes,CONSENT_VERSION,hashToken(withdrawalToken)])
    if (!rows.length) throw new HubError(409, 'This photograph has already been contributed. Keep your original receipt.')
    const release = releaseInput(photo)
    const [venue] = await sql.query<{name:string}>(`SELECT profile->>'name' AS name FROM "WildHub" WHERE id=$1`,[hubId])
    await sql.query(`INSERT INTO "VenuePhotoRelease" ("photoId","journalPhotoId","contactName","contactEmail","venueName",version,wording,"venuePublications","bioPublications") VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8)`, [id,release.contactName,release.contactEmail,venue.name,release.releaseVersion,[RELEASE_CORE,RELEASE_VENUE,RELEASE_BIO,RELEASE_LIMITS].join('\n\n'),release.venuePublications,release.bioPublications])
    await event(sql, id, 'CONTRIBUTED', CONSENT_VERSION)
    return { id, withdrawalToken }
   })
  },
  async change(hubId: string, photoId: string, revision: number, action: string) {
   if (!['submit','unpublish','withdraw'].includes(action)) throw new HubError(400, 'Choose a photo action.')
   return db.transaction(async sql => {
    await owner(sql, hubId, true)
    const [photo] = await sql.query<JournalPhoto>(`SELECT ${photoColumns} FROM "VenuePhoto" p WHERE p."id"=$1 AND p."hubId"=$2 FOR UPDATE`, [photoId,hubId])
    if (!photo) throw new HubError(404, 'Photograph not found.')
    if (photo.revision !== revision || photo.status === 'WITHDRAWN') throw new HubError(409, 'This photograph changed. Reload the journal.')
    if (action === 'submit' && !['RECEIVED','REJECTED'].includes(photo.status)) throw new HubError(409, 'This photograph is already submitted or published.')
    const status = action === 'submit' ? 'REVIEW' : action === 'withdraw' ? 'WITHDRAWN' : 'RECEIVED'
    await sql.query('UPDATE "VenuePhoto" SET "status"=$1,"revision"="revision"+1,"bytes"=CASE WHEN $1=\'WITHDRAWN\' THEN \'\'::bytea ELSE "bytes" END WHERE "id"=$2', [status,photoId])
    if (action === 'withdraw') await sql.query('UPDATE "VenuePhotoRelease" SET "withdrawnAt"=now() WHERE "photoId"=$1', [photoId])
    await event(sql, photoId, action.toUpperCase())
   })
  },
  async withdraw(photoId: string, token: string) {
   return db.transaction(async sql => {
    const [photo] = await sql.query<{ id: string }>('UPDATE "VenuePhoto" SET "status"=\'WITHDRAWN\',"bytes"=\'\'::bytea,"revision"="revision"+1 WHERE "id"=$1 AND "withdrawalHash"=$2 AND "status"<>\'WITHDRAWN\' RETURNING "id"', [photoId, hashToken(token)])
    if (!photo) throw new HubError(404, 'Receipt not found or photograph already withdrawn.')
    await sql.query('UPDATE "VenuePhotoRelease" SET "withdrawnAt"=now() WHERE "photoId"=$1', [photoId])
    await event(sql, photoId, 'CONTRIBUTOR_WITHDRAWAL')
   })
  },
  async releaseReceipt(photoId: string, token: string, withdrawFuture = false) {
   return db.transaction(async sql => {
    const [photo] = await sql.query(`SELECT id FROM "VenuePhoto" WHERE id=$1 AND "withdrawalHash"=$2 FOR UPDATE`, [photoId,hashToken(token)])
    if (!photo) throw new HubError(404,'Receipt not found.')
    if (withdrawFuture) {
     await sql.query(`UPDATE "VenuePhotoRelease" SET "withdrawnAt"=COALESCE("withdrawnAt",now()) WHERE "photoId"=$1`, [photoId])
     await event(sql,photoId,'FUTURE_PUBLICATION_WITHDRAWAL')
    }
    const [release] = await sql.query(`SELECT "photoId","contactName","contactEmail","venueName",version,wording,"venuePublications","bioPublications","acceptedAt","withdrawnAt","contactVerifiedAt" FROM "VenuePhotoRelease" WHERE "photoId"=$1`,[photoId])
    return release || {photoId,legacy:true,message:'This older upload has no future-publication release.'}
   })
  },
  async releaseQueue() {
   await reviewer(db)
   return db.query(`SELECT r.*,p.caption,p.credit,p.status,p."hubId" FROM "VenuePhotoRelease" r JOIN ${releasePhotos} p ON p.id=r."photoId" WHERE r."withdrawnAt" IS NULL AND p.status<>'WITHDRAWN' AND (r."venuePublications" OR r."bioPublications") ORDER BY r."acceptedAt" DESC LIMIT 200`,[])
  },
  async verifyRelease(photoId: string, note: string) {
   if (note.trim().length<20 || note.length>2000) throw new HubError(400,'Record how the contributor’s contact and authority were independently verified.')
   return db.transaction(async sql => {
    await reviewer(sql)
    const rows = await sql.query(`UPDATE "VenuePhotoRelease" SET "contactVerifiedAt"=now(),"verifiedBy"=$2,"verificationNote"=$3 WHERE "photoId"=$1 AND "withdrawnAt" IS NULL AND "contactVerifiedAt" IS NULL RETURNING "photoId"`,[photoId,actorId,note.trim()])
    if (!rows.length) throw new HubError(404,'Active release not found.')
    const [journal] = await sql.query('SELECT id FROM "VenuePhoto" WHERE id=$1', [photoId])
    if (journal) await event(sql,photoId,'RELEASE_CONTACT_VERIFIED')
    return {verified:true}
   })
  },
  async publicationRelease(photoId: string, use: 'venue'|'bioveracity') {
   await reviewer(db)
   const [release] = await db.query(`SELECT r."photoId",r."venueName",r.version,r.wording,r."acceptedAt",p.credit,p.caption,p."hubId" FROM "VenuePhotoRelease" r JOIN ${releasePhotos} p ON p.id=r."photoId" WHERE r."photoId"=$1 AND r."withdrawnAt" IS NULL AND r."contactVerifiedAt" IS NOT NULL AND p.status='PUBLISHED' AND (($2='venue' AND r."venuePublications") OR ($2='bioveracity' AND r."bioPublications"))`,[photoId,use])
   if (!release) throw new HubError(409,'No verified, current permission for this publication use.')
   return release
  },
  async reviewQueue() {
   await reviewer(db)
   return db.query<JournalPhoto & { venueName: string }>(`SELECT ${photoColumns},h."profile"->>'name' AS "venueName" FROM "VenuePhoto" p JOIN "WildHub" h ON h."id"=p."hubId" WHERE p."status"='REVIEW' AND h."ownerId"<>$1 ORDER BY p."createdAt",p."id" LIMIT 50`, [actorId])
  },
  async decide(photoId: string, revision: number, approve: boolean, reason: string) {
   if (!reason.trim()) throw new HubError(400, 'Record your review or requested correction.')
   return db.transaction(async sql => {
    await reviewer(sql)
    const [photo] = await sql.query<JournalPhoto & { ownerId: string }>(`SELECT ${photoColumns},h."ownerId" FROM "VenuePhoto" p JOIN "WildHub" h ON h."id"=p."hubId" WHERE p."id"=$1 FOR UPDATE OF p`, [photoId])
    if (!photo || photo.status !== 'REVIEW' || photo.revision !== revision) throw new HubError(409, 'This photograph changed. Reload the queue.')
    if (photo.ownerId === actorId) throw new HubError(403, 'Another administrator must review your photographs.')
    await sql.query('UPDATE "VenuePhoto" SET "status"=$1,"reason"=$2,"revision"="revision"+1 WHERE "id"=$3', [approve ? 'PUBLISHED' : 'REJECTED',reason,photoId])
    await event(sql, photoId, approve ? 'PUBLISHED' : 'REJECTED', reason)
   })
  },
  async read(photoId: string, mode: 'public'|'owner'|'review') {
   if (mode === 'review') await reviewer(db)
   const clause = mode === 'public' ? `p."status"='PUBLISHED' AND h."published" IS NOT NULL` : mode === 'owner' ? `h."ownerId"=$2 AND p."status"<>'WITHDRAWN'` : `p."status"='REVIEW' AND h."ownerId"<>$2`
   const [photo] = await db.query<JournalPhoto & { bytes: Uint8Array }>(`SELECT ${photoColumns},p."bytes" FROM "VenuePhoto" p JOIN "WildHub" h ON h."id"=p."hubId" WHERE p."id"=$1 AND ${clause}`, mode === 'public' ? [photoId] : [photoId,actorId])
   if (!photo) throw new HubError(404, 'Photograph not found.')
   return mode === 'public' ? {...photo, reason: ''} : photo
  },
 }
}
export async function publicJournal(sql: Sql, hubId: string, year?: string) {
 if (year && !/^\d{4}$/.test(year)) throw new HubError(400, 'Choose a year.')
 return sql.query<JournalPhoto>(`SELECT ${photoColumns.replace('p."reason"', "''::text AS reason")} FROM "VenuePhoto" p JOIN "WildHub" h ON h."id"=p."hubId" WHERE p."hubId"=$1 AND p."status"='PUBLISHED' AND h."published" IS NOT NULL AND ($2::text IS NULL OR left(p."observedOn",4)=$2) ORDER BY p."observedOn" DESC NULLS LAST,p."createdAt" DESC,p."id" LIMIT 200`, [hubId,year || null])
}
