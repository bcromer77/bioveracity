import { object, id, json, page, record, failure, safeReason } from './connectors-scotland'
import type { Options, ConnectorResult, RejectionNote } from './connectors-scotland'
import { parseEvidenceDate } from '../evidence-contract'
// All 26 counties of the Republic of Ireland. Extended from the original five south-east
// counties on 2026-09-11 to national coverage; each county's GADM level-1 GID and planning
// authority set below were validated against the live GBIF geocode API and the national ArcGIS
// planning layer on 2026-09-11 (every county returned non-zero species and planning counts).
export const COUNTIES=['Carlow','Cavan','Clare','Cork','Donegal','Dublin','Galway','Kerry','Kildare','Kilkenny','Laois','Leitrim','Limerick','Longford','Louth','Mayo','Meath','Monaghan','Offaly','Roscommon','Sligo','Tipperary','Waterford','Westmeath','Wexford','Wicklow'] as const
export type County=typeof COUNTIES[number]
export const NBDC_PUBLISHER='d2b97690-bfd6-11de-b279-d52977ace833'
// GADM level-1 GIDs resolved and validated against the live GBIF geocode API on 2026-09-10
// (https://api.gbif.org/v1/geocode/gadm/IRL/subdivisions and .../gadm/{gid}); each confirmed
// englishType "County" with higherRegion Ireland (IRL). NBDC's GBIF records leave stateProvince
// null but populate gadm.level1.gid, so county selection uses the validated GADM GID rather than
// a free-text province string or a single regional bounding box.
export const NBDC_GADM:Record<County,string>={Carlow:'IRL.1_1',Cavan:'IRL.2_1',Clare:'IRL.3_1',Cork:'IRL.4_1',Donegal:'IRL.5_1',Dublin:'IRL.6_1',Galway:'IRL.7_1',Kerry:'IRL.8_1',Kildare:'IRL.9_1',Kilkenny:'IRL.10_1',Laois:'IRL.11_1',Leitrim:'IRL.12_1',Limerick:'IRL.13_1',Longford:'IRL.14_1',Louth:'IRL.15_1',Mayo:'IRL.16_1',Meath:'IRL.17_1',Monaghan:'IRL.18_1',Offaly:'IRL.19_1',Roscommon:'IRL.20_1',Sligo:'IRL.21_1',Tipperary:'IRL.22_1',Waterford:'IRL.23_1',Westmeath:'IRL.24_1',Wexford:'IRL.25_1',Wicklow:'IRL.26_1'}
// Exact PlanningAuthority strings as stored in the national ArcGIS planning layer, validated live
// on 2026-09-11 (a distinct-values query returned 31 authorities). Most counties map to a single
// authority, but some are served by several: a county is never assumed to equal one council.
// Cork, Galway and Dublin have multiple authorities; Waterford and Limerick use non-standard labels.
export const PLANNING_AUTHORITIES:Record<County,string[]>={
 Carlow:['Carlow County Council'],Cavan:['Cavan County Council'],Clare:['Clare County Council'],
 Cork:['Cork City Council','Cork County Council'],Donegal:['Donegal County Council'],
 Dublin:['Dublin City Council','Dun Laoghaire Rathdown County Council','Fingal County Council','South Dublin County Council'],
 Galway:['Galway City Council','Galway County Council'],Kerry:['Kerry County Council'],
 Kildare:['Kildare County Council'],Kilkenny:['Kilkenny County Council'],Laois:['Laois County Council'],
 Leitrim:['Leitrim County Council'],Limerick:['Limerick County Council'],Longford:['Longford County Council'],
 Louth:['Louth County Council'],Mayo:['Mayo County Council'],Meath:['Meath County Council'],
 Monaghan:['Monaghan County Council'],Offaly:['Offaly County Council'],Roscommon:['Roscommon County Council'],
 Sligo:['Sligo County Council'],Tipperary:['Tipperary County Council'],
 Waterford:['Waterford City and County Council'],Westmeath:['Westmeath County Council'],
 Wexford:['Wexford County Council'],Wicklow:['Wicklow County Council'],
}
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
  // A county may be served by several planning authorities; query all of them explicitly and
  // reject any record whose authority is not in this validated set (no bounding-box guessing).
  const authorities=PLANNING_AUTHORITIES[county]
  const where=`PlanningAuthority IN (${authorities.map(a=>`'${a.replace(/'/g,"''")}'`).join(',')})`
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

