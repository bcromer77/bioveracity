import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {nextCursor,refresh,SOURCES} from '../scripts/regional-refresh.mjs'
test('cursor only advances after confirmed successful writes',()=>{
 const ok={success:true,failedWrites:0,sources:[{status:'ok',nextOffset:5}]}
 assert.equal(nextCursor(0,ok,false),5);assert.equal(nextCursor(0,ok,true),0)
 assert.equal(nextCursor(0,{...ok,failedWrites:1},false),0)
 assert.equal(nextCursor(0,{...ok,success:false},false),0)
 assert.equal(nextCursor(5,{...ok,sources:[{status:'ok',nextOffset:null}]},false),0)
 assert.throws(()=>nextCursor(0,{...ok,sources:[{status:'ok',nextOffset:-1}]},false))
})
test('refresh checkpoints source cursors without secrets; bad source does not stop others',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'regional-test-'));const secret='b'.repeat(64)
 try{
 const report=await refresh({endpoint:'https://example.com/api/ingest/external',secret,stateDir:dir,dryRun:false,fetcher:async(_,o)=>{
 const {source}=JSON.parse(o.body);if(source==='sepa')return Response.json({}, {status:503})
 return Response.json({success:true,failedWrites:0,totalFetched:1,created:1,duplicates:0,sources:[{source,status:'ok',nextOffset:5}]})
 }})
 assert.equal(report.length,SOURCES.length);assert.equal(report[0].status,'error')
 const saved=await fs.readFile(path.join(dir,'cursors.json'),'utf8');assert.doesNotMatch(saved,new RegExp(secret));assert.equal(JSON.parse(saved)['naturescot-sssi'],5)
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})
