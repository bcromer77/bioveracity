import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { WorkspaceError, permits, type Database, type Sql, type Action } from './service'
import type { ParsedFile } from './parser'
import { proposedDate, PARSER_VERSION } from './parse-file.mjs'

export function cipher(keyHex: string) {
  if (!/^[a-f\d]{64}$/i.test(keyHex)) throw new WorkspaceError(503, 'Private evidence encryption is not configured')
  const key = Buffer.from(keyHex, 'hex')
  return {
    encrypt(bytes: Buffer, context: string) { const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from(context)); const data = Buffer.concat([c.update(bytes), c.final()]); return Buffer.concat([iv, c.getAuthTag(), data]) },
    decrypt(bytes: Uint8Array, context: string) { const b = Buffer.from(bytes); const c = createDecipheriv('aes-256-gcm', key, b.subarray(0,12)); c.setAAD(Buffer.from(context)); c.setAuthTag(b.subarray(12,28)); return Buffer.concat([c.update(b.subarray(28)), c.final()]) },
  }
}
export function reviewedDate(date: unknown, precision: unknown) {
  if (precision === 'UNKNOWN' && (date === null || date === '')) return null
  if (typeof date !== 'string') throw new WorkspaceError(400, 'Supply date with its stated precision')
  const patterns: Record<string, RegExp> = { YEAR: /^\d{4}$/, MONTH: /^\d{4}-(0[1-9]|1[0-2])$/, DAY: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/ }
  if (!patterns[String(precision)]?.test(date)) throw new WorkspaceError(400, 'Date does not match precision')
  if (precision === 'DAY' && new Date(date + 'T00:00:00Z').toISOString().slice(0,10) !== date) throw new WorkspaceError(400, 'Invalid calendar date')
  return date
}
const missing = () => new WorkspaceError(404, 'Workspace or case unavailable')
export type EventRow = { id: string; passageId: string; documentId: string; name: string; hash: string; locator: string; sourceUrl: string | null; publicationDate: string | null; importedAt: Date; revision: number; title: string; quote: string; eventDate: string | null; precision: string; status: string; evidenceType: string; note: string; reviewedBy: string | null; superseded: boolean }
const eventQuery = `SELECT e.id,e."passageId",p."documentId",d.name,d.hash,p.locator,d."sourceUrl",d."publicationDate",d."importedAt",d."parserVersion",r.*,
 EXISTS (SELECT 1 FROM "PrivateCaseDocument" newer WHERE newer."workspaceId"=d."workspaceId" AND newer."caseId"=d."caseId" AND newer."supersedesId"=d.id) AS superseded
 FROM "PrivateCaseEvent" e JOIN "PrivateCasePassage" p ON p.id=e."passageId" JOIN "PrivateCaseDocument" d ON d.id=p."documentId"
 JOIN LATERAL (SELECT * FROM "PrivateCaseEventRevision" WHERE "eventId"=e.id ORDER BY revision DESC LIMIT 1) r ON true
 WHERE e."workspaceId"=$1 AND e."caseId"=$2 ORDER BY r."eventDate" ASC NULLS LAST,e.id`;