// ---------------------------------------------------------------------------
// Map-display connectors (public records for the investigation map).
//
// These are SEPARATE from the intake connectors above. The intake functions
// (fetchNBDCEcologySouthEast / fetchSouthEastIrishPlanningData) deliberately
// strip coordinates and reject generalised records because they feed the
// evidence-contract pipeline. The map needs the opposite: it must KEEP
// coordinates and precision so records can be plotted, and it RETAINS
// generalised records (flagged) rather than dropping them.
//
// They return a lightweight MapLayerResult, never an EvidenceInput, so a
// retrieved public record can never be mistaken for reviewed case evidence,
// auto-accepted, or written into an audit export.
// ---------------------------------------------------------------------------

// GBIF order Chiroptera (all bats). Validated against the live GBIF species API
// on 2026-09-10: taxonKey 734 = order Chiroptera (NOT 732, which returns
// carnivores/pinnipeds). Used to scope occurrence queries to bats only.
export const BAT_TAXON_KEY = 734

export type MapRecord = {
  id: string
  kind: 'species' | 'planning'
  title: string
  subtitle: string
  lat: number
  lng: number
  precisionMeters: number | null
  generalised: boolean
  eventDate: string | null
  datePrecision: 'day' | 'month' | 'year' | 'unknown'
  status: string | null
  detail: string | null
  sourceUrl: string
  license: string | null
}
export type MapLayerResult = {
  layer: 'species' | 'planning'
  status: 'ok' | 'empty' | 'error'
  records: MapRecord[]
  coverage: string
  error?: string
}

// A degree-box around a centre. Latitude is ~111.32 km/deg everywhere; longitude
// shrinks by cos(latitude). Used to scope both upstream spatial queries.
function bboxAround(lat: number, lng: number, radiusKm: number) {
  if (![lat, lng].every(Number.isFinite) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('Invalid centre')
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 100) throw new Error('Invalid radius')
  const dLat = radiusKm / 111.32
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng }
}

// Preserve the observation date and its precision exactly as GBIF returns it —
// a day/month/year string, or the bare year, never a fabricated exact date.
function gbifDate(a: Record<string, unknown>): { eventDate: string | null; datePrecision: MapRecord['datePrecision'] } {
  const raw = typeof a.eventDate === 'string' ? a.eventDate.split('/')[0].trim() : ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return { eventDate: raw.slice(0, 10), datePrecision: 'day' }
  if (/^\d{4}-\d{2}$/.test(raw)) return { eventDate: raw, datePrecision: 'month' }
  if (/^\d{4}$/.test(raw)) return { eventDate: raw, datePrecision: 'year' }
  if (Number.isInteger(a.year) && Number(a.year) > 0 && Number(a.year) <= 9999) return { eventDate: String(a.year), datePrecision: 'year' }
  return { eventDate: null, datePrecision: 'unknown' }
}

// Real bat occurrence records (order Chiroptera) from GBIF near a centre.
// Keeps coordinates + coordinateUncertaintyInMeters (precision), preserves
// provider attribution + observation date, and flags — not drops — generalised
// locations. Never throws: any upstream/schema failure becomes status:'error'
// with a fixed, safe message so the map layer can stay off.
export async function fetchBatOccurrencesNear(
  { lat, lng, radiusKm = 20 }: { lat: number; lng: number; radiusKm?: number },
  options: Options = {},
): Promise<MapLayerResult> {
  const coverage = `Bat occurrence records (order Chiroptera) published to GBIF within about ${radiusKm} km of the selected centre. Provider attribution, observation date and location precision are preserved as returned; generalised locations are kept and flagged, not dropped. Not a complete survey of bats in the area.`
  try {
    const { limit } = page({ limit: options.limit ?? 50, offset: 0 })
    const b = bboxAround(lat, lng, radiusKm)
    const params = new URLSearchParams({
      taxonKey: String(BAT_TAXON_KEY), country: 'IE', hasCoordinate: 'true',
      decimalLatitude: `${b.south},${b.north}`, decimalLongitude: `${b.west},${b.east}`, limit: String(limit),
    })
    const data = object(await json(`https://api.gbif.org/v1/occurrence/search?${params}`, options))
    if (!Array.isArray(data.results)) throw new Error('schema')
    const records: MapRecord[] = []; const seen = new Set<string>()
    for (const value of data.results) {
      try {
        const a = object(value), key = id(a.key)
        if (seen.has(key)) continue
        const y = Number(a.decimalLatitude), x = Number(a.decimalLongitude)
        if (!Number.isFinite(y) || !Number.isFinite(x)) continue
        const name = typeof a.scientificName === 'string' && a.scientificName.trim() ? a.scientificName.trim() : 'Unnamed taxon'
        const uncertainty = Number(a.coordinateUncertaintyInMeters)
        const precisionMeters = Number.isFinite(uncertainty) && uncertainty > 0 ? Math.round(uncertainty) : null
        const generalised = Boolean(a.dataGeneralizations) || Boolean(a.informationWithheld) || (precisionMeters !== null && precisionMeters >= 5000)
        const publisher = a.publishingOrgKey === NBDC_PUBLISHER ? 'National Biodiversity Data Centre'
          : (typeof a.institutionCode === 'string' && a.institutionCode.trim() ? a.institutionCode.trim() : 'GBIF publisher')
        const { eventDate, datePrecision } = gbifDate(a)
        const detail = [typeof a.institutionCode === 'string' ? a.institutionCode : null, typeof a.collectionCode === 'string' ? a.collectionCode : null].filter(Boolean).join(' · ') || null
        seen.add(key)
        records.push({
          id: `gbif:${key}`, kind: 'species', title: name, subtitle: `${publisher} via GBIF`,
          lat: y, lng: x, precisionMeters, generalised, eventDate, datePrecision,
          status: typeof a.basisOfRecord === 'string' ? a.basisOfRecord : null, detail,
          sourceUrl: `https://www.gbif.org/occurrence/${encodeURIComponent(key)}`,
          license: typeof a.license === 'string' ? a.license : null,
        })
      } catch { /* skip a single malformed record; keep the rest */ }
    }
    return { layer: 'species', status: records.length ? 'ok' : 'empty', records, coverage }
  } catch {
    return { layer: 'species', status: 'error', records: [], coverage, error: 'Bat records could not be retrieved from GBIF right now. The species layer stays off until retrieval succeeds.' }
  }
}

