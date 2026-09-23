import { createHash, randomUUID } from 'node:crypto'
import { WorkspaceError, type Database, type Sql } from '../workspaces/service'
import { ownedClub } from '../billing/club-service'
import { epaRecords, planningRecords, planningCovered, watchConfig, type WatchConfig, type SourceRecord, type SourceId } from './sources'

export type Watch = {hubId:string;config:WatchConfig;version:number;enabled:boolean}
export type StoredRecord = {id:string;source:SourceId;sourceKey:string;content:SourceRecord;review:string;firstSeenAt:Date;lastSeenAt:Date;reviewedAt:Date|null}
export type SourceRun = {source:SourceId;status:string;count:number;note:string;checkedAt:Date}
export async function admin(db:Sql,userId:string){
  const rows=await db.query('SELECT id FROM "User" WHERE id=$1 AND (role=\'admin\' OR "accessState"=\'ADMIN\')',[userId])
  if(!rows.length)throw new WorkspaceError(403,'Administrator access required.')
}
export async function configureWatch(db:Database,userId:string,hubId:string,input:unknown,enabled:boolean){
  await admin(db,userId);const config=watchConfig(input)
  return db.transaction(async tx=>{
    const [hub]=await tx.query<{ownerId:string}>('SELECT "ownerId" FROM "WildHub" WHERE id=$1 FOR UPDATE',[hubId])
    if(!hub)throw new WorkspaceError(404,'Club not found.')
    if(hub.ownerId===userId)throw new WorkspaceError(403,'Another administrator must confirm the source area for your own club.')
    const [current]=await tx.query<Watch>('SELECT * FROM "ClubWatch" WHERE "hubId"=$1',[hubId])
    const changed=(!current || JSON.stringify(watchConfig(current.config))!==JSON.stringify(config))
    // Version isolates old records immediately when the geographical scope changes.
    const [row]=await tx.query<Watch>('INSERT INTO "ClubWatch" ("hubId",config,enabled,"configuredBy") VALUES ($1,$2::jsonb,$3,$4) ON CONFLICT ("hubId") DO UPDATE SET config=$2::jsonb,enabled=$3,"configuredBy"=$4,version="ClubWatch".version+$5,"updatedAt"=now() RETURNING *',[hubId,JSON.stringify(config),enabled,userId,changed?1:0])
    return row
  })
}
export async function watchView(db:Sql,hubId:string,options:{userId?:string;public?:boolean;adminId?:string}={}){
  if(options.public){const rows=await db.query('SELECT id FROM "WildHub" WHERE id=$1 AND published IS NOT NULL',[hubId]);if(!rows.length)return null}
  else if(options.adminId)await admin(db,options.adminId)
  else if(options.userId)await ownedClub(db,hubId,options.userId)
  else throw new WorkspaceError(401,'Sign in.')
  const [watch]=await db.query<Watch>('SELECT * FROM "ClubWatch" WHERE "hubId"=$1',[hubId])
  if(!watch || (options.public&&!watch.enabled))return null
  const records=await db.query<StoredRecord>('SELECT id,source,"sourceKey",content,review,"firstSeenAt","lastSeenAt","reviewedAt" FROM "ClubSourceRecord" WHERE "hubId"=$1 AND "configVersion"=$2 AND current=true AND ($3=false OR review=\'APPROVED\') ORDER BY (review=\'PENDING\') DESC,"firstSeenAt" DESC,id LIMIT 200',[hubId,watch.version,Boolean(options.public)])
  const runs=await db.query<SourceRun>('SELECT DISTINCT ON (source) source,status,count,note,"checkedAt" FROM "ClubSourceRun" WHERE "hubId"=$1 AND "configVersion"=$2 ORDER BY source,"checkedAt" DESC,id DESC',[hubId,watch.version])
  return {watch,records,runs}
}
export async function reviewRecord(db:Database,adminId:string,id:string,decision:'APPROVED'|'REJECTED',note:string){
  await admin(db,adminId)
  if(!['APPROVED','REJECTED'].includes(decision)||!note.trim()||note.length>1000)throw new WorkspaceError(400,'Record the source and scope checks in a review note.')
  const rows=await db.query(`UPDATE "ClubSourceRecord" r SET review=$2,"reviewedBy"=$3,"reviewNote"=$4,"reviewedAt"=now() FROM "WildHub" h,"ClubWatch" w WHERE r.id=$1 AND r."hubId"=h.id AND w."hubId"=h.id AND w.version=r."configVersion" AND h."ownerId"<>$3 AND r.current=true AND r.review='PENDING' RETURNING r.id`,[id,decision,adminId,note.trim()])
  if(!rows.length)throw new WorkspaceError(409,'Record changed, was already reviewed, or requires another administrator.')
}
export async function refreshWatch(db:Database,watch:Watch,loaders:{planning:typeof planningRecords;epa:typeof epaRecords}={planning:planningRecords,epa:epaRecords},now=new Date()){
  const results:{source:SourceId;status:string;count:number}[]=[]
  for(const source of ['planning','epa'] as const){
    if(source==='planning' && !planningCovered(watch.config)){
      await db.query('INSERT INTO "ClubSourceRun" (id,"hubId","configVersion",source,status,count,note,"checkedAt") VALUES ($1,$2,$3,$4,\'UNAVAILABLE\',0,$5,$6)',[randomUUID(),watch.hubId,watch.version,source,'Local-authority planning retrieval is not yet available for this area; it is wired for the Dublin pilot only. No claim is made about planning applications here.',now])
      results.push({source,status:'UNAVAILABLE',count:0})
      continue
    }
    try{
      const records=await loaders[source](watch.config)
      if(new Set(records.map(r=>r.key)).size!==records.length)throw Error('Duplicate source identities')
      await db.transaction(async tx=>{
        const [current]=await tx.query<Watch>('SELECT * FROM "ClubWatch" WHERE "hubId"=$1 FOR UPDATE',[watch.hubId])
        if(!current?.enabled || current.version!==watch.version)throw Error('Watch configuration changed')
        for(const content of records){
          const hash=createHash('sha256').update(JSON.stringify(content)).digest('hex')
          const [old]=await tx.query<{id:string;hash:string}>('SELECT id,hash FROM "ClubSourceRecord" WHERE "hubId"=$1 AND "configVersion"=$2 AND source=$3 AND "sourceKey"=$4 AND current=true',[watch.hubId,watch.version,source,content.key])
          if(old?.hash===hash){await tx.query('UPDATE "ClubSourceRecord" SET "lastSeenAt"=$2 WHERE id=$1',[old.id,now]);continue}
          if(old)await tx.query('UPDATE "ClubSourceRecord" SET current=false WHERE id=$1',[old.id])
          await tx.query('INSERT INTO "ClubSourceRecord" (id,"hubId","configVersion",source,"sourceKey",hash,content,"firstSeenAt","lastSeenAt") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$8)',[randomUUID(),watch.hubId,watch.version,source,content.key,hash,JSON.stringify(content),now])
        }
        // Missing records remain in the chronology with their last-seen date;
        // a successful empty retrieval never asserts that nothing exists locally.
        await tx.query('INSERT INTO "ClubSourceRun" (id,"hubId","configVersion",source,status,count,note,"checkedAt") VALUES ($1,$2,$3,$4,\'OK\',$5,$6,$7)',[randomUUID(),watch.hubId,watch.version,source,records.length,source==='planning'?'All pages within the agreed bounds retrieved; records without usable source geometry cannot establish local coverage.':'Published EPA assessment periods retrieved; publication dates are not supplied by this endpoint.',now])
      })
      results.push({source,status:'OK',count:records.length})
    }catch{
      await db.query('INSERT INTO "ClubSourceRun" (id,"hubId","configVersion",source,status,note,"checkedAt") VALUES ($1,$2,$3,$4,\'FAILED\',$5,$6)',[randomUUID(),watch.hubId,watch.version,source,'Retrieval incomplete or source/configuration changed. Previous records retained; no claim of current coverage.',now])
      results.push({source,status:'FAILED',count:0})
    }
  }
  return results
}
export async function weeklyClubSummary(db:Sql,hubId:string,start:Date,end:Date){
  const [watch]=await db.query<Watch>('SELECT w.* FROM "ClubWatch" w JOIN "ClubSubscription" b ON b."hubId"=w."hubId" WHERE w."hubId"=$1 AND w.enabled=true AND b."paidUntil">now()',[hubId])
  if(!watch)return null
  const records=await db.query<StoredRecord>('SELECT id,source,"sourceKey",content,review,"firstSeenAt","lastSeenAt","reviewedAt" FROM "ClubSourceRecord" WHERE "hubId"=$1 AND "configVersion"=$2 AND current=true AND review=\'APPROVED\' AND "reviewedAt">=$3 AND "reviewedAt"<$4 ORDER BY "reviewedAt",id LIMIT 10',[hubId,watch.version,start,end])
  const runs=await db.query<SourceRun>('SELECT DISTINCT ON (source) source,status,count,note,"checkedAt" FROM "ClubSourceRun" WHERE "hubId"=$1 AND "configVersion"=$2 ORDER BY source,"checkedAt" DESC,id DESC',[hubId,watch.version])
  return {scope:watch.config.scopeLabel,records,runs}
}
