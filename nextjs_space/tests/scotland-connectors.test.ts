import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchSEPARiverLevels, fetchNatureScotProtectedSites, fetchNatureScotHabitats, fetchScottishPlanningData, bbox } from '../lib/ingest/connectors-scotland'
import { handleScotlandPost, validCronKey } from '../lib/ingest/scotland-pipeline'
import { validateEvidence } from '../lib/evidence-contract'
const mock = (data: unknown, status = 200) => (async () => Response.json(data, { status })) as typeof fetch
const stamp = '2026-09-10T12:00:00.000Z'
const now = () => new Date(stamp)
const station = (n: string, value: unknown = 0, time: unknown = stamp) => ({ type: 'Feature', geometry: null, properties: { station_no: n, station_name: n, ts_path: `1/${n}/SG/15m.Cmd`, ts_value: value, timestamp: time, q_code: 254 } })
const collection = (features: unknown[]) => ({ type: 'FeatureCollection', features })
test('SEPA preserves zero, timestamp and source JSON; repeated receipt is idempotent', async () => {
 const data = collection([station('1'),station('2')])
 const a = await fetchSEPARiverLevels({ fetcher: mock(data), now, limit: 1 })
 assert.equal(a.nextOffset,1); assert.equal(a.records.length,1)
 const r = a.records[0]; assert.equal(r.event_date,'2026-09-10'); assert.equal(r.publication_date,null)
 assert.equal(JSON.parse(r.sections[0].text).properties.ts_value,0)
 assert.equal(JSON.parse(r.sections[0].text).geometry,null)
 assert.equal(validateEvidence(r).versionHash, validateEvidence({ ...r,retrieved_at:'2026-09-10T12:01:00Z' }).versionHash)
 const b = await fetchSEPARiverLevels({ fetcher: mock(data), now, offset:1,limit:1 }); assert.notEqual(r.url,b.records[0].url)
})
test('SEPA rejects missing dates and values; excludes tidal records', async () => {
 const tidal = station('t'); tidal.properties.ts_path='1/t/TL/15m.Cmd'
 const r = await fetchSEPARiverLevels({ fetcher:mock(collection([station('1',null),station('2',1,null),tidal])),now })
 assert.equal(r.status,'partial');assert.equal(r.rejected,2);assert.equal(r.records.length,0)
})
test('upstream API and HTTP errors are not empty successes', async () => {
 for(const fetcher of [mock({error:{message:'secret details'}}),mock({},503),mock({features:'wrong'})]) {
  const r=await fetchNatureScotProtectedSites(undefined,{fetcher,now});assert.equal(r.status,'error');assert.doesNotMatch(JSON.stringify(r),/secret details/)
 }
})
test('SSSI UPDATED is not designation date; geometry is not invented; pagination explicit', async () => {
 const r=await fetchNatureScotProtectedSites(undefined,{now,fetcher:mock({features:[{attributes:{OBJECTID:1,PA_CODE:2,NAME:'Synthetic site',UPDATED:0}}],exceededTransferLimit:true})})
 assert.equal(r.records[0].event_date,null);assert.equal(r.nextOffset,20);assert.equal(validateEvidence(r.records[0]).acquisitionPermitted,false)
 assert.equal('latitude' in r.records[0],false)
})
test('HabMoS preserves year precision and polygon geometry', async () => {
 const raw={type:'Feature',id:'habmos.1',properties:{HABITAT_NAME:'Synthetic woodland',SURVEY_DATE:'2003'},geometry:{type:'MultiPolygon',coordinates:[]}}
 const r=await fetchNatureScotHabitats({now,fetcher:mock({...collection([raw]),numberMatched:1})})
 assert.equal(r.status,'ok');assert.equal(r.records[0].event_date_precision,'year');assert.equal(r.records[0].event_date,'2003')
 assert.equal(JSON.parse(r.records[0].sections[0].text).geometry.type,'MultiPolygon');validateEvidence(r.records[0])
})
test('bounding boxes reject malformed and reversed values',()=>{
 for(const s of ['1,2,3','NaN,1,2,3','4,1,2,3','-181,1,2,3',',1,2,3']) assert.throws(()=>bbox(s))
})
test('planning reports its actual access block',async()=>assert.equal((await fetchScottishPlanningData()).status,'blocked'))
const secret='a'.repeat(64)
const req=(body:unknown={}, auth=`Bearer ${secret}`)=>new Request('https://example.com/api/ingest/external',{method:'POST',headers:{authorization:auth},body:JSON.stringify(body)})
test('missing or published weak secret fails closed before collection',async()=>{
 assert.equal(validCronKey('Bearer undefined'),false)
 assert.equal(validCronKey('Bearer bioveracity_scotland_secure_cron_2026','bioveracity_scotland_secure_cron_2026'),false)
 let calls=0
 const r=await handleScotlandPost(req(),{enabled:'true'},async()=>{calls++;throw Error()})
 assert.equal(r.status,401);assert.equal(calls,0)
})
test('dry run, write gate, partial failure and safe receiver errors',async()=>{
 const source=await fetchSEPARiverLevels({fetcher:mock(collection([station('1')])),now})
 let writes=0
 const receive=async()=>{writes++;return {duplicate:false,status:'PENDING_REVIEW'}}
 const collect=async()=>[source,await fetchScottishPlanningData()]
 const a=await handleScotlandPost(req(),{enabled:'true',secret},receive,collect)
 // A dry run never acknowledges writes, so a client must not advance its cursor from it.
 assert.equal(a.status,207);assert.equal(writes,0);assert.equal((await a.json()).writesAcknowledged,false)
 const b=await handleScotlandPost(req({dryRun:false}),{enabled:'true',secret},receive,collect);assert.equal(b.status,503)
 const c=await handleScotlandPost(req({dryRun:false}),{enabled:'true',secret,writeEnabled:'true'},receive,collect)
 const cj=await c.json();assert.equal(cj.catalogueOnly,1);assert.equal(cj.writesAcknowledged,true);assert.equal(writes,1)
 const d=await handleScotlandPost(req({dryRun:false}),{enabled:'true',secret,writeEnabled:'true'},async()=>{throw Error('database secret')},collect)
 // A confirmed write pass still acknowledges even when a record failed to write - the failedWrites count holds the cursor.
 const dj=await d.json();assert.equal(dj.failedWrites,1);assert.equal(dj.writesAcknowledged,true)
})
