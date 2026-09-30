import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plotInput,visitInput,coverage,COUNTIES } from '../lib/listens/domain.mjs'
import { listenService } from '../lib/listens/service.mjs'
const id='00000000-0000-4000-8000-000000000001', plotId='00000000-0000-4000-8000-000000000002'
const now=new Date('2026-09-30T12:00:00Z')
const visit={id,plotId,observedAt:'2026-09-30T10:30:00+01:00',completed:true,adult:true,wind:'calm',weather:'dry',birds:'not_heard',note:''}
test('all-island counties and private nicknames; no implicit coordinates',()=>{
  assert.equal(COUNTIES.length,32)
  assert.deepEqual(plotInput({id,name:' Garden bench ',county:'Down',latitude:54}),{id,name:'Garden bench',county:'Down'})
  assert.throws(()=>plotInput({id,name:'Garden',county:'Unknown'}))
})
test('source offset preserved; observation is distinct from receipt',()=>{
  const result=visitInput(visit,now)
  assert.equal(result.observedAt,'2026-09-30T09:30:00.000Z')
  assert.equal(result.sourceTime,visit.observedAt)
  assert.equal(result.birds,'not_heard')
  assert.equal(result.method,'LISTEN_5_MIN_V1')
})
test('incomplete, child, future, stale, missing-zone and impossible-date submissions rejected',()=>{
  for(const patch of [{completed:false},{adult:false},{observedAt:'2026-10-01T10:00:00Z'},{observedAt:'2026-08-01T10:00:00Z'},{observedAt:'2026-09-30T10:00:00'},{observedAt:'2026-09-31T10:00:00Z'},{birds:'absent'},{note:'x'.repeat(501)}]) assert.throws(()=>visitInput({...visit,...patch},now))
})
test('coverage reports participation without inferring a trend',()=>{
  assert.equal(coverage([]).visits,0)
  assert.match(coverage([{observedAt:'2026-09-30T09:00Z'},{observedAt:'2026-09-30T10:00Z'}]).statement,/do not yet establish/)
})
function dbWith(handler) {
  const calls=[]
  const db={query:async(sql,values)=>{calls.push({sql,values});return handler(sql,values)},transaction:async fn=>fn(db)}
  return {db,calls}
}
test('another participant cannot attach a visit to a foreign plot',async()=>{
  const {db,calls}=dbWith(sql=>sql.includes('FROM "User"')?[{id:'intruder'}]:[])
  const input={...visit,observedAt:new Date(Date.now()-60000).toISOString()}
  await assert.rejects(listenService(db,'intruder').saveVisit(input),e=>e.status===404)
  assert.ok(calls.some(c=>c.sql.includes('"ownerId"=$2')&&c.values[1]==='intruder'))
  assert.ok(!calls.some(c=>c.sql.startsWith('INSERT')))
})
test('home reads are owner-bound for both plots and visits',async()=>{
  const {db,calls}=dbWith(()=>[])
  assert.deepEqual(await listenService(db,'owner').home(),{plots:[],visits:[]})
  assert.ok(calls.every(c=>c.sql.includes('"ownerId"=$1')&&c.values[0]==='owner'))
})
test('unverified participant cannot create records',async()=>{
  const {db,calls}=dbWith(()=>[])
  await assert.rejects(listenService(db,'owner').createPlot({id,name:'Bench',county:'Cork'}),e=>e.status===403)
  assert.ok(!calls.some(c=>c.sql.startsWith('INSERT')))
})
test('plot retries are idempotent, changed-body reuse conflicts, quota is under owner lock',async()=>{
  let record=null,n=0
  const {db,calls}=dbWith((sql,values)=>{
    if(sql.includes('FROM "User"')) return [{id:'owner'}]
    if(sql.startsWith('SELECT id,"payloadHash"')) return record?[record]:[]
    if(sql.startsWith('SELECT COUNT')) return [{n}]
    if(sql.startsWith('INSERT')) {record={id:values[0],payloadHash:values[4]};n++;return []}
    return []
  })
  const service=listenService(db,'owner'),input={id,name:'Bench',county:'Cork'}
  assert.deepEqual(await service.createPlot(input),{id})
  assert.deepEqual(await service.createPlot(input),{id})
  assert.equal(n,1)
  await assert.rejects(service.createPlot({...input,name:'Different'}),e=>e.status===409)
  record=null;n=3
  await assert.rejects(service.createPlot({...input,id:plotId}),e=>e.status===409)
  assert.ok(calls[0].sql.includes('FOR UPDATE'))
})
test('foreign plot cannot be deleted',async()=>{
  const {db,calls}=dbWith(sql=>sql.includes('FROM "User"')?[{id:'owner'}]:[])
  await assert.rejects(listenService(db,'owner').deletePlot(id),e=>e.status===404)
  assert.ok(!calls.some(c=>c.sql.startsWith('DELETE')))
})
test('visit retry after receipt preserves one record; changed content conflicts; limit blocks new visits',async()=>{
  let record=null,n=0
  const {db}=dbWith((sql,values)=>{
    if(sql.includes('FROM "User"')) return [{id:'owner'}]
    if(sql.includes('FROM "ListeningPlot"')) return [{id:plotId}]
    if(sql.startsWith('SELECT id,"payloadHash"')) return record?[record]:[]
    if(sql.startsWith('SELECT COUNT')) return [{n}]
    if(sql.startsWith('INSERT')) { record={id:values[0],payloadHash:values[4]};n++;return [] }
    return []
  })
  const service=listenService(db,'owner'),input={...visit,observedAt:new Date(Date.now()-60000).toISOString()}
  await service.saveVisit(input)
  await service.saveVisit(input)
  assert.equal(n,1)
  await assert.rejects(service.saveVisit({...input,note:'changed'}),e=>e.status===409)
  record=null;n=52
  await assert.rejects(service.saveVisit({...input,id:plotId}),e=>e.status===409)
})
