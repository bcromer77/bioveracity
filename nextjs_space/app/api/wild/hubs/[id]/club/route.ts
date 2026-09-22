import { clubRequest, clubBody, hubDb } from '@/lib/club-watch/http'
import { watchView } from '@/lib/club-watch/service'
import { clubBilling, clubBillingService } from '@/lib/billing/club-service'
import { revolutApi, revolutConfig } from '@/lib/billing/revolut'
import { WorkspaceError } from '@/lib/workspaces/service'
export const dynamic='force-dynamic'
export const runtime='nodejs'
type Context={params:Promise<{id:string}>}
export async function GET(_request:Request,context:Context){return clubRequest(async userId=>{
  const {id}=await context.params
  const [watch,billing]=await Promise.all([watchView(hubDb,id,{userId}),clubBilling(hubDb,id,userId)])
  let payment:{available:boolean;mode?:string;taxLabel?:string}={available:false}
  try{const config=revolutConfig();payment={available:true,mode:config.mode,taxLabel:config.taxLabel}}catch{/* Show source records even when billing is unavailable. */}
  return {watch,billing,payment}
})}
export async function POST(request:Request,context:Context){return clubRequest(async userId=>{
  const {id}=await context.params,input=await clubBody(request),config=revolutConfig(),service=clubBillingService(hubDb,userId,revolutApi(config),config)
  if(input.action==='checkout'){
    const watch=await watchView(hubDb,id,{userId})
    if(!watch?.watch.enabled)throw new WorkspaceError(409,'Your club needs its agreed source area confirmed before subscribing.')
    return service.checkout(id,input.confirmed)
  }
  if(input.action==='refresh')return {billing:await service.refresh(id)}
  if(input.action==='cancel')return {billing:await service.cancel(id,input.confirmed)}
  throw new WorkspaceError(400,'Unknown billing action.')
})}
