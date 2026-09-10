/**
 * Live validation for the NBDC county selection fix.
 *
 * Runs the real fetchNBDCEcologySouthEast connector (no mock fetcher) against the
 * live GBIF occurrence API for each of the five south-east counties and asserts
 * that every ACCEPTED record was actually assigned to the requested county's
 * validated GADM level-1 GID. Prints fetched / accepted / rejected per county.
 *
 * Zero accepted records for a county is treated as a FAILURE for that county:
 * a working population must return at least one validated record.
 *
 * Usage: yarn tsx scripts/validate-nbdc-gadm.ts
 */
import {fetchNBDCEcologySouthEast,NBDC_GADM,COUNTIES} from '../lib/ingest/connectors-ireland'

async function main(){
 let failures=0
 console.log('NBDC GADM county validation (live GBIF)\n'+'='.repeat(60))
 for(const county of COUNTIES){
  const gid=NBDC_GADM[county]
  try{
   const r=await fetchNBDCEcologySouthEast(county,{limit:20,offset:0})
   const accepted=r.records.length,rejected=r.rejected,fetched=accepted+rejected
   console.log(`\n${county} (GADM ${gid})`)
   console.log(`  status=${r.status} fetched=${fetched} accepted=${accepted} rejected=${rejected} nextOffset=${r.nextOffset}`)
   if(r.status==='error'){console.error(`  FAIL: connector error: ${r.error}`);failures++;continue}
   if(accepted===0){console.error('  FAIL: zero accepted records — population not demonstrated');failures++;continue}
   for(const rec of r.records){
    const text=rec.sections[0]?.text??''
    if(!text.includes(`"gadmLevel1Gid":"${gid}"`)){console.error(`  FAIL: record ${rec.representation_id} missing/incorrect gadmLevel1Gid (expected ${gid})`);failures++;break}
    if(!text.includes(`"county":"${county}"`)){console.error(`  FAIL: record ${rec.representation_id} missing county assignment ${county}`);failures++;break}
    if(rec.jurisdiction!=='Republic of Ireland'){console.error(`  FAIL: record ${rec.representation_id} wrong jurisdiction ${rec.jurisdiction}`);failures++;break}
   }
   if(failures===0||r.records.every(rec=>(rec.sections[0]?.text??'').includes(`"gadmLevel1Gid":"${gid}"`)))console.log('  OK: every accepted record carries the county GADM GID')
  }catch(e){console.error(`  FAIL: ${county} threw ${e instanceof Error?e.message:String(e)}`);failures++}
 }
 console.log('\n'+'='.repeat(60))
 if(failures){console.error(`VALIDATION FAILED: ${failures} problem(s)`);process.exit(1)}
 console.log('VALIDATION PASSED: all counties returned records assigned to their own GADM GID')
}
main().catch(e=>{console.error(e);process.exit(1)})
