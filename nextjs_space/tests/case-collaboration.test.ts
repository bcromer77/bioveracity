import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {workspaceService,WorkspaceError,type Database,type Sql} from '../lib/workspaces/service'
import {institutionalInviteService,invitationAcceptanceService} from '../lib/workspaces/invitations'
import {collaborationService} from '../lib/workspaces/collaboration'
import {caseFiles} from '../lib/workspaces/case-files'
import {parseFile} from '../lib/workspaces/parse-file.mjs'
import {renderCase} from '../lib/workspaces/render-case'
test('case owner can revoke an accepted reviewer across sources, search and retained reports without affecting another case',async()=>{
 const pg=new PGlite()
 try{
 await pg.exec(`CREATE TABLE "User"(id TEXT PRIMARY KEY,email TEXT UNIQUE,name TEXT);INSERT INTO "User" VALUES ('owner','owner@example.test','Owner'),('reviewer','reviewer@example.test','Reviewer'),('other','other@example.test','Other');`)
 for(const n of ['20260909_private_workspace_foundation','20260909_private_case_files','20260911_workspace_persona','20260919_institutional_arrival'])await pg.exec(readFileSync(`prisma/migrations/${n}/migration.sql`,'utf8'))
 const sql=(client:Pick<PGlite,'query'>):Sql=>({query:async<T>(q:string,v:unknown[])=>(await client.query<T>(q,v)).rows})
 const db:Database={...sql(pg),transaction:f=>pg.transaction(tx=>f(sql(tx)))}
 const owner=workspaceService(db,'owner'),w=await owner.createWorkspace({name:'Case isolation'}),c=await owner.createCase(w.id,{title:'First'}),c2=await owner.createCase(w.id,{title:'Second'})
 const invites=institutionalInviteService(db,'owner')
 const pendingCases=[]
 for(const id of [c.id,c2.id])pendingCases.push(await invites.create({workspaceId:w.id,caseId:id,email:'reviewer@example.test',role:'REVIEWER',canExport:true}))
 for(const invitation of pendingCases)await invitationAcceptanceService(db,'reviewer','reviewer@example.test').accept(invitation.token)
 const key='ab'.repeat(32),of=caseFiles(db,'owner',key),rf=caseFiles(db,'reviewer',key)
 const imported=await of.import(w.id,c.id,await parseFile(Buffer.from('2026-09-22 Synthetic source record.'),'source.txt'))
 const before=await rf.list(w.id,c.id),e=before.events[0]
 await rf.review(w.id,c.id,e.id,{revision:e.revision,title:'Reviewed synthetic record',quote:e.quote,precision:e.precision,eventDate:e.eventDate,status:'ACCEPTED',evidenceType:'SOURCE_STATEMENT',note:'Checked the supplied synthetic source.'})
 const report=await rf.export(w.id,c.id,renderCase)
 await rf.downloadExport(w.id,c.id,report.id,false)
 const management=collaborationService(db,'owner')
 assert.equal((await management.list(w.id,c.id)).members.length,2)
 await assert.rejects(collaborationService(db,'other').list(w.id,c.id),WorkspaceError)
 await assert.rejects(collaborationService(db,'reviewer').revoke(w.id,c.id,'owner'),WorkspaceError)
 await assert.rejects(management.revoke(w.id,c.id,'owner'),WorkspaceError)
 const pending=await invites.create({workspaceId:w.id,caseId:c.id,email:'reviewer@example.test',role:'REVIEWER'})
 await management.revoke(w.id,c.id,'reviewer')
 for(const action of [()=>rf.list(w.id,c.id),()=>rf.passage(w.id,c.id,e.passageId),()=>rf.search(w.id,c.id,'Synthetic',false),()=>rf.original(w.id,c.id,imported.documentId),()=>rf.downloadExport(w.id,c.id,report.id,false),()=>rf.review(w.id,c.id,e.id,{})])await assert.rejects(action(),WorkspaceError)
 await assert.rejects(invitationAcceptanceService(db,'reviewer','reviewer@example.test').accept(pending.token),WorkspaceError)
 assert.equal((await workspaceService(db,'reviewer').getCase(w.id,c2.id)).id,c2.id)
 assert.equal((await management.list(w.id,c.id)).members.length,1)
 const audit=await db.query<{action:string}>('SELECT action FROM "PrivateWorkspaceAudit" WHERE action=\'CASE_MEMBER_REVOKED\'',[]);assert.equal(audit.length,1)
 }finally{await pg.close()}
})
