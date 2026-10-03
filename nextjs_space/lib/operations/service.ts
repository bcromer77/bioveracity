import { createHash } from 'node:crypto'
import type { Sql } from '../workspaces/service'
import type { EmailMessage } from '../email/transactional'

export async function deliverOnce(db: Sql, key: string, message: EmailMessage, send:(m:EmailMessage)=>Promise<void>) {
 const claimed=await db.query('INSERT INTO "OperationalDelivery" (key,status) VALUES ($1,\'SENDING\') ON CONFLICT (key) DO NOTHING RETURNING key',[key])
 if(!claimed.length)return 'SKIPPED'
 try {await send(message);await db.query('UPDATE "OperationalDelivery" SET status=\'SENT\',"finishedAt"=now() WHERE key=$1',[key]);return 'SENT'}
 catch {await db.query('UPDATE "OperationalDelivery" SET status=\'UNKNOWN\',"finishedAt"=now() WHERE key=$1',[key]);return 'UNKNOWN'}
}
export async function withHeartbeat<T>(db:Sql,name:string,work:()=>Promise<T>):Promise<T> {
 const rows=await db.query(`INSERT INTO "JobHeartbeat" (name,status,"startedAt") VALUES ($1,'RUNNING',now())
 ON CONFLICT(name) DO UPDATE SET status='RUNNING',"startedAt"=now(),"finishedAt"=NULL
 WHERE "JobHeartbeat".status<>'RUNNING' RETURNING name`,[name])
 if(!rows.length)throw Error('Job already running or requires recovery after interruption')
 try {const result=await work();await db.query('UPDATE "JobHeartbeat" SET status=\'SUCCEEDED\',"finishedAt"=now() WHERE name=$1',[name]);return result}
 catch(error){await db.query('UPDATE "JobHeartbeat" SET status=\'FAILED\',"finishedAt"=now() WHERE name=$1',[name]);throw error}
}
export async function operationalStatus(db:Sql, expected:string[], now=new Date()) {
 const rows=await db.query<{name:string;status:string;startedAt:Date;finishedAt:Date|null}>('SELECT * FROM "JobHeartbeat"',[])
 const jobs=expected.map(name=>{const row=rows.find(r=>r.name===name);const maxAge=name==='venue-photo-digest'?8*86400000:26*3600000;return {name,healthy:Boolean(row?.status==='SUCCEEDED'&&row.finishedAt&&now.getTime()-new Date(row.finishedAt).getTime()<maxAge)}})
 const [deliveries]=await db.query<{count:string}>(`SELECT count(*) FROM "OperationalDelivery" WHERE status='UNKNOWN' OR (status='SENDING' AND "startedAt"<now()-interval '30 minutes')`,[])
 const [rights]=await db.query<{overdue:string;dueSoon:string}>(`SELECT count(*) FILTER (WHERE "dueAt"<=$1) AS overdue,count(*) FILTER (WHERE "dueAt">$1 AND "dueAt"<=$1+interval '7 days') AS "dueSoon" FROM "DataRightsRequest" WHERE status IN ('RECEIVED','IN_REVIEW')`,[now])
 const [digests]=await db.query<{count:string}>(`SELECT count(*) FROM "VenuePhotoDigest" WHERE status='UNKNOWN' OR (status='SENDING' AND "createdAt"<now()-interval '30 minutes')`,[])
 return {ok:jobs.every(j=>j.healthy)&&Number(deliveries.count)===0&&Number(rights.overdue)===0&&Number(digests.count)===0,jobs,ambiguousDeliveries:Number(deliveries.count)+Number(digests.count),overdueRequests:Number(rights.overdue),requestsDueSoon:Number(rights.dueSoon)}
}
export async function privacyNotifications(db:Sql,send:(m:EmailMessage)=>Promise<void>,origin:string,operator:string,now=new Date()) {
 const url=new URL(origin)
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('HTTPS application origin required')
 if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(operator))throw Error('Privacy operator address required')
 const outcomes:string[]=[]
 const [counts]=await db.query<{open:string;overdue:string;dueSoon:string}>(`SELECT count(*) AS open,count(*) FILTER(WHERE "dueAt"<=$1) AS overdue,count(*) FILTER(WHERE "dueAt">$1 AND "dueAt"<=$1+interval '7 days') AS "dueSoon" FROM "DataRightsRequest" WHERE status IN ('RECEIVED','IN_REVIEW')`,[now])
 if(Number(counts.open)>0){
  const text=`Data requests: ${counts.open} open, ${counts.overdue} overdue, ${counts.dueSoon} due within seven days. Review securely at ${url.origin}/admin/data-rights. No personal details are included in this email.`
  outcomes.push(await deliverOnce(db,`privacy-summary:${now.toISOString().slice(0,10)}:${createHash('sha256').update(operator).digest('hex')}`,{to:operator,subject:'BioVeracity data requests need review',text,html:`<p>${text}</p>`},send))
 }
 // Notify users of recorded responses without exposing the response or request content by email.
 const events=await db.query<{id:string;email:string}>(`SELECT e.id,u.email FROM "DataRightsEvent" e JOIN "DataRightsRequest" r ON r.id=e."requestId" JOIN "User" u ON u.id=r."userId" LEFT JOIN "OperationalDelivery" d ON d.key='privacy-response:'||e.id WHERE e.status<>'RECEIVED' AND d.key IS NULL ORDER BY e."createdAt" LIMIT 100`,[])
 for(const event of events){const text=`There is an update to your BioVeracity data request. Sign in at ${url.origin}/account to read it.`;outcomes.push(await deliverOnce(db,`privacy-response:${event.id}`,{to:event.email,subject:'Update to your BioVeracity data request',text,html:`<p>${text}</p>`},send))}
 return outcomes
}
