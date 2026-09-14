import { test } from 'node:test'
import assert from 'node:assert/strict'
import { internalHref } from '../lib/onsite-link.mjs'
import { fetchCountyNature } from '../lib/wild-counties/api-nature'
import { NBDC_GADM, NBDC_PUBLISHER } from '../lib/ingest/connectors-ireland'
const valid = { key:123,publishingOrgKey:NBDC_PUBLISHER,countryCode:'IE',gadm:{level1:{gid:NBDC_GADM.Kilkenny}},occurrenceStatus:'PRESENT',scientificName:'Lutra lutra',license:'https://creativecommons.org/licenses/by/4.0/',eventDate:'2024-03',datasetKey:'fixture',decimalLatitude:52.6,decimalLongitude:-7.2,recordedBy:'Private name' }

test('only local navigation survives, source and hostile URLs never become links',()=>{
 for(const url of ['/wild/kilkenny','/api/wild/qr/example?download=1','#seasons','?page=2'])assert.equal(internalHref(url),url)
 assert.equal(internalHref('https://bioveracity.com/wild/kilkenny'),'/wild/kilkenny')
 for(const url of ['https://npws.ie/','//evil.example','javascript:alert(1)','data:text/html,test','/\\evil.example','https://bioveracity.com@evil.example','https://bioveracity.com.evil.example','https://name:password@bioveracity.com/'])assert.equal(internalHref(url),null)
})
test('county API checks publisher, administrative assignment, reuse and sensitivity; output excludes precise locations and people',async()=>{
 const calls:string[]=[]
 const result=await fetchCountyNature('kilkenny',{request:async(url,init)=>{
  calls.push(String(url));assert.equal(init?.redirect,'error')
  return Response.json({endOfRecords:false,results:[valid,{...valid,key:124,gadm:{level1:{gid:NBDC_GADM.Wexford}}},{...valid,key:125,informationWithheld:'sensitive'},{...valid,key:126,license:'https://example.com/restricted'},{...valid,key:127,occurrenceStatus:'ABSENT'},{...valid,key:128,publishingOrgKey:'someone-else'}]})
 },now:()=>new Date('2026-09-14T12:00:00Z')})
 assert.equal(calls.length,1);const url=new URL(calls[0]);assert.equal(url.hostname,'api.gbif.org');assert.equal(url.searchParams.get('gadmGid'),NBDC_GADM.Kilkenny)
 assert.equal(result.records.length,1);assert.equal(result.excluded,5);assert.equal(result.status,'partial')
 assert.equal(result.records[0].eventDate,'2024-03');assert.equal(result.records[0].datePrecision,'month')
 assert.doesNotMatch(JSON.stringify(result),/decimalLatitude|decimalLongitude|recordedBy|Private name/)
 assert.equal(result.checkedAt,'2026-09-14T12:00:00.000Z')
})
test('unsupported or failed county source never falls back to a webpage or fabricated data',async()=>{
 let calls=0
 const down=await fetchCountyNature('down',{request:async()=>{calls++;throw Error()}})
 assert.equal(calls,0);assert.equal(down.status,'unsupported');assert.equal(down.records.length,0)
 const failed=await fetchCountyNature('kilkenny',{request:async()=>{calls++;throw Error()}})
 assert.equal(calls,1);assert.equal(failed.status,'unavailable');assert.equal(failed.records.length,0)
})

test('application JSX has no unmanaged anchors and map links remain internal', async()=>{
 const { readdir, readFile }=await import('node:fs/promises')
 const ts=await import('typescript')
 async function inspect(dir:string):Promise<void>{
  for(const entry of await readdir(dir,{withFileTypes:true})){
   const path=dir+'/'+entry.name
   if(entry.isDirectory()){await inspect(path);continue}
   if(!path.endsWith('.tsx') || path.endsWith('/evidence-link.tsx'))continue
   const source=await readFile(path,'utf8')
   const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
   function walk(node:import('typescript').Node){
    if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))assert.notEqual(node.tagName.getText(ast),'a','Unmanaged anchor in '+path)
    ts.forEachChild(node,walk)
   }
   walk(ast)
   assert.doesNotMatch(source,/<a\s+href=["']https?:\/\//,'External attribution HTML in '+path)
   if(source.includes('<MapContainer')){
    assert.match(source,/attributionControl=\{false\}/)
    assert.match(source,/<AttributionControl prefix=\{false\}/)
   }
  }
 }
 await inspect('app');await inspect('components')
})
