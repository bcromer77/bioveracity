// Scheduled HTTP client. No direct database, AI, or arbitrary source endpoints.
import fs from 'node:fs/promises'
import path from 'node:path'
// The 26 counties of the Republic of Ireland (lowercase source slugs), mirroring COUNTIES in
// lib/ingest/connectors-ireland.ts. Kept as a literal list because this scheduled client is plain
// .mjs (run by node with no TypeScript loader) and must not import the connector module.
export const IRISH_COUNTIES=['carlow','cavan','clare','cork','donegal','dublin','galway','kerry','kildare','kilkenny','laois','leitrim','limerick','longford','louth','mayo','meath','monaghan','offaly','roscommon','sligo','tipperary','waterford','westmeath','wexford','wicklow']
export const SOURCES=['sepa','naturescot-sssi','naturescot-habitats','natural-england-habitats','ea-gauges',...IRISH_COUNTIES.flatMap(c=>[`nbdc-${c}`,`irish-planning-${c}`]),'epa-wfd','glasgow-planning','east-anglia-comments']
// Honest phase label derived from the real cursor state, so incremental checks are distinguished
// from historical backfill in the report (never inferred from a green job alone). 'backfill' means
// more historical pages remain for this source; 'sweep-complete' means a full historical pass just
// finished (cursor reset to 0); 'incremental' means the source began and ended at page 0 (a single
// bounded page covered it — up to date); non-ok statuses pass through unchanged (error/blocked/empty).
export function phaseOf(offset,cursor,status){
 if(status!=='ok'&&status!=='partial')return status
 if(typeof cursor==='number'&&cursor>0)return 'backfill'
 if(typeof offset==='number'&&offset>0)return 'sweep-complete'
 return 'incremental'
}
export function nextCursor(previous,result,dryRun){
 // Advance only on an explicit write acknowledgement with exactly zero failed writes. A rejected
 // record makes a page 'partial' but is permanent, so we still skip past it to prevent a stalled
 // county; a failed DB write is transient and holds the cursor for an idempotent retry. A missing
 // acknowledgement, a non-zero (or absent) failedWrites, or a fetch/error/blocked status all hold.
 const s=result.sources?.[0]
 if(dryRun)return previous
 if(result.writesAcknowledged!==true||result.failedWrites!==0)return previous
 if(!s||(s.status!=='ok'&&s.status!=='partial'))return previous
 const n=s.nextOffset
 if(n===null)return 0
 if(!Number.isInteger(n)||n<0||n>100000)throw Error('Invalid source cursor')
 return n
}
// Shared endpoint/credential guard for both intake tracks: only the canonical HTTPS route, no
// embedded credentials or query, and a 64-hex bearer secret. Returns the validated URL object.
export function assertEndpoint(endpoint,secret){
 const url=new URL(endpoint)
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/api/ingest/external')throw Error('Canonical HTTPS intake endpoint required')
 if(!/^[a-f0-9]{64}$/i.test(secret??''))throw Error('Secure credential missing')
 return url
}
// TRACK 1 - BOUNDED HISTORICAL BACKFILL. Walks a persistent per-source offset cursor deeper into
// each source's history, one bounded page per run, advancing only on an acknowledged zero-failure
// write (see nextCursor). A completed sweep resets to 0. This is deliberately NOT the daily-current
// feed: with newest-first ordering the freshest records live at offset 0 and are covered every run
// by reconcileHead below, so this track is free to grind through history without blocking currency.
export async function refresh({endpoint,secret,stateDir,dryRun=true,fetcher=fetch}){
 const url=assertEndpoint(endpoint,secret)
 await fs.mkdir(stateDir,{recursive:true})
 const file=path.join(stateDir,'cursors.json');let cursors={}
 try{cursors=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const report=[]
 for(const source of SOURCES){
  const offset=cursors[source]??0
  if(!Number.isInteger(offset)||offset<0||offset>100000)throw Error('Invalid saved cursor')
  try{
   const res=await fetcher(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify({source,offset,limit:5,dryRun})})
   if(!res.ok)throw Error(`HTTP ${res.status}`)
   const text=await res.text();if(text.length>16000)throw Error('Oversized response')
   const result=JSON.parse(text)
   if(result.sources?.length!==1||result.sources[0].source!==source)throw Error('Source mismatch')
   cursors[source]=nextCursor(offset,result,dryRun)
   report.push({source,status:result.sources[0].status,phase:phaseOf(offset,cursors[source],result.sources[0].status),readOffset:offset,fetched:result.totalFetched,created:result.created,duplicates:result.duplicates,catalogueOnly:result.catalogueOnly,rejected:result.sources[0].rejected,rejections:result.sources[0].rejections,acknowledged:result.writesAcknowledged,failedWrites:result.failedWrites,nextOffset:cursors[source],dryRun})
  }catch{report.push({source,status:'error',phase:'error',readOffset:offset,nextOffset:offset,dryRun})}
  // Atomic checkpoints after every source. Never persist records, credentials or response bodies.
  await fs.writeFile(file+'.tmp',JSON.stringify(cursors));await fs.rename(file+'.tmp',file)
 }
 await fs.writeFile(path.join(stateDir,'report.json'),JSON.stringify({checkedAt:new Date().toISOString(),report},null,2))
 return report
}
// TRACK 2 - DAILY CURRENT UPDATES. Re-reads the head window (offset 0) of every source on every
// run, independent of the backfill cursor and never mutating it, so a stalled or slow backfill can
// never delay currency. Overlap with records already stored (by backfill or a prior daily pass) is
// absorbed server-side by version-hash dedup, reported as duplicates rather than re-created rows.
// HONEST COVERAGE: for planning sources the connector orders newest-first, so offset 0 is genuinely
// the most recent applications - a true current feed. For GBIF/NBDC species sources the occurrence
// API offers no modification ordering and offset 0 is the head of a fixed id-ordered list, so this
// pass is a bounded reconciliation of that reachable window, NOT capture of newly published
// occurrences (which requires the GBIF Download API, out of scope). The phase label reflects this.
export async function reconcileHead({endpoint,secret,stateDir,dryRun=true,fetcher=fetch,limit=5,sources=SOURCES}){
 const url=assertEndpoint(endpoint,secret)
 const report=[]
 for(const source of sources){
  try{
   const res=await fetcher(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify({source,offset:0,limit,dryRun})})
   if(!res.ok)throw Error(`HTTP ${res.status}`)
   const text=await res.text();if(text.length>16000)throw Error('Oversized response')
   const result=JSON.parse(text)
   if(result.sources?.length!==1||result.sources[0].source!==source)throw Error('Source mismatch')
   report.push({source,track:'daily',status:result.sources[0].status,readOffset:0,fetched:result.totalFetched,created:result.created,duplicates:result.duplicates,catalogueOnly:result.catalogueOnly,rejected:result.sources[0].rejected,rejections:result.sources[0].rejections,acknowledged:result.writesAcknowledged,failedWrites:result.failedWrites,dryRun})
  }catch{report.push({source,track:'daily',status:'error',readOffset:0,dryRun})}
 }
 if(stateDir){await fs.mkdir(stateDir,{recursive:true});await fs.writeFile(path.join(stateDir,'daily-report.json'),JSON.stringify({checkedAt:new Date().toISOString(),report},null,2))}
 return report
}
if(process.argv[1]&&import.meta.url===new URL('file:'+path.resolve(process.argv[1])).href){
 const opts={endpoint:process.env.REGIONAL_INGEST_ENDPOINT,secret:process.env.INGEST_CRON_SECRET,stateDir:process.env.REGIONAL_STATE_DIR,dryRun:process.env.REGIONAL_DRY_RUN!=='false'}
 // Daily current-updates first (fast, always the freshest records), then one bounded backfill page.
 const daily=await reconcileHead(opts)
 const backfill=await refresh(opts)
 console.log(JSON.stringify({daily,backfill}))
 if([...daily,...backfill].some(r=>r.status!=='ok'&&r.status!=='partial'||r.failedWrites))process.exitCode=2
}
