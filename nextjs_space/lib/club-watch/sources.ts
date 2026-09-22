import { WorkspaceError } from '../workspaces/service'

export type WatchConfig = { scopeLabel: string; west: number; south: number; east: number; north: number; waterbodyCode: string; scopeConfirmed: true }
export type SourceId = 'planning' | 'epa'
export type SourceRecord = { key: string; title: string; summary: string; publisher: string; sourceUrl: string; eventDate: string | null; period: string | null; caveat: string }
export const PLANNING_URL = 'https://services.arcgis.com/NzlPQPKn5QF9v2US/arcgis/rest/services/IrishPlanningApplications/FeatureServer/0/query'
export const EPA_URL = 'https://wfdapi.edenireland.ie/api/waterbody/'
export function watchConfig(value: unknown): WatchConfig {
  if (!value || typeof value !== 'object') throw new WorkspaceError(400,'Configure the club’s agreed source area.')
  const v=value as Record<string,unknown>
  if (v.scopeConfirmed !== true || typeof v.scopeLabel !== 'string' || !v.scopeLabel.trim() || v.scopeLabel.length>160 || typeof v.waterbodyCode !== 'string' || !/^IE_[A-Z0-9_]{3,50}$/.test(v.waterbodyCode)) throw new WorkspaceError(400,'Confirm the map area, scope description and exact EPA waterbody code with the club.')
  for (const k of ['west','south','east','north']) if (typeof v[k] !== 'number' || !Number.isFinite(v[k])) throw new WorkspaceError(400,'Valid map bounds are required.')
  const {west,south,east,north}=v as unknown as WatchConfig
  if (west < -6.7 || east > -6 || south < 52.9 || north > 53.7 || west>=east || south>=north || east-west>.08 || north-south>.06) throw new WorkspaceError(400,'The Dublin pilot needs a bounded local area, at most 0.08° by 0.06°.')
  return {scopeLabel:v.scopeLabel.trim(),west,south,east,north,waterbodyCode:v.waterbodyCode,scopeConfirmed:true}
}
type ObjectValue = Record<string,unknown>
const object=(v:unknown):ObjectValue=>v && typeof v==='object' && !Array.isArray(v) ? v as ObjectValue : {}
const text=(v:unknown,max=300)=>typeof v==='string'?v.trim().slice(0,max):''
const date=(v:unknown)=>typeof v==='number' && Number.isFinite(v) && v>0 && v<Date.UTC(2100,0,1) ? new Date(v).toISOString().slice(0,10) : null
export async function sourceJson(url: string, transport: typeof fetch=fetch): Promise<unknown> {
  const response=await transport(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}})
  if (!response.ok || !response.body) throw Error('Source unavailable')
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000000)throw Error('Source response exceeds limit');chunks.push(value)} }
  finally {await reader.cancel()}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}
export async function planningRecords(config:WatchConfig,load:(url:string)=>Promise<unknown>=sourceJson):Promise<SourceRecord[]> {
  const records:SourceRecord[]=[]
  for(let offset=0;offset<2000;offset+=200){
    const params=new URLSearchParams({f:'json',where:"PlanningAuthority='Dublin City Council'",geometry:`${config.west},${config.south},${config.east},${config.north}`,geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'OBJECTID,PlanningAuthority,ApplicationNumber,ApplicationStatus,Decision,ReceivedDate,DecisionDate',returnGeometry:'true',orderByFields:'OBJECTID ASC',resultOffset:String(offset),resultRecordCount:'200'})
    const raw=object(await load(`${PLANNING_URL}?${params}`))
    if(raw.error || !Array.isArray(raw.features))throw Error('Planning schema unavailable')
    for(const value of raw.features){
      const f=object(value),a=object(f.attributes),g=object(f.geometry)
      if(a.PlanningAuthority!=='Dublin City Council' || !Number.isSafeInteger(a.OBJECTID) || !text(a.ApplicationNumber))throw Error('Unexpected planning record')
      if(typeof g.x!=='number'||typeof g.y!=='number')throw Error('Planning record has no usable point')
      if(g.x<config.west || g.x>config.east || g.y<config.south || g.y>config.north)continue
      const key=String(a.OBJECTID),received=date(a.ReceivedDate),decision=date(a.DecisionDate)
      const sourceUrl=`${PLANNING_URL}?${new URLSearchParams({f:'json',objectIds:key,outFields:'OBJECTID,PlanningAuthority,ApplicationNumber,ApplicationStatus,Decision,ReceivedDate,DecisionDate',returnGeometry:'false'})}`
      records.push({key,title:`Dublin City Council planning ${text(a.ApplicationNumber,80)}`,summary:`Application status: ${text(a.ApplicationStatus)||'not provided'}. Decision: ${text(a.Decision)||'not provided'}. Received: ${received||'date unknown'}. Decision date: ${decision||'unknown'}.`,publisher:'Dublin City Council via the National Planning Application Database',sourceUrl,eventDate:decision||received,period:null,caveat:'Official planning metadata within the agreed map area. This does not establish an effect on the club, habitat condition or compliance. Consult the council application file for details.'})
    }
    if(!raw.exceededTransferLimit) return records
    if(!raw.features.length)throw Error('Planning pagination did not advance')
  }
  throw Error('Planning coverage exceeded the 2,000-record limit; narrow the area')
}
export async function epaRecords(config:WatchConfig,load:(url:string)=>Promise<unknown>=sourceJson):Promise<SourceRecord[]> {
  const sourceUrl=`${EPA_URL}${encodeURIComponent(config.waterbodyCode)}`,raw=object(await load(sourceUrl))
  if(raw.Code!==config.waterbodyCode || !text(raw.Name) || !Array.isArray(raw.Status))throw Error('EPA waterbody schema did not match')
  const records:SourceRecord[]=[]
  for(const value of raw.Status){
    const period=object(value)
    if(!text(period.Code)||!Array.isArray(period.Status))throw Error('EPA assessment period is missing')
    const ecological=period.Status.map(object).find(v=>v.Name==='Ecological Status or Potential')
    if(!ecological)continue
    if(!text(ecological.Status))throw Error('EPA ecological status is missing')
    records.push({key:`${config.waterbodyCode}:${text(period.Code,80)}`,title:`${text(raw.Name,100)} — ${text(period.Code,80)}`,summary:`Ecological status or potential: ${text(ecological.Status)}. Assessment: ${text(ecological.AssessmentTechnique)||'not supplied'}. Confidence: ${text(ecological.StatusConfidence)||'not supplied'}.`,publisher:'Environmental Protection Agency, Ireland · CC BY 4.0',sourceUrl,eventDate:null,period:text(period.Code,80),caveat:'This is a waterbody assessment for the stated period, not a live sensor reading or a measurement of the club. The waterbody association is geographic context, not proof of causation.'})
  }
  return records
}
