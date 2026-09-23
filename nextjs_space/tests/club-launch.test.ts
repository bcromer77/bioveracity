import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import type { Database, Sql } from '../lib/workspaces/service'
import { clubBillingService, clubBilling, receiveRevolut, reconcileRevolut } from '../lib/billing/club-service'
import { revolutConfig, revolutApi, checkoutUrl, verifyRevolutWebhook, type RevolutApi, type RevolutConfig, type Subscription } from '../lib/billing/revolut'
import { configureWatch, refreshWatch, watchView, reviewRecord, weeklyClubSummary } from '../lib/club-watch/service'
import { watchConfig, planningRecords, epaRecords, type SourceRecord } from '../lib/club-watch/sources'
import { resolveCoverage } from '../lib/ingest/coverage'
import { sendWeeklyDigests } from '../lib/venue-journal/digest'
import { venueOnboardingService } from '../lib/wild-hubs/onboarding'

const ids={plan:'00000000-0000-4000-8000-000000000001',variation:'00000000-0000-4000-8000-000000000002',customer:'00000000-0000-4000-8000-000000000003',subscription:'00000000-0000-4000-8000-000000000004',order:'00000000-0000-4000-8000-000000000005',cycle:'00000000-0000-4000-8000-000000000006'}
const config:RevolutConfig={mode:'sandbox',key:'synthetic-key',signingSecret:'synthetic-signing-secret',origin:'https://qa.example.test',planId:ids.plan,variationId:ids.variation,taxLabel:'Synthetic test tax wording'}
const scope={scopeLabel:'Fictional QA map area — not Old Belvedere',west:-6.25,south:53.31,east:-6.22,north:53.34,waterbodyCode:'IE_TEST_001',scopeConfirmed:true as const}
const record:SourceRecord={key:'synthetic-1',title:'Synthetic planning record',summary:'No real application',publisher:'Synthetic QA publisher',sourceUrl:'https://example.test/source',eventDate:'2026-09-01',period:null,caveat:'Synthetic fixture only'}
async function fixture(){
  const pg=new PGlite()
  await pg.exec(`CREATE TABLE "User" (id TEXT PRIMARY KEY,email TEXT,"emailVerified" TIMESTAMPTZ,name TEXT,role TEXT DEFAULT 'user',"accessState" TEXT DEFAULT 'REGISTERED');
    INSERT INTO "User" (id,email,"emailVerified") VALUES ('owner','owner@example.test',now()),('other','other@example.test',now()),('owner2','owner2@example.test',now()),('editor','editor@example.test',now());UPDATE "User" SET role='admin' WHERE id='editor';`)
  for(const migration of ['20260914_wild_hubs','20260915_wild_editorial_review','20260919_attention_return','20260919_stripe_billing','20260921_venue_launch','20260923_venue_photo_journal','20260924_data_rights','20260929_club_launch'])await pg.exec(readFileSync(new URL(`../prisma/migrations/${migration}/migration.sql`,import.meta.url),'utf8'))
  await pg.exec(`INSERT INTO "WildHub" (id,"ownerId",profile,published) VALUES ('club','owner','{"name":"Fictional QA club","county":"dublin"}','{}'),('foreign','other','{"name":"Other club","county":"dublin"}','{}'),('kk','owner2','{"name":"Fictional Kilkenny club","county":"kilkenny"}',NULL),('cork','owner2','{"name":"Fictional Cork club","county":"cork"}',NULL);`)
  const sql=(client:Pick<PGlite,'query'>):Sql=>({query:async<T>(q:string,v:unknown[])=>(await client.query<T>(q,v)).rows})
  const db:Database={...sql(pg),transaction:fn=>pg.transaction(tx=>fn(sql(tx)))}
  let customerCalls=0,createCalls=0,cancelCalls=0,state='pending',payment='pending',failCustomer=false,reference=''
  const remote=():Subscription=>({id:ids.subscription,external_reference:reference,state,customer_id:ids.customer,plan_id:ids.plan,plan_variation_id:ids.variation,updated_at:'2026-09-22T16:00:00.000000Z',setup_order_id:ids.order,current_cycle_id:ids.cycle})
  const api:RevolutApi={checkPlan:async()=>{},customer:async()=>{customerCalls++;if(failCustomer)throw Error('lost response');return {id:ids.customer}},create:async id=>{createCalls++;reference=id;return remote()},subscription:async()=>remote(),cycle:async()=>({id:ids.cycle,subscription_id:ids.subscription,plan_variation_id:ids.variation,end_date:'2099-10-22T00:00:00Z',order_id:ids.order,trial:false}),order:async()=>({id:ids.order,state:payment,amount:8000,currency:'EUR',checkout_url:'https://sandbox-checkout.revolut.com/payment-link/synthetic'}),cancel:async()=>{cancelCalls++;state='cancelled'}}
  return {pg,db,api,service:clubBillingService(db,'owner',api,config),calls:()=>({customerCalls,createCalls,cancelCalls}),set:(s:string,p='pending')=>{state=s;payment=p},loseCustomer:()=>{failCustomer=true},foreign:()=>{reference='another-subscription'}}
}
test('Revolut configuration rejects disabled/live/unpriced billing and untrusted checkout hosts',()=>{
  assert.throws(()=>revolutConfig({}),/not enabled/)
  const env={BIOVERACITY_BILLING_ENABLED:'true',BILLING_PROVIDER:'revolut',REVOLUT_MODE:'sandbox',APP_BASE_URL:config.origin,REVOLUT_SECRET_KEY:config.key,REVOLUT_WEBHOOK_SECRET:config.signingSecret,REVOLUT_CLUB_PLAN_ID:ids.plan,REVOLUT_CLUB_VARIATION_ID:ids.variation,REVOLUT_CLUB_TAX_LABEL:config.taxLabel}
  assert.equal(revolutConfig(env).mode,'sandbox')
  assert.throws(()=>revolutConfig({...env,REVOLUT_MODE:'live'}),/not been approved/)
  assert.throws(()=>revolutConfig({...env,REVOLUT_CLUB_TAX_LABEL:''}),/tax wording/)
  for(const url of ['http://sandbox-checkout.revolut.com/payment','https://sandbox-checkout.revolut.com.evil.example/payment','https://user:pass@sandbox-checkout.revolut.com/payment','https://checkout.revolut.com/payment'])assert.throws(()=>checkoutUrl(url,'sandbox'))
})
test('provider contract pins API version, amount and monthly cadence; rejects trials and repricing',async()=>{
  for(const overrides of [{},{amount:8100},{currency:'GBP'},{cycle_duration:'P1Y'},{cycle_count:2}]){
    const transport:typeof fetch=async(input,init)=>{assert.ok(String(input).startsWith('https://sandbox-merchant.revolut.com/api/'));assert.equal((init?.headers as Record<string,string>)['Revolut-Api-Version'],'2026-08-17');assert.equal(init?.redirect,'error');return Response.json({id:ids.plan,state:'active',variations:[{id:ids.variation,phases:[{ordinal:1,cycle_duration:'P1M',amount:8000,currency:'EUR',...overrides}]}]})}
    const api=revolutApi(config,transport)
    if(Object.keys(overrides).length)await assert.rejects(api.checkPlan(),/exactly/);else await api.checkPlan()
  }
})
test('checkout is one durable attempt per club; two clicks cannot create two subscriptions',async()=>{
  const f=await fixture();try{
    await assert.rejects(f.service.checkout('foreign',true),/not found/)
    await assert.rejects(f.service.checkout('club',false),/Confirm/)
    const first=await f.service.checkout('club',true),second=await f.service.checkout('club',true)
    assert.deepEqual(first,second);assert.deepEqual(f.calls(),{customerCalls:1,createCalls:1,cancelCalls:0})
    const [row]=await f.db.query<{amount:number;termsVersion:string;taxLabel:string}>('SELECT amount,"termsVersion","taxLabel" FROM "ClubSubscription"',[])
    assert.equal(row.amount,8000);assert.ok(row.termsVersion);assert.equal(row.taxLabel,config.taxLabel)
    await assert.rejects(clubBilling(f.db,'club','other'),/not found/)
  }finally{await f.pg.close()}
})
test('prepared first-club owner can claim the Dublin venue and reach the €80 hosted checkout',async()=>{
  const f=await fixture();try{
    const launches=venueOnboardingService(f.db,'editor')
    const prepared=await launches.prepare({authorised:true,places:[{
      reference:'first-dublin-club',email:'owner@example.test',profile:{name:'Fictional Dublin Club',county:'dublin',kind:'community',story:'Synthetic first-customer journey.',website:'',interests:['nature']},
    }]})
    const row=(await launches.list()).places.find(place=>place.id===prepared.ids[0])
    assert.ok(row)
    const issued=await launches.change(row.id,{action:'issue',revision:row.revision})
    assert.ok('path' in issued && issued.path)
    const token=new URL(`https://qa.example.test${issued.path}`).hash.slice('#token='.length)
    const claimed=await venueOnboardingService(f.db,'owner').claim({confirmed:true,token})
    const hubId=claimed.hubId
    assert.ok(hubId)
    assert.match(claimed.destination,new RegExp(`^/wild/studio\\?hub=${hubId}$`))
    const [hub]=await f.db.query<{ownerId:string;county:string}>('SELECT "ownerId",profile->>\'county\' AS county FROM "WildHub" WHERE id=$1',[hubId])
    assert.deepEqual(hub,{ownerId:'owner',county:'dublin'})
    await configureWatch(f.db,'editor',hubId,scope,true)
    const checkout=await f.service.checkout(hubId,true)
    assert.equal(checkout.url,'https://sandbox-checkout.revolut.com/payment-link/synthetic')
    assert.equal((await clubBilling(f.db,hubId,'owner'))?.state,'pending')
  }finally{await f.pg.close()}
})
test('lost customer response is not retried, and unresolved writes are visible to reconciliation',async()=>{
  const f=await fixture();try{
    f.loseCustomer();await assert.rejects(f.service.checkout('club',true),/reconciliation/)
    await assert.rejects(f.service.checkout('club',true),/second subscription/)
    assert.equal(f.calls().customerCalls,1)
    assert.equal((await reconcileRevolut(f.db,f.api,config)).unresolved,1)
    assert.equal((await clubBilling(f.db,'club','owner'))?.needsReconciliation,true)
  }finally{await f.pg.close()}
})
test('activation is fetched; active without a completed €80 order grants no paid service; cancellation preserves records',async()=>{
  const f=await fixture();try{
    await f.service.checkout('club',true);f.set('active')
    await f.service.refresh('club');assert.equal((await clubBilling(f.db,'club','owner'))?.paidUntil,null)
    f.set('active','completed');assert.equal((await reconcileRevolut(f.db,f.api,config)).failed,0)
    const paid=(await clubBilling(f.db,'club','owner'))?.paidUntil;assert.ok(paid)
    await assert.rejects(f.service.cancel('club','wrong'),/Confirm/)
    await f.service.cancel('club','CANCEL SUBSCRIPTION');await f.service.cancel('club','CANCEL SUBSCRIPTION')
    assert.equal(f.calls().cancelCalls,1);const status=await clubBilling(f.db,'club','owner')
    assert.equal(status?.state,'cancelled');assert.deepEqual(status?.paidUntil,paid)
    assert.equal((await f.db.query('SELECT id FROM "WildHub" WHERE published IS NOT NULL',[])).length,2)
    f.foreign();await assert.rejects(f.service.refresh('club'),/identity/)
  }finally{await f.pg.close()}
})
test('webhook verifies exact bytes, millisecond timestamp and multiple signatures; duplicate receipt does not set entitlement',async()=>{
  const f=await fixture();try{
    const now=Date.now(),raw=JSON.stringify({event:'SUBSCRIPTION_INITIATED',subscription_id:ids.subscription}),ts=String(now),sig='v1='+createHmac('sha256',config.signingSecret).update(`v1.${ts}.${raw}`).digest('hex')
    verifyRevolutWebhook(raw,ts,`v1=${'0'.repeat(64)}, ${sig}`,config.signingSecret,now)
    for(const [body,timestamp,signature] of [[raw+' ',ts,sig],[raw,String(now-300001),sig],[raw,ts,'v1=wrong']])assert.throws(()=>verifyRevolutWebhook(body,timestamp,signature,config.signingSecret,now))
    await receiveRevolut(f.db,config,raw,ts,sig,now);await receiveRevolut(f.db,config,raw,ts,sig,now)
    assert.equal((await f.db.query('SELECT * FROM "RevolutReceipt"',[])).length,1);assert.equal(await clubBilling(f.db,'club','owner'),null)
  }finally{await f.pg.close()}
})
test('planning adapter uses bounded geography, preserves dates, excludes applicant fields and refuses partial pagination',async()=>{
  const feature={attributes:{OBJECTID:1,PlanningAuthority:'Dublin City Council',ApplicationNumber:'SYNTHETIC-1',ApplicationStatus:'Decided',Decision:'Grant',ReceivedDate:Date.UTC(2026,0,1),DecisionDate:Date.UTC(2026,8,1)},geometry:{x:-6.24,y:53.32}}
  const rows=await planningRecords(scope,async url=>{const u=new URL(url);assert.ok(u.searchParams.get('geometry'));assert.ok(!u.searchParams.get('outFields')?.includes('Applicant'));return {features:[feature,{...feature,attributes:{...feature.attributes,OBJECTID:2},geometry:{x:-6.5,y:53.4}}]}})
  assert.equal(rows.length,1);assert.equal(rows[0].eventDate,'2026-09-01');assert.match(rows[0].summary,/2026-01-01/)
  await assert.rejects(planningRecords(scope,async()=>({features:[],exceededTransferLimit:true})),/advance/)
  await assert.rejects(planningRecords(scope,async()=>({error:{message:'outage'}})),/schema/)
  assert.throws(()=>watchConfig({...scope,west:-10}),/bounded/)
})
test('EPA keeps the assessment period distinct from retrieval date, confidence and source identity',async()=>{
  const rows=await epaRecords(scope,async()=>({Code:scope.waterbodyCode,Name:'SYNTHETIC RIVER',Status:[{Code:'SW 2019-2024',Status:[{Name:'Ecological Status or Potential',Status:'Moderate',AssessmentTechnique:'Monitoring',StatusConfidence:'high confidence'}]}]}))
  assert.equal(rows[0].period,'SW 2019-2024');assert.equal(rows[0].eventDate,null);assert.match(rows[0].summary,/high confidence/)
  await assert.rejects(epaRecords(scope,async()=>({Code:'another',Status:[]})),/did not match/)
})
test('source revisions require independent review; unchanged refresh is idempotent; corrections remove old public claims',async()=>{
  const f=await fixture();try{
    await assert.rejects(configureWatch(f.db,'owner','club',scope,true),/Administrator/)
    const watch=await configureWatch(f.db,'editor','club',scope,true)
    assert.equal((await configureWatch(f.db,'editor','club',scope,true)).version,1)
    const loaders={planning:async()=>[record],epa:async()=>[]}
    await refreshWatch(f.db,watch,loaders);await refreshWatch(f.db,watch,loaders)
    assert.equal((await watchView(f.db,'club',{public:true}))?.records.length,0)
    const view=await watchView(f.db,'club',{userId:'owner'});assert.equal(view?.records.length,1)
    await assert.rejects(watchView(f.db,'club',{userId:'other'}),/not found/)
    await reviewRecord(f.db,'editor',view!.records[0].id,'APPROVED','Read the synthetic source and checked the scope.')
    assert.equal((await watchView(f.db,'club',{public:true}))?.records.length,1)
    await refreshWatch(f.db,watch,{...loaders,planning:async()=>[{...record,summary:'Corrected synthetic decision'}]})
    assert.equal((await watchView(f.db,'club',{public:true}))?.records.length,0)
    assert.equal((await f.db.query('SELECT id FROM "ClubSourceRecord"',[])).length,2)
    const before=(await watchView(f.db,'club',{userId:'owner'}))!.records[0]
    await refreshWatch(f.db,watch,{planning:async()=>{throw Error('outage')},epa:async()=>[]},new Date(Date.now()+1000))
    const after=await watchView(f.db,'club',{userId:'owner'});assert.equal(after!.records[0].id,before.id);assert.equal(after!.runs.find(r=>r.source==='planning')?.status,'ERROR')
    const changed=await configureWatch(f.db,'editor','club',{...scope,scopeLabel:'Another approved area'},true)
    assert.equal(changed.version,2);assert.equal((await watchView(f.db,'club',{userId:'owner'}))?.records.length,0)
  }finally{await f.pg.close()}
})
const kilkenny={scopeLabel:'River Nore · Kilkenny (fictional QA area)',west:-7.27,south:52.64,east:-7.24,north:52.66,waterbodyCode:'IE_TEST_NORE',scopeConfirmed:true as const}
const cork={scopeLabel:'River Lee · Cork (fictional QA area)',west:-8.50,south:51.89,east:-8.47,north:51.91,waterbodyCode:'IE_TEST_LEE',scopeConfirmed:true as const}
test('coverage resolves through the one shared registry: the venue county selects connectors, multi-authority counties are honoured, Ireland reuses the national planning layer, and gaps stay honest',()=>{
  // Geography still validates any Irish/UK map box and refuses out-of-region or oversized bounds.
  assert.deepEqual(watchConfig(kilkenny).scopeLabel,kilkenny.scopeLabel)
  assert.equal(watchConfig(kilkenny).west,-7.27)
  assert.doesNotThrow(()=>watchConfig(scope))
  assert.throws(()=>watchConfig({...kilkenny,west:-40,east:-39.95}),/Ireland or the United Kingdom/)
  assert.throws(()=>watchConfig({...kilkenny,east:-6}),/bounded/)
  // Dublin, Kilkenny and Cork all resolve to CONNECTED planning through the shared national Irish connector.
  assert.equal(resolveCoverage('dublin','planning').status,'CONNECTED')
  assert.equal(resolveCoverage('kilkenny','planning').status,'CONNECTED')
  const corkPlanning=resolveCoverage('cork','planning')
  assert.equal(corkPlanning.status,'CONNECTED')
  // A multi-authority county is never assumed to equal a single council.
  assert.equal(corkPlanning.authorities.length,2)
  assert.equal(resolveCoverage('dublin','planning').authorities.length,4)
  // EPA is nationwide for the Republic of Ireland.
  assert.equal(resolveCoverage('kilkenny','epa').status,'CONNECTED')
  // A county with no wired planning connector is an honest coverage gap, never an absence.
  const gap=resolveCoverage('down','planning')
  assert.equal(gap.status,'UNAVAILABLE')
  assert.match(gap.note,/coverage gap/)
})
test('a non-Dublin club connects end to end through the shared layer; a multi-authority county connects too; Dublin behaviour is unchanged',async()=>{
  const f=await fixture();try{
    // The Kilkenny club (previously blocked by the Dublin-only box) now configures and refreshes; its county drives CONNECTED coverage.
    const watch=await configureWatch(f.db,'editor','kk',kilkenny,true)
    const runs=await refreshWatch(f.db,watch,{planning:async()=>[record],epa:async()=>[record]})
    assert.equal(runs.find(r=>r.source==='planning')?.status,'CONNECTED')
    assert.equal(runs.find(r=>r.source==='epa')?.status,'CONNECTED')
    const stored=await watchView(f.db,'kk',{userId:'owner2'})
    const planningRun=stored!.runs.find(r=>r.source==='planning')
    assert.equal(planningRun?.status,'CONNECTED')
    assert.match(planningRun!.note,/national Irish planning connector/)
    assert.equal(stored!.records.length,2)
    // A multi-authority Cork club connects through the same shared resolver, no parallel connector.
    const corkWatch=await configureWatch(f.db,'editor','cork',cork,true)
    const corkRuns=await refreshWatch(f.db,corkWatch,{planning:async()=>[record],epa:async()=>[]})
    assert.equal(corkRuns.find(r=>r.source==='planning')?.status,'CONNECTED')
  }finally{await f.pg.close()}
})
test('weekly club content uses existing opt-in and at-most-once email claim; does not leak unreviewed source cards',async()=>{
  const f=await fixture();try{
    await f.service.checkout('club',true);f.set('active','completed');await f.service.refresh('club')
    const watch=await configureWatch(f.db,'editor','club',scope,true)
    await refreshWatch(f.db,watch,{planning:async()=>[record],epa:async()=>[]})
    const view=await watchView(f.db,'club',{userId:'owner'}),id=view!.records[0].id
    const start=new Date('2026-09-14T00:00:00Z'),end=new Date('2026-09-21T00:00:00Z')
    assert.equal((await weeklyClubSummary(f.db,'club',start,end))?.records.length,0)
    await reviewRecord(f.db,'editor',id,'APPROVED','Checked synthetic source');await f.db.query('UPDATE "ClubSourceRecord" SET "reviewedAt"=$2 WHERE id=$1',[id,new Date('2026-09-18')])
    await f.pg.exec('INSERT INTO "VenuePhotoSettings" ("hubId","weeklyEnabled") VALUES (\'club\',true)')
    const messages:{text:string;to:string}[]=[];const send=async(m:{text:string;to:string})=>{messages.push(m)}
    await sendWeeklyDigests(f.db,send,config.origin,end,{clubLaunch:true});await sendWeeklyDigests(f.db,send,config.origin,end,{clubLaunch:true})
    assert.equal(messages.length,1);assert.equal(messages[0].to,'owner@example.test');assert.match(messages[0].text,/Synthetic planning record/)
    await f.pg.exec('UPDATE "VenuePhotoSettings" SET "weeklyEnabled"=false')
    await sendWeeklyDigests(f.db,send,config.origin,new Date('2026-09-28'),{clubLaunch:true});assert.equal(messages.length,1)
  }finally{await f.pg.close()}
})
