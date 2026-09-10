import test from 'node:test'
import assert from 'node:assert/strict'
import {fetchNBDCEcologySouthEast,fetchSouthEastIrishPlanningData,NBDC_PUBLISHER,COUNTIES,fetchEPARiverDataSouthEast} from '../lib/ingest/connectors-ireland'
import {fetchNaturalEnglandHabitats,fetchEnvironmentAgencyData} from '../lib/ingest/connectors'
import {handleRegionalPost,REGIONAL_SOURCES} from '../lib/ingest/regional-pipeline'
const mock=(data:unknown)=>(async()=>Response.json(data)) as typeof fetch
const now=()=>new Date('2026-09-10T12:00:00Z')
test('NBDC projection excludes locality, coordinates, people and precise dates',async()=>{
 const value={key:1,datasetKey:'dataset',publishingOrgKey:NBDC_PUBLISHER,countryCode:'IE',stateProvince:'County Wexford',scientificName:'Synthetic species',year:2003,eventDate:'2003-03-04',decimalLatitude:52.3,locality:'private place',recordedBy:'person'}
 const r=await fetchNBDCEcologySouthEast('Wexford',{now,fetcher:mock({results:[value],endOfRecords:true})})
 assert.equal(r.records.length,1);assert.equal(r.records[0].event_date,'2003')
 assert.doesNotMatch(r.records[0].sections[0].text,/private place|person|decimalLatitude|2003-03-04/)
 const wrong=await fetchNBDCEcologySouthEast('Carlow',{now,fetcher:mock({results:[value],endOfRecords:true})});assert.equal(wrong.rejected,1)
 const withheld=await fetchNBDCEcologySouthEast('Wexford',{now,fetcher:mock({results:[{...value,informationWithheld:'sensitive'}],endOfRecords:true})});assert.equal(withheld.records.length,0)
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
