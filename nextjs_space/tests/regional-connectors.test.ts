import test from 'node:test'
import assert from 'node:assert/strict'
import {fetchNBDCEcologySouthEast,fetchSouthEastIrishPlanningData,NBDC_PUBLISHER,NBDC_GADM,COUNTIES,fetchEPARiverDataSouthEast} from '../lib/ingest/connectors-ireland'
import type {County} from '../lib/ingest/connectors-ireland'
import {fetchNaturalEnglandHabitats,fetchEnvironmentAgencyData} from '../lib/ingest/connectors'
import {handleRegionalPost,REGIONAL_SOURCES} from '../lib/ingest/regional-pipeline'
const mock=(data:unknown)=>(async()=>Response.json(data)) as typeof fetch
const now=()=>new Date('2026-09-10T12:00:00Z')
const nbdcValue=(county:County)=>({key:1,datasetKey:'dataset',publishingOrgKey:NBDC_PUBLISHER,countryCode:'IE',gadm:{level0:{gid:'IRL',name:'Ireland'},level1:{gid:NBDC_GADM[county],name:county}},scientificName:'Synthetic species',year:2003,eventDate:'2003-03-04',decimalLatitude:52.3,locality:'private place',recordedBy:'person'})
test('NBDC selection uses the validated GADM level-1 GID and excludes locality, coordinates, people and precise dates',async()=>{
 const value=nbdcValue('Wexford')
 const r=await fetchNBDCEcologySouthEast('Wexford',{now,fetcher:mock({results:[value],endOfRecords:true})})
 assert.equal(r.records.length,1);assert.equal(r.records[0].event_date,'2003')
 assert.match(r.records[0].sections[0].text,new RegExp(`"gadmLevel1Gid":"${NBDC_GADM.Wexford.replace(/\./g,'\\.')}"`))
 assert.doesNotMatch(r.records[0].sections[0].text,/private place|person|decimalLatitude|2003-03-04|stateProvince/)
 // A record whose GADM area is a different county is rejected, not misassigned to the requested county.
 const wrong=await fetchNBDCEcologySouthEast('Carlow',{now,fetcher:mock({results:[value],endOfRecords:true})});assert.equal(wrong.rejected,1);assert.equal(wrong.records.length,0)
 // A rejected record records a short, safe reason and the record locator for review, never an upstream body.
 assert.equal(wrong.status,'partial');assert.deepEqual(wrong.rejections,[{locator:'1',reason:'Wrong publisher or county'}])
 // Records without a GADM level-1 area cannot be assigned to any county.
 const noGadm=await fetchNBDCEcologySouthEast('Wexford',{now,fetcher:mock({results:[{...value,gadm:undefined}],endOfRecords:true})});assert.equal(noGadm.records.length,0);assert.equal(noGadm.rejected,1)
 assert.equal(noGadm.rejections?.[0]?.reason,'Invalid source object')
 const withheld=await fetchNBDCEcologySouthEast('Wexford',{now,fetcher:mock({results:[{...value,informationWithheld:'sensitive'}],endOfRecords:true})});assert.equal(withheld.records.length,0);assert.equal(withheld.rejections?.[0]?.reason,'Withheld/generalised source needs separate review')
})
test('NBDC assigns every south-east county to its own validated GADM GID',async()=>{
 for(const county of COUNTIES){
  const r=await fetchNBDCEcologySouthEast(county,{now,fetcher:mock({results:[nbdcValue(county)],endOfRecords:true})})
  assert.equal(r.records.length,1,county);assert.equal(r.rejected,0,county)
  assert.match(r.records[0].sections[0].text,new RegExp(`"county":"${county}"`))
  assert.match(r.records[0].sections[0].text,new RegExp(`"gadmLevel1Gid":"${NBDC_GADM[county].replace(/\./g,'\\.')}"`))
 }
})
test('Irish planning enforces each authority and excludes applicant data',async()=>{
 for(const county of COUNTIES){
 const r=await fetchSouthEastIrishPlanningData(county,{now,fetcher:mock({features:[{attributes:{OBJECTID:1,PlanningAuthority:`${county} County Council`,ApplicationNumber:'26/1',ApplicantForename:'Person',DevelopmentAddress:'Private house'}}]})})
 assert.equal(r.records.length,1);assert.doesNotMatch(r.records[0].sections[0].text,/Person|Private house/);assert.equal(r.records[0].event_date,null)
 }
})
test('habitat IDs and gauge zero readings retain source values, not default coordinates',async()=>{
 const ne=await fetchNaturalEnglandHabitats({now,fetcher:mock({features:[{attributes:{OBJECTID:1,GlobalID:'stable',MainHabs:'Synthetic habitat'}}],exceededTransferLimit:true})})
 assert.equal(ne.records[0].jurisdiction,'England');assert.equal(ne.nextOffset,20)
 const ea=await fetchEnvironmentAgencyData({now,fetcher:mock({items:[{stationReference:'fixture',measures:[{latestReading:{value:0}}]}]})})
 assert.match(ea.records[0].sections[0].text,/"value":0/);assert.equal(ea.records[0].event_date,null)
})
test('regional auth runs before source selection and unknown URLs cannot be fetched',async()=>{
 const key='a'.repeat(64);let writes=0
 const receive=async()=>{writes++;return {duplicate:false,status:'PENDING_REVIEW'}}
 const req=(source:string,auth=`Bearer ${key}`)=>new Request('https://example.com/api/ingest/external',{method:'POST',headers:{authorization:auth},body:JSON.stringify({source})})
 assert.equal((await handleRegionalPost(req('sepa','bad'),{enabled:'true',secret:key},receive)).status,401)
 assert.equal((await handleRegionalPost(req('https://attacker.example'),{enabled:'true',secret:key},receive)).status,400)
 assert.equal(writes,0);assert.equal(Object.keys(REGIONAL_SOURCES).length,18)
 assert.equal((await fetchEPARiverDataSouthEast()).status,'blocked')
})
