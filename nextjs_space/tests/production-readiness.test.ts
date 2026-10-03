import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { identityService, requireLimit, securityIp } from '../lib/account-recovery/security'
import { privacyNotifications, withHeartbeat, operationalStatus } from '../lib/operations/service'
import { migrationPlan } from '../lib/operations/migrations'
import type {Database,Sql} from '../lib/workspaces/service'
async function fixture(){
 const pg=new PGlite()
 await pg.exec(`CREATE TABLE "User" (id TEXT PRIMARY KEY,email TEXT,password TEXT,"emailVerified" TIMESTAMP,"authVersion" INT DEFAULT 0,role TEXT DEFAULT 'user',"accessState" TEXT DEFAULT 'REGISTERED',"updatedAt" TIMESTAMP DEFAULT now()); INSERT INTO "User"(id,email,password) VALUES ('a','a@example.test','hash'),('b','b@example.test','hash'); UPDATE "User" SET role='admin' WHERE id='b';`)
 for(const n of ['20260922_account_recovery','20260925_production_readiness'])await pg.exec(readFileSync(`prisma/migrations/${n}/migration.sql`,'utf8'))
 const sql=(client:Pick<PGlite,'query'>):Sql=>({query:async<T>(q:string,v:unknown[])=>(await client.query<T>(q,v)).rows})
 const db:Database={...sql(pg),transaction:fn=>pg.transaction(tx=>fn(sql(tx)))}
 return {pg,db}
}
test('durable limits survive service instances; untrusted IP headers cannot bypass them',async()=>{
 const f=await fixture();try{
 assert.equal(securityIp(new Request('https://example.test',{headers:{'x-forwarded-for':'spoofed'}}),{}),'untrusted-proxy')
 for(let i=0;i<12;i++)await requireLimit(f.db,'loginEmail','a@example.test')
 await assert.rejects(requireLimit({...f.db},'loginEmail','a@example.test'),/Too many/)
 await requireLimit(f.db,'loginEmail','b@example.test')
 const rows=await f.db.query<{identifierHash:string}>('SELECT "identifierHash" FROM "AuthRateLimit"',[])
 assert.ok(rows.every(r=>!r.identifierHash.includes('@')))
 }finally{await f.pg.close()}
})
test('verification is single-use, hashed, expiring and password reset revokes outstanding codes',async()=>{
 const f=await fixture();let token='',at=new Date('2026-09-22T00:00:00Z')
 const svc=identityService(f.db,{send:async(_,t)=>{token=t},compare:async()=>true,now:()=>at})
 try{
 await svc.issue({email:'a@example.test',ip:'ip',purpose:'VERIFY_EMAIL'})
 const rows=await f.db.query<{tokenHash:string}>('SELECT "tokenHash" FROM "IdentityChallenge"',[]);assert.notEqual(rows[0].tokenHash,token)
 await assert.rejects(svc.verify('invalid','ip'))
 await svc.verify(token,'ip');await assert.rejects(svc.verify(token,'ip'))
 assert.ok((await f.db.query<{emailVerified:Date}>('SELECT "emailVerified" FROM "User" WHERE id=\'a\'',[]))[0].emailVerified)
 await svc.issue({email:'b@example.test',password:'pw',ip:'ip',purpose:'ADMIN_LOGIN'})
 assert.equal(await svc.adminCode(token,'a'),false)
 at=new Date('2026-09-22T00:11:00Z');assert.equal(await svc.adminCode(token,'b'),false)
 await svc.issue({email:'b@example.test',password:'pw',ip:'ip',purpose:'ADMIN_LOGIN'})
 await f.db.query('UPDATE "User" SET "authVersion"=1 WHERE id=\'b\'',[])
 assert.equal(await svc.adminCode(token,'b'),false)
 await svc.issue({email:'b@example.test',password:'pw',ip:'ip',purpose:'ADMIN_LOGIN'})
 assert.equal(await svc.adminCode(token,'b'),true);assert.equal(await svc.adminCode(token,'b'),false)
 }finally{await f.pg.close()}
})
test('unknown accounts and wrong administrator passwords send nothing; failed mail invalidates token',async()=>{
 const f=await fixture();let sent=0,token=''
 try{
 const svc=identityService(f.db,{send:async(_,t)=>{sent++;token=t;throw Error('provider')},compare:async()=>false})
 assert.deepEqual(await svc.issue({email:'missing@example.test',ip:'ip',purpose:'VERIFY_EMAIL'}),{ok:true})
 await svc.issue({email:'b@example.test',password:'wrong',ip:'ip',purpose:'ADMIN_LOGIN'});assert.equal(sent,0)
 await svc.issue({email:'a@example.test',ip:'ip',purpose:'VERIFY_EMAIL'});assert.equal(sent,1)
 await assert.rejects(svc.verify(token,'ip'))
 }finally{await f.pg.close()}
})
test('privacy notifications are private, durable, duplicate-safe, and ambiguous delivery is not retried',async()=>{
 const f=await fixture();try{
 await f.pg.exec(`CREATE TABLE "DataRightsRequest"(id TEXT PRIMARY KEY,"userId" TEXT,status TEXT,"dueAt" TIMESTAMPTZ); CREATE TABLE "DataRightsEvent"(id TEXT,"requestId" TEXT,status TEXT,"createdAt" TIMESTAMPTZ DEFAULT now()); CREATE TABLE "VenuePhotoDigest"(status TEXT,"createdAt" TIMESTAMPTZ DEFAULT now()); INSERT INTO "DataRightsRequest" VALUES ('request','a','IN_REVIEW','2026-09-01'); INSERT INTO "DataRightsEvent" VALUES ('event','request','IN_REVIEW',now());`)
 const messages:any[]=[];const send=async(m:any)=>{messages.push(m);if(m.to==='a@example.test')throw Error('timeout')}
 const args=['https://example.test','operator@example.test',new Date('2026-09-22')] as const
 assert.deepEqual(await privacyNotifications(f.db,send,...args),['SENT','UNKNOWN'])
 await privacyNotifications(f.db,send,...args);assert.equal(messages.length,2)
 assert.ok(!messages[0].text.includes('a@example.test'))
 const status=await operationalStatus(f.db,['privacy-notifications']);assert.equal(status.ok,false);assert.equal(status.overdueRequests,1);assert.equal(status.ambiguousDeliveries,1)
 await assert.rejects(withHeartbeat(f.db,'fixture',async()=>{throw Error('failure')}))
 assert.equal((await f.db.query<{status:string}>("SELECT status FROM \"JobHeartbeat\" WHERE name='fixture'",[]))[0].status,'FAILED')
 await withHeartbeat(f.db,'fixture',async()=>1)
 await f.db.query("UPDATE \"JobHeartbeat\" SET status='RUNNING' WHERE name='fixture'",[])
 await assert.rejects(withHeartbeat(f.db,'fixture',async()=>1),/already running/)
 }finally{await f.pg.close()}
})
test('migration plans separate evidence from application and repair historical dependency ordering',()=>{
 const app=migrationPlan('prisma/migrations','application').map(m=>m.name)
 assert.ok(app.indexOf('20260909_private_workspace_foundation')<app.indexOf('20260909_private_case_files'))
 assert.ok(!app.includes('0003_biodiversity_safeguards'))
 assert.ok(migrationPlan('prisma/migrations','evidence').every(m=>m.name.startsWith('000')))
})
test('application migrations install private workspace dependencies into an empty database',async()=>{
 const pg=new PGlite();try{
 const plan=migrationPlan('prisma/migrations','application')
 for(const m of plan){if(m.name==='20260915_ellona_opportunity_watch')break;await pg.exec(m.sql)}
 const result=await pg.query("SELECT to_regclass('\"PrivateCaseDocument\"') AS table_name")
 assert.equal(result.rows.length,1);assert.ok((result.rows[0] as any).table_name)
 }finally{await pg.close()}
})

test('verification cannot confirm an address changed after token issuance',async()=>{
 const f=await fixture();let token=''
 try{
  const svc=identityService(f.db,{send:async(_,t)=>{token=t},compare:async()=>true})
  await svc.issue({email:'a@example.test',ip:'ip',purpose:'VERIFY_EMAIL'})
  await f.db.query('UPDATE "User" SET email=$1 WHERE id=$2',['changed@example.test','a'])
  await assert.rejects(svc.verify(token,'ip'))
 }finally{await f.pg.close()}
})
