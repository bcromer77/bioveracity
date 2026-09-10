import { object, id, json, page, record, failure, safeReason } from './connectors-scotland'
import type { Options, ConnectorResult, RejectionNote } from './connectors-scotland'
import { parseEvidenceDate } from '../evidence-contract'
export const COUNTIES=['Wexford','Waterford','Wicklow','Carlow','Kilkenny'] as const
export type County=typeof COUNTIES[number]
export const NBDC_PUBLISHER='d2b97690-bfd6-11de-b279-d52977ace833'
// GADM level-1 GIDs resolved and validated against the live GBIF geocode API on 2026-09-10
// (https://api.gbif.org/v1/geocode/gadm/IRL/subdivisions and .../gadm/{gid}); each confirmed
// englishType "County" with higherRegion Ireland (IRL). NBDC's GBIF records leave stateProvince
// null but populate gadm.level1.gid, so county selection uses the validated GADM GID rather than
// a free-text province string or a single regional bounding box.
export const NBDC_GADM:Record<County,string>={Carlow:'IRL.1_1',Kilkenny:'IRL.10_1',Waterford:'IRL.23_1',Wexford:'IRL.25_1',Wicklow:'IRL.26_1'}
export const IRISH_PLANNING='https://services.arcgis.com/NzlPQPKn5QF9v2US/arcgis/rest/services/IrishPlanningApplications/FeatureServer/0'
export function countyName(value: unknown): string {return typeof value==='string'?value.toLowerCase().trim().replace(/^(county|co\.)\s+/,'').replace(/\s+county$/,''):''}
function countyCheck(county: County){if(!COUNTIES.includes(county))throw Error('Unsupported county')}
export async function fetchNBDCEcologySouthEast(county: County, options: Options = {}): Promise<ConnectorResult>{
 const source=`nbdc-${county.toLowerCase()}`,coverage=`NBDC-published GBIF records assigned to ${county} by GADM administrative area (level-1 GID ${NBDC_GADM[county]}); county/year projection only, not complete county species coverage.`
 try{
  countyCheck(county);const {offset,limit}=page(options);const gid=NBDC_GADM[county]
  const params=new URLSearchParams({publishingOrg:NBDC_PUBLISHER,country:'IE',gadmGid:gid,limit:String(limit),offset:String(offset)})
  const data=object(await json(`https://api.gbif.org/v1/occurrence/search?${params}`,options));if(!Array.isArray(data.results))throw Error('schema')
  const records=[];const rejections:RejectionNote[]=[]
  for(const value of data.results.slice(0,limit))try{
   const a=object(value),key=id(a.key),level1=object(object(a.gadm).level1)
   if(a.publishingOrgKey!==NBDC_PUBLISHER||a.countryCode!=='IE'||id(level1.gid)!==gid)throw Error('Wrong publisher or county')
   // Flagged records stay out of automated intake, even if coordinates were already generalised.
   if(a.informationWithheld||a.dataGeneralizations)throw Error('Withheld/generalised source needs separate review')
   if(typeof a.scientificName!=='string'||!a.scientificName.trim())throw Error('Missing taxon')
   const selected=Object.fromEntries(['key','datasetKey','publishingOrgKey','scientificName','taxonKey','basisOfRecord','license','countryCode','year'].map(k=>[k,a[k]??null]));selected.gadmLevel1Gid=gid;selected.county=county
   const year=Number.isInteger(a.year)&&Number(a.year)>0&&Number(a.year)<=9999?parseEvidenceDate(String(a.year).padStart(4,'0')):{value:null,precision:'unknown' as const}
   const r=record(`https://www.gbif.org/occurrence/${encodeURIComponent(key)}`,`NBDC species record: ${a.scientificName} (${county})`,'National Biodiversity Data Centre via GBIF','ie:nbdc',`gbif:${key}:county-year`,selected,(options.now?.()??new Date()).toISOString());r.jurisdiction='Republic of Ireland';r.event_date=year.value;r.event_date_precision=year.precision;records.push(r)
  }catch(e){let locator:string|null=null;try{locator=id(object(value).key)}catch{}rejections.push({locator,reason:safeReason(e)})}
  // 'partial' flags rejected records for review; the cursor still advances past them (see nextCursor)
  // so a permanently-rejectable record can never stall this county at one offset.
  return {source,coverage,status:rejections.length?'partial':'ok',records,rejected:rejections.length,rejections,nextOffset:data.endOfRecords===true?null:offset+limit}
 }catch(e){return failure(source,coverage,e)}
}
export async function fetchSouthEastIrishPlanningData(county: County,options: Options = {}):Promise<ConnectorResult>{
 const source=`irish-planning-${county.toLowerCase()}`,coverage=`${county} application metadata only; no applicant names, addresses, proposals or objections. Authority match is explicit, not a bounding-box guess.`
 try{
  countyCheck(county);const {offset,limit}=page(options)
  const authorities=county==='Waterford'?['Waterford','Waterford County Council','Waterford City Council','Waterford City and County Council']: [county,`${county} County Council`]
  const where=`PlanningAuthority IN (${authorities.map(a=>`'${a}'`).join(',')})`
  const fields='OBJECTID,PlanningAuthority,ApplicationNumber,ApplicationStatus,ApplicationType'
  const params=new URLSearchParams({f:'json',where,outFields:fields,returnGeometry:'false',orderByFields:'OBJECTID ASC',resultOffset:String(offset),resultRecordCount:String(limit)})
  const data=object(await json(`${IRISH_PLANNING}/query?${params}`,options));if(!Array.isArray(data.features))throw Error('schema')
  const records=[];const rejections:RejectionNote[]=[]
  for(const f of data.features.slice(0,limit))try{
   const a=object(object(f).attributes),oid=id(a.OBJECTID),ref=id(a.ApplicationNumber)
   if(!authorities.includes(String(a.PlanningAuthority)))throw Error('Wrong authority')
   const selected=Object.fromEntries(fields.split(',').map(k=>[k,a[k]??null]))
   const query=new URLSearchParams({f:'json',objectIds:oid,outFields:fields,returnGeometry:'false'})
   const r=record(`${IRISH_PLANNING}/query?${query}`,`${county} planning application ${ref}`,String(a.PlanningAuthority),`ie:bioveracity:${county.toLowerCase()}-county-council`,`planning:${a.PlanningAuthority}:${ref}`,selected,(options.now?.()??new Date()).toISOString());r.jurisdiction='Republic of Ireland';records.push(r)
  }catch(e){let locator:string|null=null;try{locator=id(object(object(f).attributes).OBJECTID)}catch{}rejections.push({locator,reason:safeReason(e)})}
  return {source,coverage,status:rejections.length?'partial':'ok',records,rejected:rejections.length,rejections,nextOffset:data.exceededTransferLimit===true?offset+limit:null}
 }catch(e){return failure(source,coverage,e)}
}
export async function fetchEPARiverDataSouthEast():Promise<ConnectorResult>{
 return {source:'epa-wfd',status:'blocked',records:[],rejected:0,nextOffset:null,coverage:'Requested five-county river WFD assessments; not telemetry or risk classification.',error:'Official 2019–2024 catalogue located, but a queryable layer and status schema remain unverified. No guessed WFD_Status layer or invented assessment date is used.'}
}
