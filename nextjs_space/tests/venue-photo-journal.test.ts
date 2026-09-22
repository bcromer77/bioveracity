import { RELEASE_VERSION } from '../lib/venue-journal/release'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { journalService, publicJournal } from '../lib/venue-journal/service'
import { contributionInput, completedWeek, hashToken, MAX_PHOTOS, type JournalPhoto } from '../lib/venue-journal/domain'
import { sendWeeklyDigests, emailPhoto, renderDigest } from '../lib/venue-journal/digest'
import type { Sql, Database } from '../lib/workspaces/service'
const monday = new Date('2026-09-21T09:00:00Z')
const photo = {contactName:'Guest A',contactEmail:'guest@example.test',releaseAccepted:true as const,releaseVersion:RELEASE_VERSION,venuePublications:false,bioPublications:false,caption:'Lichen on the wall',credit:'Guest A',location:'Garden wall',observedOn:'2026-09-19',hash:'safe-image-hash',bytes:Buffer.from('processed-test-image')}
async function fixture() {
 const pg=new PGlite()
 await pg.exec(`CREATE TABLE "User" (id TEXT PRIMARY KEY,email TEXT,role TEXT DEFAULT 'user',"accessState" TEXT DEFAULT 'REGISTERED');
 INSERT INTO "User" (id,email) VALUES ('owner','owner@example.test'),('other','other@example.test'),('editor','editor@example.test');
 UPDATE "User" SET role='admin' WHERE id='editor';`)
 for(const migration of ['20260914_wild_hubs','20260919_attention_return','20260923_venue_photo_journal','20260924_data_rights'])await pg.exec(readFileSync(new URL(`../prisma/migrations/${migration}/migration.sql`,import.meta.url),'utf8'))
 await pg.exec(`INSERT INTO "WildHub" (id,"ownerId",profile,published) VALUES ('venue','owner','{"name":"Fictional cafe"}','{}'),('other-venue','other','{"name":"Other cafe"}','{}');`)
 const sql=(client:Pick<PGlite,'query'>):Sql=>({query:async<T>(q:string,v:unknown[])=>(await client.query<T>(q,v)).rows})
 const db:Database={...sql(pg),transaction:fn=>pg.transaction(tx=>fn(sql(tx)))}
 const owner=journalService(db,'owner'), other=journalService(db,'other'), guest=journalService(db,null), editor=journalService(db,'editor')
 await owner.configure('venue',{weeklyEnabled:true,contributionsEnabled:true})
 return {pg,db,owner,other,guest,editor}
}
test('unknown dates remain unknown; invalid dates, future dates and missing consent are rejected',()=>{
 const raw={...photo,adult:true,venueUseConsent:true,rightsConfirmed:true,scannerConsent:true}
 assert.equal(contributionInput({...raw,observedOn:''},monday).observedOn,null)
 for(const observedOn of ['2026-02-30','2027-01-01','not a date'])assert.throws(()=>contributionInput({...raw,observedOn},monday))
 for(const flag of ['adult','venueUseConsent','rightsConfirmed','scannerConsent'])assert.throws(()=>contributionInput({...raw,[flag]:false},monday))
 assert.deepEqual(completedWeek(monday),{start:new Date('2026-09-14T00:00:00Z'),end:new Date('2026-09-21T00:00:00Z')})
 assert.deepEqual(completedWeek(new Date('2026-10-26T09:00:00Z')),{start:new Date('2026-10-19T00:00:00Z'),end:new Date('2026-10-26T00:00:00Z')})
})
test('guest -> private owner review -> independent editorial approval -> public chronology -> withdrawal',async()=>{
 const f=await fixture();try{
  await f.guest.reserveScan('venue')
  const receipt=await f.guest.contribute('venue',photo)
  assert.equal((await f.owner.list('venue'))[0].status,'RECEIVED')
  await assert.rejects(f.other.list('venue'),/not found/)
  await assert.rejects(f.other.configure('venue',{weeklyEnabled:true,contributionsEnabled:true}),/not found/)
  await assert.rejects(f.other.read(receipt.id,'owner'),/not found/)
  await assert.rejects(f.guest.read(receipt.id,'public'),/not found/)
  await assert.rejects(f.guest.contribute('venue',photo),/already been contributed/)
  await assert.rejects(f.other.change('venue',receipt.id,1,'submit'),/not found/)
  await assert.rejects(f.owner.change('venue',receipt.id,5,'submit'),/changed/)
  await f.owner.change('venue',receipt.id,1,'submit')
  assert.equal((await f.editor.reviewQueue()).length,1)
  await assert.rejects(f.owner.decide(receipt.id,2,true,'Self approval'),/Administrator/)
  await f.pg.exec(`UPDATE "User" SET role='admin' WHERE id='owner'`)
  await assert.rejects(f.owner.decide(receipt.id,2,true,'Self approval'),/Another administrator/)
  await f.editor.decide(receipt.id,2,true,'Synthetic image and general location checked.')
  assert.equal((await publicJournal(f.db,'venue','2026')).length,1)
  assert.equal((await publicJournal(f.db,'venue','2025')).length,0)
  assert.equal((await f.guest.read(receipt.id,'public')).credit,photo.credit)
  await f.pg.exec(`UPDATE "WildHub" SET published=NULL WHERE id='venue'`)
  await assert.rejects(f.guest.read(receipt.id,'public'),/not found/)
  assert.equal((await publicJournal(f.db,'venue')).length,0)
  await f.pg.exec(`UPDATE "WildHub" SET published='{}' WHERE id='venue'`)
  await f.owner.change('venue',receipt.id,3,'unpublish')
  await assert.rejects(f.guest.read(receipt.id,'public'),/not found/)
  await assert.rejects(f.guest.withdraw(receipt.id,'wrong'),/not found/)
  await f.guest.withdraw(receipt.id,receipt.withdrawalToken)
  await assert.rejects(f.owner.read(receipt.id,'owner'),/not found/)
  assert.equal((await f.owner.list('venue')).length,0)
  const [stored]=await f.db.query<{n:number;withdrawalHash:string}>('SELECT octet_length(bytes) AS n,"withdrawalHash" FROM "VenuePhoto" WHERE id=$1',[receipt.id])
  assert.equal(stored.n,0);assert.equal(stored.withdrawalHash,hashToken(receipt.withdrawalToken))
  const events=await f.db.query<{action:string}>('SELECT action FROM "VenuePhotoEvent" ORDER BY "createdAt",id',[])
  assert.equal(events.length,5)
 }finally{await f.pg.close()}
})
test('closed contributions, unpublished venues, scan limits and storage cap fail closed',async()=>{
 const f=await fixture();try{
  await f.owner.configure('venue',{weeklyEnabled:false,contributionsEnabled:false})
  await assert.rejects(f.guest.reserveScan('venue'),/not accepting/)
  await assert.rejects(f.guest.contribute('venue',photo),/not accepting/)
  await f.owner.configure('venue',{weeklyEnabled:true,contributionsEnabled:true})
  for(let i=0;i<12;i++)await f.guest.reserveScan('venue')
  await assert.rejects(f.guest.reserveScan('venue'),/hourly/)
  await f.db.query(`INSERT INTO "VenuePhoto" (id,"hubId",caption,credit,location,hash,bytes,"consentVersion","withdrawalHash") SELECT 'capacity-'||n,'venue','Synthetic','QA','Test',n::text,'x'::bytea,'test','test' FROM generate_series(1,$1) n`,[MAX_PHOTOS])
  await assert.rejects(f.guest.contribute('venue',photo),/full/)
 }finally{await f.pg.close()}
})
test('weekly email selects upload window, embeds private previews, deduplicates and revokes preview access',async()=>{
 const f=await fixture();try{
  const receipt=await f.guest.contribute('venue',{...photo,observedOn:'2024-04-12'})
  const old=await f.guest.contribute('venue',{...photo,hash:'old-upload'})
  const after=await f.guest.contribute('venue',{...photo,hash:'next-week-upload'})
  await f.db.query('UPDATE "VenuePhoto" SET "createdAt"=$1 WHERE id=$2',[new Date('2026-09-13T23:59:59Z'),old.id])
  await f.db.query('UPDATE "VenuePhoto" SET "createdAt"=$1 WHERE id=$2',[new Date('2026-09-21T00:00:00Z'),after.id])
  await f.db.query('UPDATE "VenuePhoto" SET "createdAt"=$1 WHERE id=$2',[new Date('2026-09-20T10:00:00Z'),receipt.id])
  const sent:{to:string;html:string}[]=[]
  assert.equal((await sendWeeklyDigests(f.db,async m=>{sent.push(m)},'https://example.test',monday))[0].status,'SENT')
  assert.equal(sent.length,1);assert.equal(sent[0].to,'owner@example.test')
  assert.match(sent[0].html,/1 photograph added/)
  assert.match(sent[0].html,/Taken 2024-04-12/)
  assert.match(sent[0].html,/wild\/studio\/venue\/photos/)
  const src=sent[0].html.match(/src="([^"]+)"/)![1],url=new URL(src)
  const digestId=url.pathname.split('/')[5],photoId=url.pathname.split('/')[6],token=url.searchParams.get('token')!
  assert.ok(await emailPhoto(f.db,digestId,photoId,token,monday))
  assert.equal(await emailPhoto(f.db,digestId,photoId,'wrong',monday),null)
  assert.equal(await emailPhoto(f.db,digestId,'different-photo',token,monday),null)
  assert.equal(await emailPhoto(f.db,digestId,photoId,token,new Date('2026-09-30')),null)
  await sendWeeklyDigests(f.db,async m=>{sent.push(m)},'https://example.test',monday)
  assert.equal(sent.length,1)
  await f.db.query('UPDATE "User" SET email=$1 WHERE id=\'owner\'',['changed@example.test'])
  assert.equal(await emailPhoto(f.db,digestId,photoId,token,monday),null)
  await f.db.query('UPDATE "User" SET email=$1 WHERE id=\'owner\'',['owner@example.test'])
  await f.db.query(`INSERT INTO "AttentionPreference" (id,"userId","scopeKey","weeklyDigest") VALUES ('preview-pref','owner','GLOBAL',false)`,[])
  assert.equal(await emailPhoto(f.db,digestId,photoId,token,monday),null)
  await f.db.query(`UPDATE "AttentionPreference" SET "weeklyDigest"=true WHERE id='preview-pref'`,[])
  assert.ok(await emailPhoto(f.db,digestId,photoId,token,monday))
  await f.guest.withdraw(receipt.id,receipt.withdrawalToken)
  assert.equal(await emailPhoto(f.db,digestId,photoId,token,monday),null)
 }finally{await f.pg.close()}
})
test('delivery ambiguity is durable and never causes an automatic duplicate; preferences suppress delivery',async()=>{
 const f=await fixture();try{
  let attempts=0
  assert.equal((await sendWeeklyDigests(f.db,async()=>{attempts++;throw Error('Timeout after acceptance')},'https://example.test',monday))[0].status,'UNKNOWN')
  await sendWeeklyDigests(f.db,async()=>{attempts++},'https://example.test',monday)
  assert.equal(attempts,1)
  await f.db.query('INSERT INTO "AttentionPreference" (id,"userId","scopeKey","weeklyDigest") VALUES (\'pref\',\'owner\',\'GLOBAL\',false)',[])
  assert.deepEqual(await sendWeeklyDigests(f.db,async()=>{attempts++},'https://example.test',new Date('2026-09-28')),[])
  assert.equal(attempts,1)
 }finally{await f.pg.close()}
})
test('editorial permissions refresh from database and cannot publish a cancelled submission',async()=>{
 const f=await fixture();try{
  const {id}=await f.guest.contribute('venue',photo)
  await f.owner.change('venue',id,1,'submit')
  await f.owner.change('venue',id,2,'unpublish')
  await assert.rejects(f.editor.decide(id,2,true,'Stale decision'),/changed/)
  await f.pg.exec(`UPDATE "User" SET role='user' WHERE id='editor'`)
  await assert.rejects(f.editor.reviewQueue(),/Administrator/)
 }finally{await f.pg.close()}
})
test('email escapes venue, credit and captions and offers a useful empty week',()=>{
 const result=renderDigest({venue:'<script>alert(1)</script>',origin:'https://example.test',hubId:'venue',digestId:'id',token:'token',start:new Date('2026-09-14'),end:new Date('2026-09-21'),photos:[],total:0})
 assert.ok(!result.html.includes('<script>'));assert.match(result.html,/No new photographs/);assert.match(result.text,/Review, publish or download/)
})
test('contact sheet email includes each scoped photo once, keeps dates and escapes guest text',()=>{
 const photos:JournalPhoto[]=Array.from({length:12},(_,i)=>({id:`photo-${i}`,hubId:'venue',caption:`Leaf <${i}>`,credit:'Guest & friend',location:'Pond',observedOn:i===11?null:'2025-04-12',createdAt:new Date('2026-09-20'),status:'RECEIVED',revision:1,reason:''}))
 const result=renderDigest({venue:'Venue',origin:'https://example.test',hubId:'venue',digestId:'digest',token:'private-token',start:new Date('2026-09-14'),end:new Date('2026-09-21'),photos,total:17})
 assert.equal((result.html.match(/<img /g)||[]).length,12)
 for(const p of photos)assert.equal(result.html.split(`/digest/${p.id}?token=`).length-1,1)
 assert.match(result.html,/Leaf &lt;0&gt;/);assert.match(result.html,/Guest &amp; friend/)
 assert.match(result.html,/Taken 2025-04-12/);assert.match(result.html,/Date taken unknown/)
 assert.match(result.html,/Showing 12 of 17/)
 assert.doesNotMatch(result.html,/object-fit:cover/)
})
