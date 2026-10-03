import { randomUUID } from 'node:crypto'
import type { Database } from '../workspaces/service'
import type { EmailMessage } from '../email/transactional'
import { completedWeek, hashToken, newToken, photoColumns, type JournalPhoto } from './domain'
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export function renderDigest(input: { venue: string; origin: string; hubId: string; digestId: string; token: string; start: Date; end: Date; photos: JournalPhoto[]; total: number }) {
 const { venue, origin, hubId, digestId, token, start, end, photos, total } = input
 const reviewUrl = `${origin}/wild/studio/${encodeURIComponent(hubId)}/photos`
 const date = (d: Date) => d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
 const period = `${date(start)} – ${date(new Date(end.getTime()-1))}`
 const title = `${venue}: your week in photographs`
 const intro = total ? `${total} photograph${total===1?'':'s'} added to your place’s record this week.` : 'No new photographs were contributed this week. Your existing record is ready to revisit.'
 const frame = (p: JournalPhoto, width: number) => `<img width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto" alt="${escape(p.caption)}" src="${origin}/api/wild/journal/email/${digestId}/${p.id}?token=${token}"><p style="font-size:16px;margin:12px 0 6px">${escape(p.caption)}</p><p style="font-size:12px;line-height:1.6;margin:0">${escape(p.credit)} · ${escape(p.location)}<br>${p.observedOn ? `Taken ${escape(p.observedOn)}` : 'Date taken unknown'}</p>`
 const lead = photos[0] ? `<tr><td style="padding:20px 0 28px">${frame(photos[0], 544)}</td></tr>` : ''
 const supporting = photos.slice(1)
 const rows: string[] = []
 for (let i = 0; i < supporting.length; i += 2) {
  rows.push(`<tr><td width="50%" valign="top" style="padding:0 10px 24px 0">${frame(supporting[i], 262)}</td>${supporting[i + 1] ? `<td width="50%" valign="top" style="padding:0 0 24px 10px">${frame(supporting[i + 1], 262)}</td>` : '<td width="50%"></td>'}</tr>`)
 }
 const cards = `${lead}${rows.length ? `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed">${rows.join('')}</table></td></tr>` : ''}`
 return {
  subject: title,
  html: `<html><body style="margin:0;background:#f6f2e8;color:#173b2c;font-family:Arial,sans-serif"><table role="presentation" style="max-width:600px;width:100%;margin:auto;padding:28px"><tr><td><p>BioVeracity</p><h1>Your place. Through their eyes.</h1><h2>${escape(venue)}</h2><p>${period}</p><p>${intro}</p></td></tr>${cards}<tr><td>${total>photos.length?`<p>Showing ${photos.length} of ${total}. See all photographs in your journal.</p>`:''}<p><a style="display:inline-block;padding:14px;background:#173b2c;color:#fff" href="${reviewUrl}">Review photographs · Publish or download</a></p><p>Choose photographs for your public page, subject to editorial review, or download them with their credits. Nothing is published by this email.</p><p>These are guest observations, not verified species identifications. A missing photograph is not proof of absence.</p><p>Private previews expire after eight days. Sign in to revisit your full journal.</p><p><a href="${reviewUrl}#preferences">Manage weekly email</a></p></td></tr></table></body></html>`,
  text: `${title}\n${period}\n${intro}\n\n${photos.map(p=>`${p.caption} — ${p.credit}; ${p.location}; taken ${p.observedOn || 'date unknown'}`).join('\n')}\n\nReview, publish or download: ${reviewUrl}\nPublication requires your approval and editorial review.\nManage weekly email: ${reviewUrl}#preferences`,
 }
}
// Durable claim before delivery. Never blindly retry ambiguous provider responses:
// a timeout may have happened AFTER the provider accepted the message.
export async function sendWeeklyDigests(db: Database, send: (m: EmailMessage)=>Promise<void>, origin: string, now = new Date()) {
 const url = new URL(origin)
 if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('An HTTPS application origin is required.')
 origin = url.origin
 const { start, end } = completedWeek(now)
 const venues = await db.query<{ id: string; ownerId: string; email: string; name: string }>(`SELECT h."id",h."ownerId",u."email",h."profile"->>'name' AS name FROM "WildHub" h JOIN "User" u ON u."id"=h."ownerId" JOIN "VenuePhotoSettings" s ON s."hubId"=h."id" WHERE s."weeklyEnabled"=true AND u."email" IS NOT NULL AND COALESCE((SELECT a."weeklyDigest" FROM "AttentionPreference" a WHERE a."userId"=u."id" AND a."scopeKey"='GLOBAL'),true)=true ORDER BY h."id"`, [])
 const results: { hubId: string; status: string }[] = []
 for (const venue of venues) {
  const id = randomUUID(), token = newToken()
  const claimed = await db.transaction(async sql => {
   // Recheck settings and identity under the venue lock before each delivery.
   await sql.query('SELECT "id" FROM "WildHub" WHERE "id"=$1 FOR UPDATE', [venue.id])
   const [eligible] = await sql.query<{ id: string }>(`SELECT h."id" FROM "WildHub" h JOIN "User" u ON u."id"=h."ownerId" JOIN "VenuePhotoSettings" s ON s."hubId"=h."id" WHERE h."id"=$1 AND h."ownerId"=$2 AND u."email"=$3 AND s."weeklyEnabled"=true AND COALESCE((SELECT "weeklyDigest" FROM "AttentionPreference" WHERE "userId"=$2 AND "scopeKey"='GLOBAL'),true)=true`, [venue.id,venue.ownerId,venue.email])
   if (!eligible) return null
   const photos = await sql.query<JournalPhoto>(`SELECT ${photoColumns} FROM "VenuePhoto" p WHERE p."hubId"=$1 AND p."createdAt">=$2 AND p."createdAt"<$3 AND p."status" NOT IN ('WITHDRAWN','REJECTED') ORDER BY p."createdAt",p."id" LIMIT 200`, [venue.id,start,end])
   const preview = photos.slice(0,12)
   const rows = await sql.query<{ id: string }>('INSERT INTO "VenuePhotoDigest" ("id","hubId","ownerId","emailHash","weekStart","status","tokenHash","photoIds","expiresAt") VALUES ($1,$2,$3,$4,$5,\'SENDING\',$6,$7::jsonb,$8) ON CONFLICT ("hubId","weekStart") DO NOTHING RETURNING "id"', [id,venue.id,venue.ownerId,hashToken(venue.email),start,hashToken(token),JSON.stringify(preview.map(p=>p.id)),new Date(now.getTime()+8*86400000)])
   return rows.length ? { photos: preview, total: photos.length } : null
  })
  if (!claimed) { results.push({hubId:venue.id,status:'SKIPPED'}); continue }
  try {
   await send({ to: venue.email, ...renderDigest({venue:venue.name,origin,hubId:venue.id,digestId:id,token,start,end,...claimed}) })
   await db.query('UPDATE "VenuePhotoDigest" SET "status"=\'SENT\',"sentAt"=$2 WHERE "id"=$1', [id,now])
   results.push({hubId:venue.id,status:'SENT'})
  } catch {
   await db.query('UPDATE "VenuePhotoDigest" SET "status"=\'UNKNOWN\' WHERE "id"=$1', [id])
   results.push({hubId:venue.id,status:'UNKNOWN'})
  }
 }
 return results
}
export async function emailPhoto(db: Database, digestId: string, photoId: string, token: string, now = new Date()) {
 if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null
 const [row] = await db.query<{ bytes: Uint8Array; emailHash: string; email: string }>(`SELECT p."bytes",d."emailHash",u."email" FROM "VenuePhotoDigest" d JOIN "VenuePhoto" p ON p."hubId"=d."hubId" JOIN "WildHub" h ON h."id"=d."hubId" JOIN "User" u ON u."id"=h."ownerId" JOIN "VenuePhotoSettings" s ON s."hubId"=h."id" WHERE d."id"=$1 AND p."id"=$2 AND d."tokenHash"=$3 AND d."expiresAt">$4 AND d."status" IN ('SENT','SENDING') AND d."photoIds" ? p."id" AND h."ownerId"=d."ownerId" AND s."weeklyEnabled"=true AND COALESCE((SELECT "weeklyDigest" FROM "AttentionPreference" WHERE "userId"=h."ownerId" AND "scopeKey"='GLOBAL'),true)=true AND p."status" NOT IN ('WITHDRAWN','REJECTED')`, [digestId,photoId,hashToken(token),now])
 return row && row.email && hashToken(row.email) === row.emailHash ? row.bytes : null
}
