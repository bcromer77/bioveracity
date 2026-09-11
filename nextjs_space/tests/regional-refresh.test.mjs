import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {nextCursor,refresh,reconcileHead,SOURCES,IRISH_COUNTIES,phaseOf} from '../scripts/regional-refresh.mjs'
test('SOURCES covers all 26 counties for both species and planning, plus the preserved national feeds',()=>{
 assert.equal(IRISH_COUNTIES.length,26)
 for(const c of IRISH_COUNTIES){
  assert.ok(SOURCES.includes(`nbdc-${c}`),`missing nbdc-${c}`)
  assert.ok(SOURCES.includes(`irish-planning-${c}`),`missing irish-planning-${c}`)
 }
 // National EPA water coverage stays a single national source, never duplicated per county.
 assert.equal(SOURCES.filter(s=>s==='epa-wfd').length,1)
 assert.equal(SOURCES.filter(s=>s.startsWith('epa-')).length,1)
 // 5 UK + 26x2 Irish + epa-wfd + glasgow-planning + east-anglia-comments = 60.
 assert.equal(SOURCES.length,60)
})
test('phase label distinguishes incremental checks from historical backfill honestly',()=>{
 // Mid-sweep through history: a positive resulting cursor means more historical pages remain.
 assert.equal(phaseOf(0,20,'ok'),'backfill')
 assert.equal(phaseOf(20,40,'partial'),'backfill')
 // A completed historical sweep resets the cursor to 0 after reading a non-zero offset.
 assert.equal(phaseOf(20,0,'ok'),'sweep-complete')
 // Began and ended at page 0: a single bounded page covered the source — up to date.
 assert.equal(phaseOf(0,0,'ok'),'incremental')
 // Non-ok statuses pass through unchanged, never masked as a healthy phase.
 assert.equal(phaseOf(0,0,'error'),'error')
 assert.equal(phaseOf(0,0,'blocked'),'blocked')
 assert.equal(phaseOf(0,0,'empty'),'empty')
})
test('cursor only advances after an acknowledged write pass with zero failures',()=>{
 const ok={writesAcknowledged:true,failedWrites:0,sources:[{status:'ok',rejected:0,nextOffset:5}]}
 assert.equal(nextCursor(0,ok,false),5);assert.equal(nextCursor(0,ok,true),0)
 // No write acknowledgement holds the cursor even when the page looks otherwise clean.
 assert.equal(nextCursor(0,{...ok,writesAcknowledged:false},false),0)
 assert.equal(nextCursor(0,{...ok,writesAcknowledged:undefined},false),0)
 // Any failed write - or a response that omits the count entirely - holds the cursor.
 assert.equal(nextCursor(0,{...ok,failedWrites:1},false),0)
 assert.equal(nextCursor(0,{...ok,failedWrites:undefined},false),0)
 // A fetch error or a blocked source holds the cursor so nothing is skipped unread.
 assert.equal(nextCursor(0,{...ok,sources:[{status:'error',nextOffset:5}]},false),0)
 assert.equal(nextCursor(0,{...ok,sources:[{status:'blocked',nextOffset:null}]},false),0)
 assert.equal(nextCursor(5,{...ok,sources:[{status:'ok',nextOffset:null}]},false),0)
 assert.throws(()=>nextCursor(0,{...ok,sources:[{status:'ok',nextOffset:-1}]},false))
})
test('a permanently-rejected record advances the cursor instead of stalling the county',()=>{
 // A rejected record marks the page 'partial' but is permanent, so the cursor must still move past it.
 const partial={writesAcknowledged:true,failedWrites:0,sources:[{status:'partial',rejected:1,rejections:[{locator:'123',reason:'Wrong publisher or county'}],nextOffset:20}]}
 assert.equal(nextCursor(0,partial,false),20)
 // End of records on a partial page resets to 0 for the next full sweep.
 assert.equal(nextCursor(20,{...partial,sources:[{...partial.sources[0],nextOffset:null}]},false),0)
 // A failed DB write on the same page is transient: hold the cursor so the page is retried.
 assert.equal(nextCursor(0,{...partial,failedWrites:1},false),0)
 // A partial page with no acknowledgement holds too - rejections are only trusted on a real write pass.
 assert.equal(nextCursor(0,{...partial,writesAcknowledged:false},false),0)
 assert.equal(nextCursor(0,partial,true),0)
})
test('a rejected record never stalls a county across repeated sweeps',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'regional-sweep-'));const secret='c'.repeat(64)
 const seen=[];const step={0:10,10:20,20:null}
 const fetcher=async(_,o)=>{
  const {source,offset}=JSON.parse(o.body)
  if(source==='nbdc-wexford'){
   seen.push(offset)
   return Response.json({writesAcknowledged:true,failedWrites:0,totalFetched:1,created:1,duplicates:0,catalogueOnly:0,rejected:1,
    sources:[{source,status:'partial',rejected:1,rejections:[{locator:String(offset),reason:'Wrong publisher or county'}],nextOffset:step[offset]}]})
  }
  return Response.json({writesAcknowledged:true,failedWrites:0,totalFetched:0,created:0,duplicates:0,catalogueOnly:0,rejected:0,sources:[{source,status:'ok',rejected:0,nextOffset:null}]})
 }
 try{
  for(let i=0;i<4;i++)await refresh({endpoint:'https://example.com/api/ingest/external',secret,stateDir:dir,dryRun:false,fetcher})
  // The county is read at offset 0,10,20 then resets to 0 for the next sweep - never stuck on one offset.
  assert.deepEqual(seen,[0,10,20,0])
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})
test('an unacknowledged write pass holds every cursor across a sweep',async()=>{
 // A missing write acknowledgement (e.g. a dropped-to-dry-run deploy) must never advance a cursor.
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'regional-noack-'));const secret='d'.repeat(64)
 try{
  const report=await refresh({endpoint:'https://example.com/api/ingest/external',secret,stateDir:dir,dryRun:false,fetcher:async(_,o)=>{
   const {source,offset}=JSON.parse(o.body)
   return Response.json({writesAcknowledged:false,failedWrites:0,totalFetched:1,created:0,duplicates:0,catalogueOnly:1,rejected:0,sources:[{source,status:'ok',rejected:0,nextOffset:offset+5}]})
  }})
  assert.equal(report.length,SOURCES.length)
  const saved=JSON.parse(await fs.readFile(path.join(dir,'cursors.json'),'utf8'))
  for(const source of SOURCES)assert.equal(saved[source]??0,0)
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})
test('refresh checkpoints source cursors without secrets; bad source does not stop others',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'regional-test-'));const secret='b'.repeat(64)
 try{
 const report=await refresh({endpoint:'https://example.com/api/ingest/external',secret,stateDir:dir,dryRun:false,fetcher:async(_,o)=>{
 const {source}=JSON.parse(o.body);if(source==='sepa')return Response.json({}, {status:503})
 return Response.json({writesAcknowledged:true,success:true,failedWrites:0,totalFetched:1,created:1,duplicates:0,sources:[{source,status:'ok',nextOffset:5}]})
 }})
 assert.equal(report.length,SOURCES.length);assert.equal(report[0].status,'error')
 const saved=await fs.readFile(path.join(dir,'cursors.json'),'utf8');assert.doesNotMatch(saved,new RegExp(secret));assert.equal(JSON.parse(saved)['naturescot-sssi'],5)
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})
test('daily reconcileHead reads the head window (offset 0) for every source and never writes a cursor',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'regional-daily-'));const secret='e'.repeat(64)
 const offsets=[]
 try{
  const report=await reconcileHead({endpoint:'https://example.com/api/ingest/external',secret,stateDir:dir,dryRun:false,fetcher:async(_,o)=>{
   const {source,offset}=JSON.parse(o.body);offsets.push(offset)
   return Response.json({writesAcknowledged:true,failedWrites:0,totalFetched:1,created:1,duplicates:0,catalogueOnly:0,rejected:0,sources:[{source,status:'ok',rejected:0,nextOffset:5}]})
  }})
  assert.equal(report.length,SOURCES.length)
  // Every source is read at the head window, so the freshest records are covered every run.
  assert.ok(offsets.every(o=>o===0),'daily track must always read offset 0')
  assert.equal(offsets.length,SOURCES.length)
  for(const r of report)assert.equal(r.track,'daily')
  // The daily track never maintains a backfill cursor - cursors.json must not be created.
  await assert.rejects(fs.readFile(path.join(dir,'cursors.json'),'utf8'))
  // It writes only its own report artifact.
  const daily=JSON.parse(await fs.readFile(path.join(dir,'daily-report.json'),'utf8'))
  assert.equal(daily.report.length,SOURCES.length)
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})
test('daily reconcileHead isolates a failing source without stopping the rest',async()=>{
 const secret='f'.repeat(64)
 const report=await reconcileHead({endpoint:'https://example.com/api/ingest/external',secret,dryRun:true,fetcher:async(_,o)=>{
  const {source}=JSON.parse(o.body);if(source==='sepa')return Response.json({},{status:503})
  return Response.json({writesAcknowledged:false,failedWrites:0,totalFetched:0,created:0,duplicates:0,catalogueOnly:0,rejected:0,sources:[{source,status:'ok',rejected:0,nextOffset:null}]})
 }})
 assert.equal(report.length,SOURCES.length)
 assert.equal(report[0].source,'sepa');assert.equal(report[0].status,'error')
 assert.ok(report.slice(1).every(r=>r.status==='ok'))
})