export function caseFiles(db: Database, actor: string, keyHex: string) {
  if (!actor) throw new WorkspaceError(401, 'Authentication required')
  const vault = cipher(keyHex)
  async function access(tx: Sql, w: string, c: string, action: Action) {
    const rows = await tx.query<{ role: string; canExport: boolean }>(`SELECT cm.role,cm."canExport" FROM "PrivateCaseMember" cm JOIN "PrivateWorkspaceMember" wm ON wm."workspaceId"=cm."workspaceId" AND wm."userId"=cm."userId" WHERE cm."workspaceId"=$1 AND cm."caseId"=$2 AND cm."userId"=$3 AND cm."revokedAt" IS NULL AND wm."revokedAt" IS NULL AND wm.role IN ('OWNER','CONTRIBUTOR','REVIEWER','VIEWER') FOR SHARE OF cm,wm`, [w,c,actor])
    if (!rows[0] || !permits(rows[0].role, action, rows[0].canExport)) throw missing()
  }
  async function audit(tx: Sql, w: string, c: string, action: string) { await tx.query('INSERT INTO "PrivateWorkspaceAudit" (id,"workspaceId","caseId","actorId",action) VALUES ($1,$2,$3,$4,$5)', [randomUUID(),w,c,actor,action]) }
  return {
    async check(w: string, c: string, action: Action = 'read') { return db.transaction(tx => access(tx,w,c,action)) },
    async import(w: string, c: string, parsed: ParsedFile, options: { sourceUrl?: string; publicationDate?: string; supersedesId?: string } = {}) {
      return db.transaction(async tx => {
        await access(tx,w,c,'write')
        // Serialize imports per case so quotas and duplicate detection are race safe.
        await tx.query('SELECT id FROM "PrivateCase" WHERE "workspaceId"=$1 AND id=$2 FOR UPDATE', [w,c])
        const [duplicate] = await tx.query<{id:string;sourceUrl:string|null;publicationDate:string|null;supersedesId:string|null}>('SELECT id,"sourceUrl","publicationDate","supersedesId" FROM "PrivateCaseDocument" WHERE "workspaceId"=$1 AND "caseId"=$2 AND hash=$3', [w,c,parsed.hash])
        if (duplicate) {
          if((options.sourceUrl&&options.sourceUrl!==duplicate.sourceUrl)||(options.publicationDate&&options.publicationDate!==duplicate.publicationDate)||(options.supersedesId&&options.supersedesId!==duplicate.supersedesId))throw new WorkspaceError(409,'Identical bytes already exist with different metadata. No amendment or metadata change was applied.')
          return { documentId: duplicate.id, duplicate: true }
        }
        if (options.sourceUrl) { const u = new URL(options.sourceUrl); if (!['https:','http:'].includes(u.protocol) || u.username || u.password || options.sourceUrl.length > 2000) throw new WorkspaceError(400,'Invalid source URL'); }
        if (options.publicationDate) reviewedDate(options.publicationDate, options.publicationDate.length===4?'YEAR':options.publicationDate.length===7?'MONTH':'DAY')
        if (options.supersedesId && !(await tx.query('SELECT id FROM "PrivateCaseDocument" WHERE "workspaceId"=$1 AND "caseId"=$2 AND id=$3',[w,c,options.supersedesId])).length) throw missing()
        const all: ParsedFile[] = []; const gather = (p:ParsedFile) => { all.push(p); p.children.forEach(gather) }; gather(parsed)
        const totalBytes = all.reduce((n,p)=>n+Buffer.from(p.bytes,'base64').length,0)
        const [quota] = await tx.query<{count:number;size:number}>('SELECT count(*)::int AS count,COALESCE(sum("byteLength"),0)::int AS size FROM "PrivateCaseDocument" WHERE "workspaceId"=$1 AND "caseId"=$2',[w,c])
        if (quota.count + all.length > 100 || quota.size + totalBytes > 50 * 1024 * 1024) throw new WorkspaceError(413,'Case limit: 100 documents / 50 MiB')
        const [passageCount]=await tx.query<{count:number}>('SELECT count(*)::int AS count FROM "PrivateCasePassage" WHERE "workspaceId"=$1 AND "caseId"=$2',[w,c])
        if(passageCount.count+all.reduce((n,p)=>n+p.passages.length,0)>1500)throw new WorkspaceError(413,'Case limit: 1,500 extracted passages')
        async function save(p:ParsedFile,parent:string|null):Promise<string> {
          const existing = await tx.query<{id:string}>('SELECT id FROM "PrivateCaseDocument" WHERE "workspaceId"=$1 AND "caseId"=$2 AND hash=$3',[w,c,p.hash])
          if (existing[0]) return existing[0].id
          const id=randomUUID(), bytes=Buffer.from(p.bytes,'base64')
          if (createHash('sha256').update(bytes).digest('hex') !== p.hash) throw new WorkspaceError(422,'Original integrity check failed')
          await tx.query(`INSERT INTO "PrivateCaseDocument" (id,"workspaceId","caseId",name,hash,"encryptedBytes","byteLength","mediaType",status,metadata,warnings,"parentId","supersedesId","sourceUrl","publicationDate","parserVersion","importedBy") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17)`,[id,w,c,p.name,p.hash,vault.encrypt(bytes,`${w}/${c}/${id}`),bytes.length,p.mediaType,p.status,JSON.stringify(p.metadata),JSON.stringify(p.warnings),parent,parent?null:options.supersedesId??null,parent?null:options.sourceUrl??null,parent?null:options.publicationDate??null,PARSER_VERSION,actor])
          for (const [ordinal, passage] of p.passages.entries()) {
            const pid=randomUUID(), eid=randomUUID(), proposed=proposedDate(passage.text)
            await tx.query('INSERT INTO "PrivateCasePassage" (id,"workspaceId","caseId","documentId",ordinal,locator,text) VALUES ($1,$2,$3,$4,$5,$6,$7)',[pid,w,c,id,ordinal,passage.locator,passage.text])
            await tx.query('INSERT INTO "PrivateCaseEvent" (id,"workspaceId","caseId","passageId") VALUES ($1,$2,$3,$4)',[eid,w,c,pid])
            await tx.query('INSERT INTO "PrivateCaseEventRevision" ("eventId",revision,title,quote,"eventDate",precision,status) VALUES ($1,1,$2,$3,$4,$5,\'DRAFT\')',[eid,passage.text.slice(0,120),passage.text.slice(0,500),proposed.date,proposed.precision])
          }
          const attachmentDocumentIds:string[]=[]
          for (const child of p.children) attachmentDocumentIds.push(await save(child,id))
          if(attachmentDocumentIds.length) await tx.query('UPDATE "PrivateCaseDocument" SET metadata=metadata || $2::jsonb WHERE id=$1',[id,JSON.stringify({attachmentDocumentIds})])
          return id
        }
        const documentId=await save(parsed,null); await audit(tx,w,c,'DOCUMENT_IMPORTED'); return {documentId,duplicate:false}
      })
    },
    async list(w:string,c:string) { return db.transaction(async tx=>{await access(tx,w,c,'read'); return {documents:await tx.query('SELECT id,name,hash,"mediaType",status,warnings,metadata,"parentId","supersedesId","sourceUrl","publicationDate","importedAt","parserVersion" FROM "PrivateCaseDocument" WHERE "workspaceId"=$1 AND "caseId"=$2 ORDER BY "importedAt",id',[w,c]),events:await tx.query<EventRow>(eventQuery,[w,c])} }) },
    async passage(w:string,c:string,id:string) {return db.transaction(async tx=>{await access(tx,w,c,'read');const [p]=await tx.query('SELECT id,"documentId",locator,text FROM "PrivateCasePassage" WHERE "workspaceId"=$1 AND "caseId"=$2 AND id=$3',[w,c,id]);if(!p)throw missing();return p})},
    async history(w:string,c:string,id:string) {return db.transaction(async tx=>{await access(tx,w,c,'read');if(!(await tx.query('SELECT id FROM "PrivateCaseEvent" WHERE "workspaceId"=$1 AND "caseId"=$2 AND id=$3',[w,c,id])).length)throw missing();return tx.query('SELECT revision,title,quote,"eventDate",precision,status,"evidenceType",note,"reviewedBy","createdAt" FROM "PrivateCaseEventRevision" WHERE "eventId"=$1 ORDER BY revision DESC',[id])})},
    async original(w:string,c:string,id:string) {return db.transaction(async tx=>{await access(tx,w,c,'read');const [d]=await tx.query<{encryptedBytes:Uint8Array;name:string;hash:string}>('SELECT "encryptedBytes",name,hash FROM "PrivateCaseDocument" WHERE "workspaceId"=$1 AND "caseId"=$2 AND id=$3',[w,c,id]);if(!d)throw missing();const bytes=vault.decrypt(d.encryptedBytes,`${w}/${c}/${id}`);if(createHash('sha256').update(bytes).digest('hex')!==d.hash)throw new Error('Integrity');await audit(tx,w,c,'ORIGINAL_DOWNLOADED');return {bytes,name:d.name}})},
    async review(w:string,c:string,id:string,input:Record<string,unknown>) {return db.transaction(async tx=>{
      await access(tx,w,c,'review')
      const [e]=await tx.query<{text:string}>('SELECT p.text FROM "PrivateCaseEvent" e JOIN "PrivateCasePassage" p ON p.id=e."passageId" WHERE e."workspaceId"=$1 AND e."caseId"=$2 AND e.id=$3 FOR UPDATE OF e',[w,c,id]); if(!e)throw missing()
      const [r]=await tx.query<{revision:number}>('SELECT revision FROM "PrivateCaseEventRevision" WHERE "eventId"=$1 ORDER BY revision DESC LIMIT 1',[id]);if(input.revision!==r.revision)throw new WorkspaceError(409,'This event changed. Reload before reviewing.')
      const {title,quote,status,precision,evidenceType,note}=input; const date=reviewedDate(input.eventDate,precision)
      if(typeof title!=='string'||!title.trim()||title.length>300||typeof quote!=='string'||!quote.trim()||quote.length>2400||!e.text.includes(quote)||!['ACCEPTED','REJECTED','DRAFT'].includes(String(status))||!['SOURCE_STATEMENT','REGULATOR_FINDING','MEASUREMENT','COMMUNITY_OBSERVATION','INFERENCE'].includes(String(evidenceType))||typeof note!=='string'||note.length>2000)throw new WorkspaceError(400,'Review needs a title, exact source quote and valid status/type')
      await tx.query('INSERT INTO "PrivateCaseEventRevision" ("eventId",revision,title,quote,"eventDate",precision,status,"evidenceType",note,"reviewedBy") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,r.revision+1,title.trim(),quote,date,precision,status,evidenceType,note,actor]);await audit(tx,w,c,'EVENT_REVIEWED');return {revision:r.revision+1}
    })},
    async search(w:string,c:string,q:string,earlier=false) {return db.transaction(async tx=>{
      await access(tx,w,c,'read');if(!q.trim()||q.length>160)throw new WorkspaceError(400,'Enter 1–160 search characters')
      // Membership filtering is in the SQL query, not applied to returned snippets.
      return tx.query(`SELECT p.id,p."caseId",p."documentId",p.locator,p.text,d.name,c.title AS "caseTitle" FROM "PrivateCasePassage" p JOIN "PrivateCaseDocument" d ON d.id=p."documentId" JOIN "PrivateCase" c ON c.id=p."caseId" JOIN "PrivateCaseMember" m ON m."workspaceId"=p."workspaceId" AND m."caseId"=p."caseId" AND m."userId"=$3 WHERE p."workspaceId"=$1 AND ($5::boolean OR p."caseId"=$2) AND m."revokedAt" IS NULL AND m.role IN ('OWNER','CONTRIBUTOR','REVIEWER','VIEWER') AND position(lower($4) in lower(p.text))>0 ORDER BY p."caseId",p."documentId",p.ordinal LIMIT 50`,[w,c,actor,q.trim(),earlier])
    })},
    async setExport(w:string,c:string,enabled:boolean) {return db.transaction(async tx=>{
      await access(tx,w,c,'read');const rows=await tx.query('SELECT role FROM "PrivateCaseMember" WHERE "workspaceId"=$1 AND "caseId"=$2 AND "userId"=$3 AND role=\'OWNER\' AND "revokedAt" IS NULL FOR UPDATE',[w,c,actor]);if(!rows.length)throw missing();await tx.query('UPDATE "PrivateCaseMember" SET "canExport"=$4 WHERE "workspaceId"=$1 AND "caseId"=$2 AND "userId"=$3',[w,c,actor,enabled]);await audit(tx,w,c,enabled?'OWNER_EXPORT_ENABLED':'OWNER_EXPORT_DISABLED');return {enabled}
    })},
    async export(w:string,c:string,render:(data:Record<string,unknown>)=>Promise<Buffer>) {return db.transaction(async tx=>{
      await access(tx,w,c,'export');const [caseRecord]=await tx.query('SELECT id,title,template FROM "PrivateCase" WHERE "workspaceId"=$1 AND id=$2 FOR UPDATE',[w,c]);const allEvents=await tx.query<EventRow>(eventQuery,[w,c]);const events=allEvents.filter(x=>x.status==='ACCEPTED');if(!events.length)throw new WorkspaceError(400,'Accept at least one source-linked event before exporting');if(events.length>400)throw new WorkspaceError(413,'Maximum 400 reviewed entries per export')
      const [exports]=await tx.query<{count:number}>('SELECT count(*)::int AS count FROM "PrivateCaseExport" WHERE "workspaceId"=$1 AND "caseId"=$2',[w,c]);if(exports.count>=20)throw new WorkspaceError(413,'Case export retention limit reached; administrator review required')
      const id=randomUUID(); const manifest={version:1,rendererVersion:'case-renderer/1',exportId:id,workspaceId:w,caseId:c,case:caseRecord,createdAt:new Date().toISOString(),requestedBy:actor,filter:'ACCEPTED only; all dates, including unknown',events,excluded:allEvents.filter(x=>x.status!=='ACCEPTED').map(x=>({id:x.id,revision:x.revision,status:x.status})),notice:'Reviewed representation of sources, not verification of allegations or legal admissibility. Superseded records remain labelled. No originals attached.'};const bytes=await render(manifest);if(bytes.length>5*1024*1024)throw new WorkspaceError(413,'Export exceeds size limit');const hash=createHash('sha256').update(bytes).digest('hex')
      await tx.query('INSERT INTO "PrivateCaseExport" (id,"workspaceId","caseId","requestedBy","encryptedBytes",hash,manifest) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)',[id,w,c,actor,vault.encrypt(bytes,`export/${w}/${c}/${id}`),hash,JSON.stringify(manifest)]);await audit(tx,w,c,'CASE_EXPORTED');return {id,hash}
    })},
    async downloadExport(w:string,c:string,id:string,manifestOnly=false) {return db.transaction(async tx=>{
      await access(tx,w,c,'export');const [x]=await tx.query<{encryptedBytes:Uint8Array;hash:string;manifest:Record<string,unknown>}>('SELECT "encryptedBytes",hash,manifest FROM "PrivateCaseExport" WHERE id=$1 AND "workspaceId"=$2 AND "caseId"=$3 AND "requestedBy"=$4',[id,w,c,actor]);if(!x)throw missing();const bytes=vault.decrypt(x.encryptedBytes,`export/${w}/${c}/${id}`);if(createHash('sha256').update(bytes).digest('hex')!==x.hash)throw new Error('Integrity');return {bytes:manifestOnly?Buffer.from(JSON.stringify({...x.manifest,artifactSha256:x.hash},null,2)):bytes}
    })},
  }
}
