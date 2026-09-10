import { fetchSEPARiverLevels,fetchNatureScotProtectedSites,fetchNatureScotHabitats,fetchScottishPlanningData,page } from './connectors-scotland'
import type { ConnectorResult,EvidenceInput } from './connectors-scotland'
import { fetchNaturalEnglandHabitats,fetchEnvironmentAgencyData } from './connectors'
import { COUNTIES,fetchNBDCEcologySouthEast,fetchSouthEastIrishPlanningData,fetchEPARiverDataSouthEast } from './connectors-ireland'
import { scrapeEastAngliaObjections } from './scrapers/east-anglia-planning'
import { handleScotlandPost,validCronKey } from './scotland-pipeline'
const SCOTLAND='-8.7,54.5,-0.5,61.0'
export const REGIONAL_SOURCES:Record<string,(offset:number,limit:number)=>Promise<ConnectorResult>>={
 sepa:(offset,limit)=>fetchSEPARiverLevels({offset,limit}),
 'naturescot-sssi':(offset,limit)=>fetchNatureScotProtectedSites(SCOTLAND,{offset,limit}),
 'naturescot-habitats':(offset,limit)=>fetchNatureScotHabitats({offset,limit},SCOTLAND),
 'natural-england-habitats':(offset,limit)=>fetchNaturalEnglandHabitats({offset,limit}),
 'ea-gauges':(offset,limit)=>fetchEnvironmentAgencyData({offset,limit}),
 ...Object.fromEntries(COUNTIES.flatMap(county=>[
  [`nbdc-${county.toLowerCase()}`,(offset:number,limit:number)=>fetchNBDCEcologySouthEast(county,{offset,limit})],
  [`irish-planning-${county.toLowerCase()}`,(offset:number,limit:number)=>fetchSouthEastIrishPlanningData(county,{offset,limit})],
 ])),
 'epa-wfd':()=>fetchEPARiverDataSouthEast(),
 'glasgow-planning':()=>fetchScottishPlanningData(),
 'east-anglia-comments':()=>scrapeEastAngliaObjections(),
}
export async function handleRegionalPost(request:Request,settings:Parameters<typeof handleScotlandPost>[1],receive:(r:EvidenceInput)=>Promise<{duplicate:boolean;status:string}>,registry=REGIONAL_SOURCES){
 if(settings.enabled!=='true')return Response.json({error:'Regional intake disabled'},{status:503})
 if(!validCronKey(request.headers.get('authorization'),settings.secret))return Response.json({error:'Unauthorised'},{status:401})
 try{
  const reader=request.body?.getReader();let size=0;const chunks:Uint8Array[]=[]
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw Error()}chunks.push(value)}
  const input:unknown=size?JSON.parse(Buffer.concat(chunks).toString('utf8')):{}
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error()
  const p=input as Record<string,unknown>
  if(Object.keys(p).some(k=>!['source','offset','limit','dryRun'].includes(k))||typeof p.source!=='string'||!Object.hasOwn(registry,p.source))throw Error()
  page({offset:p.offset as number|undefined,limit:p.limit as number|undefined})
  if(p.dryRun!==undefined&&typeof p.dryRun!=='boolean')throw Error()
  const forwarded=new Request(request.url,{method:'POST',headers:{authorization:request.headers.get('authorization')!},body:JSON.stringify({offset:p.offset,limit:p.limit,dryRun:p.dryRun})})
  const fn=registry[p.source]
  return handleScotlandPost(forwarded,settings,receive,async(offset,limit)=>[await fn(offset,limit)])
 }catch{return Response.json({error:'Specify one known source and a bounded page'},{status:400})}
}
