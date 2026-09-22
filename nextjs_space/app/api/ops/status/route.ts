import { timingSafeEqual } from 'node:crypto'
import { securityDb } from '@/lib/account-recovery/security-http'
import { operationalStatus } from '@/lib/operations/service'
export const dynamic='force-dynamic'
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
 const secret=process.env.OPERATIONS_MONITOR_TOKEN||'',supplied=request.headers.get('authorization')||''
 const expected=`Bearer ${secret}`
 if(secret.length<32||Buffer.byteLength(supplied)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return Response.json({error:'Not authorised'},{status:401,headers})
 try{
  const jobs:string[]=[]
  if(process.env.OPERATIONS_SEND_ENABLED==='true')jobs.push('privacy-notifications')
  if(process.env.WILD_PHOTO_DIGEST_SEND_ENABLED==='true')jobs.push('venue-photo-digest')
  if(process.env.REVOLUT_RECONCILE_ENABLED==='true')jobs.push('revolut-reconcile')
  if(process.env.CLUB_SOURCE_REFRESH_ENABLED==='true')jobs.push('club-sources')
  const result=await operationalStatus(securityDb,jobs)
  return Response.json(result,{status:result.ok?200:503,headers})
 }catch{return Response.json({ok:false,error:'Operational checks unavailable'},{status:503,headers})}
}
