import { object, id, json, page, bbox, record, failure } from './connectors-scotland'
import type { Options, ConnectorResult } from './connectors-scotland'
export const ENGLAND_BBOX = '-0.6,51.7,1.9,53.0'
export const PRIORITY_HABITATS = 'https://services.arcgis.com/JJzESW51TqeY9uat/arcgis/rest/services/Priority_Habitats_Inventory_England/FeatureServer/0'
export async function fetchNaturalEnglandHabitats(options: Options = {}): Promise<ConnectorResult> {
 const source='natural-england-habitats', coverage='Bounded Priority Habitats Inventory within an East Anglia discovery envelope, not exact county boundaries or current condition.'
 try {
  const {offset,limit}=page(options)
  const params=new URLSearchParams({f:'json',where:'1=1',outFields:'OBJECTID,GlobalID,MainHabs,HabCodes,FeatDesc',geometry:bbox(ENGLAND_BBOX),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',returnGeometry:'false',orderByFields:'OBJECTID ASC',resultOffset:String(offset),resultRecordCount:String(limit)})
  const data=object(await json(`${PRIORITY_HABITATS}/query?${params}`,options));if(!Array.isArray(data.features))throw Error('schema')
  const records=[];let rejected=0
  for(const f of data.features.slice(0,limit))try {
   const a=object(object(f).attributes),oid=id(a.OBJECTID),key=id(a.GlobalID)
   if(typeof a.MainHabs!=='string'||!a.MainHabs.trim())throw Error('habitat')
   const selected=Object.fromEntries(['OBJECTID','GlobalID','MainHabs','HabCodes','FeatDesc'].map(k=>[k,a[k]??null]))
   const query=new URLSearchParams({f:'json',objectIds:oid,outFields:'OBJECTID,GlobalID,MainHabs,HabCodes,FeatDesc',returnGeometry:'false'})
   const r=record(`${PRIORITY_HABITATS}/query?${query}`,`Natural England habitat: ${a.MainHabs}`,'Natural England','uk:natural-england',`priority-habitat:${key}`,selected,(options.now?.()??new Date()).toISOString());r.jurisdiction='England';records.push(r)
  }catch{rejected++}
  return {source,coverage,status:rejected?'partial':'ok',records,rejected,nextOffset:data.exceededTransferLimit===true?offset+limit:null}
 }catch(e){return failure(source,coverage,e)}
}
export async function fetchEnvironmentAgencyData(options: Options = {}): Promise<ConnectorResult> {
 const source='ea-gauges',coverage='Level-gauge catalogue within 75 km of Cambridge; latest readings retained only when supplied. Not all England or all East Anglia.'
 try{
  const {offset,limit}=page(options)
  const params=new URLSearchParams({parameter:'level',lat:'52.2',long:'0.12',dist:'75',_limit:String(limit),_offset:String(offset),_view:'full'})
  const data=object(await json(`https://environment.data.gov.uk/flood-monitoring/id/stations?${params}`,options));if(!Array.isArray(data.items))throw Error('schema')
  const records=[];let rejected=0
  for(const value of data.items.slice(0,limit))try{
   const s=object(value),key=id(s.stationReference)
   const selected=Object.fromEntries(['stationReference','label','riverName','lat','long','measures','status'].map(k=>[k,s[k]??null]))
   const r=record(`https://environment.data.gov.uk/flood-monitoring/id/stations/${encodeURIComponent(key)}`,`Environment Agency gauge: ${String(s.label??key).slice(0,200)}`,'Environment Agency','uk:environment-agency',`ea-gauge:${key}`,selected,(options.now?.()??new Date()).toISOString());r.jurisdiction='England';records.push(r)
  }catch{rejected++}
  return {source,coverage,status:rejected?'partial':'ok',records,rejected,nextOffset:data.items.length>=limit?offset+limit:null}
 }catch(e){return failure(source,coverage,e)}
}