// Real planning applications from the national ArcGIS planning layer near a
// centre, WITH point geometry so they can be plotted. Preserves reference,
// description, status and received date, and links to the source record. Never
// throws: upstream/schema failure becomes status:'error' with a safe message.
export async function fetchPlanningApplicationsNear(
  { lat, lng, radiusKm = 20 }: { lat: number; lng: number; radiusKm?: number },
  options: Options = {},
): Promise<MapLayerResult> {
  const coverage = `Planning applications in the national ArcGIS planning layer within about ${radiusKm} km of the selected centre. Reference, description, status and received date are preserved as returned, with a link to the source record. Application metadata only.`
  try {
    const { limit } = page({ limit: options.limit ?? 50, offset: 0 })
    const b = bboxAround(lat, lng, radiusKm)
    const fields = 'OBJECTID,PlanningAuthority,ApplicationNumber,ApplicationStatus,DevelopmentDescription,ReceivedDate'
    const params = new URLSearchParams({
      f: 'json', geometry: `${b.west},${b.south},${b.east},${b.north}`, geometryType: 'esriGeometryEnvelope',
      inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true',
      outFields: fields, where: '1=1', orderByFields: 'ReceivedDate DESC', resultRecordCount: String(limit),
    })
    const data = object(await json(`${IRISH_PLANNING}/query?${params}`, options))
    if (!Array.isArray(data.features)) throw new Error('schema')
    const records: MapRecord[] = []; const seen = new Set<string>()
    for (const f of data.features) {
      try {
        const feat = object(f), a = object(feat.attributes), geom = object(feat.geometry)
        const x = Number(geom.x), y = Number(geom.y)
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        const ref = id(a.ApplicationNumber), oid = id(a.OBJECTID)
        if (seen.has(ref)) continue
        const authority = typeof a.PlanningAuthority === 'string' && a.PlanningAuthority.trim() ? a.PlanningAuthority.trim() : 'Planning authority'
        const received = Number(a.ReceivedDate)
        const eventDate = Number.isFinite(received) && received > 0 ? new Date(received).toISOString().slice(0, 10) : null
        const query = new URLSearchParams({ f: 'json', objectIds: oid, outFields: fields, returnGeometry: 'true' })
        seen.add(ref)
        records.push({
          id: `planning:${ref}`, kind: 'planning', title: `Planning application ${ref}`, subtitle: authority,
          lat: y, lng: x, precisionMeters: null, generalised: false, eventDate, datePrecision: eventDate ? 'day' : 'unknown',
          status: typeof a.ApplicationStatus === 'string' ? a.ApplicationStatus : null,
          detail: typeof a.DevelopmentDescription === 'string' ? a.DevelopmentDescription : null,
          sourceUrl: `${IRISH_PLANNING}/query?${query}`, license: null,
        })
      } catch { /* skip a single malformed feature; keep the rest */ }
    }
    return { layer: 'planning', status: records.length ? 'ok' : 'empty', records, coverage }
  } catch {
    return { layer: 'planning', status: 'error', records: [], coverage, error: 'Planning applications could not be retrieved right now. The planning layer stays off until retrieval succeeds.' }
  }
}
