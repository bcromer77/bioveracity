// Scheduled HTTP client. No direct database, AI, or arbitrary source endpoints.
import fs from 'node:fs/promises'
import path from 'node:path'
export const SOURCES=['sepa','naturescot-sssi','naturescot-habitats','natural-england-habitats','ea-gauges',...['wexford','waterford','wicklow','carlow','kilkenny'].flatMap(c=>[`nbdc-${c}`,`irish-planning-${c}`]),'epa-wfd','glasgow-planning','east-anglia-comments']
export function nextCursor(previous,result,dryRun){
 // A rejected record makes a page 'partial' but is permanent, so we still advance past it
 // (skip) to prevent a stalled county. Failed DB writes are transient: they keep the cursor
 // in place so the same page is retried (receive is idempotent). Fetch/error/blocked also hold.
 const s=result.sources?.[0]
 if(dryRun||result.failedWrites||!s||(s.status!=='ok'&&s.status!=='partial'))return previous
 const n=s.nextOffset
 if(n===null)return 0
 if(!Number.isInteger(n)||n<0||n>100000)throw Error('Invalid source cursor')
 return n
}
export async function refresh({endpoint,secret,stateDir,dryRun=true,fetcher=fetch}){
 const url=new URL(endpoint)
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/api/ingest/external')throw Error('Canonical HTTPS intake endpoint required')
 if(!/^[a-f0-9]{64}$/i.test(secret??''))throw Error('Secure credential missing')
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
   report.push({source,status:result.sources[0].status,fetched:result.totalFetched,created:result.created,duplicates:result.duplicates,catalogueOnly:result.catalogueOnly,rejected:result.sources[0].rejected,rejections:result.sources[0].rejections,failedWrites:result.failedWrites,nextOffset:cursors[source],dryRun})
  }catch{report.push({source,status:'error',nextOffset:offset,dryRun})}
  // Atomic checkpoints after every source. Never persist records, credentials or response bodies.
  await fs.writeFile(file+'.tmp',JSON.stringify(cursors));await fs.rename(file+'.tmp',file)
 }
 await fs.writeFile(path.join(stateDir,'report.json'),JSON.stringify({checkedAt:new Date().toISOString(),report},null,2))
 return report
}
if(process.argv[1]&&import.meta.url===new URL('file:'+path.resolve(process.argv[1])).href){
 const report=await refresh({endpoint:process.env.REGIONAL_INGEST_ENDPOINT,secret:process.env.INGEST_CRON_SECRET,stateDir:process.env.REGIONAL_STATE_DIR,dryRun:process.env.REGIONAL_DRY_RUN!=='false'})
 console.log(JSON.stringify(report))
 if(report.some(r=>r.status!=='ok'||r.failedWrites))process.exitCode=2
}
