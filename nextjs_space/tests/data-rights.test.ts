import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {rightsService,recordAcceptance} from '../lib/data-rights/service'
import {validAcceptance,TERMS_VERSION,PRIVACY_VERSION,oneCalendarMonth} from '../lib/data-rights/policy'
import {releaseInput,RELEASE_VERSION} from '../lib/venue-journal/release'
import {hubService} from '../lib/wild-hubs/service'
import {journalService,publicJournal} from '../lib/venue-journal/service'
import type {Sql,Database} from '../lib/workspaces/service'
const acceptance={acceptTerms:true,termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION}
async function fixture(){
 const pg=new PGlite()
 await pg.exec(`CREATE TABLE "User" (id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT DEFAULT 'user',"accessState" TEXT DEFAULT 'REGISTERED',"createdAt" TIMESTAMPTZ DEFAULT now()); INSERT INTO "User" (id,name,email) VALUES ('a','Alice','a@example.test'),('b','Bob','b@example.test'),('admin','Reviewer','admin@example.test'); UPDATE "User" SET role='admin' WHERE id='admin';`)
 for(const migration of ['20260914_wild_hubs','20260915_wild_editorial_review','20260919_attention_return','20260923_venue_photo_journal','20260924_data_rights'])await pg.exec(readFileSync(new URL(`../prisma/migrations/${migration}/migration.sql`,import.meta.url),'utf8'))
 await pg.exec(`INSERT INTO "WildHub" (id,"ownerId",profile,published) VALUES ('venue','a','{"name":"Test venue"}','{}'),('other','b','{"name":"Other venue"}','{}');`)
 const sql=(p:Pick<PGlite,'query'>):Sql=>({query:async<T>(q:string,v:unknown[])=>(await p.query<T>(q,v)).rows})
 const db:Database={...sql(pg),transaction:fn=>pg.transaction(tx=>fn(sql(tx)))}
 return {pg,db,a:rightsService(db,'a'),b:rightsService(db,'b'),admin:rightsService(db,'admin')}
}
test('acceptance rejects missing, prefilled string, stale terms and stale notice; deadlines use calendar month',()=>{
 for(const v of [null,{}, {...acceptance,acceptTerms:'true'},{...acceptance,termsVersion:'old'},{...acceptance,privacyVersion:'old'}])assert.equal(validAcceptance(v),false)
 assert.equal(validAcceptance(acceptance),true)
 assert.equal(oneCalendarMonth(new Date('2026-01-31T10:00:00Z')).toISOString(),'2026-02-28T10:00:00.000Z')
 assert.equal(oneCalendarMonth(new Date('2028-01-31T10:00:00Z')).toISOString(),'2028-02-29T10:00:00.000Z')
})
test('versioned acceptance is atomic with account creation and idempotent',async()=>{
 const f=await fixture();try{
 await assert.rejects(f.db.transaction(async sql=>{await sql.query(`INSERT INTO "User" (id) VALUES ('new')`,[]);await recordAcceptance(sql,'new',{},'signup')}))
 assert.equal((await f.db.query(`SELECT id FROM "User" WHERE id='new'`,[])).length,0)
 await f.a.accept(acceptance);await f.a.accept(acceptance)
 const out=await f.a.overview();assert.equal(out.acceptances.length,1);assert.equal((await f.b.overview()).acceptances.length,0)
 assert.equal(out.venues.length,1);assert.equal((out.venues[0] as {id:string}).id,'venue');assert.equal('password' in out.account,false)
 }finally{await f.pg.close()}
})
test('requests work without terms or paid entitlement; idempotent, scoped, verified admin response, immutable closure',async()=>{
 const f=await fixture();try{
 await assert.rejects(f.a.request({kind:'ERASURE',details:'',confirm:false}),/DELETE MY DATA/)
 const req=await f.a.request({kind:'ERASURE',details:'Account data',confirm:'DELETE MY DATA'}) as {id:string}
 const again=await f.a.request({kind:'ERASURE',details:'',confirm:'DELETE MY DATA'}) as {id:string};assert.equal(req.id,again.id)
 assert.equal((await f.b.overview()).requests.length,0)
 await assert.rejects(f.b.queue(),/Administrator/)
 await assert.rejects(f.b.respond(req.id,{status:'COMPLETED',response:'This must not be allowed.',confirm:true}),/Administrator/)
 await assert.rejects(f.admin.respond(req.id,{status:'COMPLETED',response:'This must require confirmation.'}),/Confirm/)
 await f.admin.respond(req.id,{status:'IN_REVIEW',response:'We are assessing your request and retention duties.'})
 await f.admin.respond(req.id,{status:'PARTIALLY_COMPLETED',response:'Synthetic test outcome: excluded data and grounds recorded.',confirm:true})
 assert.equal((await f.a.overview()).requests.length,1)
 await assert.rejects(f.admin.respond(req.id,{status:'REFUSED',response:'Cannot silently rewrite a closed outcome.',confirm:true}),/already closed/)
 await f.pg.exec(`UPDATE "User" SET role='user' WHERE id='admin'`);await assert.rejects(f.admin.queue(),/Administrator/)
 assert.equal((await f.db.query(`SELECT * FROM "DataRightsEvent" WHERE "requestId"=$1`,[req.id])).length,3)
 }finally{await f.pg.close()}
})
test('unpublishing is owner-bound, preserves stored data and invalidates pending review',async()=>{
 const f=await fixture();try{
 await f.pg.exec(`INSERT INTO "WildHubReview" (id,"hubId","submittedBy",revision,snapshot) VALUES ('pending','venue','a',1,'{}');`)
 await assert.rejects(f.b.unpublish('venue'),/not found/)
 await f.a.unpublish('venue');const out=await f.a.overview();assert.equal((out.venues[0] as {isPublished:boolean}).isPublished,false)
 assert.equal((await f.db.query<{status:string}>(`SELECT status FROM "WildHubReview" WHERE id='pending'`,[]))[0].status,'REJECTED')
 assert.equal((await f.b.overview()).venues.length,1)
 }finally{await f.pg.close()}
})
const release={contactName:'Guest Person',contactEmail:'guest@example.test',releaseVersion:RELEASE_VERSION,releaseAccepted:true as const,venuePublications:true,bioPublications:false}
test('release requires private contacts/current acceptance, separates optional uses, rejects implicit grants',()=>{
 assert.equal(releaseInput(release).bioPublications,false)
 for(const v of [{...release,contactEmail:'bad'},{...release,releaseAccepted:false},{...release,releaseVersion:'old'},{...release,venuePublications:undefined}])assert.throws(()=>releaseInput(v))
})
test('contact stays private; future use needs specific verified permission; withdrawal blocks new clearance',async()=>{
 const f=await fixture();try{
 const owner=journalService(f.db,'a'),guest=journalService(f.db,null),admin=journalService(f.db,'admin')
 await owner.configure('venue',{contributionsEnabled:true,weeklyEnabled:false})
 const p=await guest.contribute('venue',{...release,caption:'Lichen',credit:'A guest',location:'Wall',observedOn:null,hash:'one',bytes:Buffer.from('image')})
 assert.equal('contactEmail' in (await owner.list('venue'))[0],false)
 await assert.rejects(guest.releaseReceipt(p.id,'wrong'),/not found/)
 assert.equal((await guest.releaseReceipt(p.id,p.withdrawalToken) as {contactEmail:string}).contactEmail,release.contactEmail)
 await owner.change('venue',p.id,1,'submit');await admin.decide(p.id,2,true,'Synthetic approval')
 const publicRecord=(await publicJournal(f.db,'venue'))[0];assert.equal('contactEmail' in publicRecord,false)
 assert.equal(JSON.stringify(await guest.read(p.id,'public')).includes(release.contactEmail),false)
 await assert.rejects(owner.releaseQueue(),/Administrator/)
 await assert.rejects(admin.publicationRelease(p.id,'venue'),/No verified/)
 await admin.verifyRelease(p.id,'Verified with contributor using an independent test channel.')
 assert.equal((await admin.publicationRelease(p.id,'venue') as {photoId:string}).photoId,p.id)
 await assert.rejects(admin.publicationRelease(p.id,'bioveracity'),/No verified/)
 await guest.releaseReceipt(p.id,p.withdrawalToken,true)
 await assert.rejects(admin.publicationRelease(p.id,'venue'),/No verified/)
 assert.equal((await publicJournal(f.db,'venue')).length,1)
 await guest.withdraw(p.id,p.withdrawalToken);assert.equal((await publicJournal(f.db,'venue')).length,0)
 }finally{await f.pg.close()}
})

test('owner gallery also requires a release, keeps contacts private and supports scoped future-use withdrawal',async()=>{
 const f=await fixture();try{
 const owner=hubService(f.db,'a'),admin=journalService(f.db,'admin')
 const photo={...release,caption:'Gallery lichen',credit:'Guest',hash:'gallery',bytes:Buffer.from('image')}
 const hub=await owner.addPhoto('venue',photo),id=hub.photos[0].id
 assert.equal(JSON.stringify(hub).includes(release.contactEmail),false)
 assert.equal((await f.a.overview()).galleryReleases.length,1)
 assert.equal((await f.b.overview()).galleryReleases.length,0)
 await assert.rejects(f.b.withdrawGalleryRelease(id),/not found/)
 await admin.verifyRelease(id,'Contact and rights verified independently for this fixture.')
 await f.db.query(`UPDATE "WildHub" SET published=$1::jsonb WHERE id='venue'`,[JSON.stringify({photoIds:[id]})])
 assert.equal((await admin.publicationRelease(id,'venue') as {photoId:string}).photoId,id)
 await f.a.withdrawGalleryRelease(id)
 await assert.rejects(admin.publicationRelease(id,'venue'),/No verified/)
 }finally{await f.pg.close()}
})
