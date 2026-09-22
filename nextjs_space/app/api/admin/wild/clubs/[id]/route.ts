import { clubRequest, clubBody, hubDb } from '@/lib/club-watch/http'
import { configureWatch, reviewRecord, watchView } from '@/lib/club-watch/service'
import { WorkspaceError } from '@/lib/workspaces/service'
export const dynamic='force-dynamic'
type Context={params:Promise<{id:string}>}
export async function GET(_request:Request,context:Context){return clubRequest(async adminId=>watchView(hubDb,(await context.params).id,{adminId}))}
export async function POST(request:Request,context:Context){return clubRequest(async adminId=>{
  const {id}=await context.params,input=await clubBody(request)
  if(input.action==='configure')return configureWatch(hubDb,adminId,id,input.config,input.enabled===true)
  if(input.action==='review'){
    const view=await watchView(hubDb,id,{adminId})
    if(!view?.records.some(r=>r.id===input.recordId))throw new WorkspaceError(404,'Record not found in this club.')
    if(input.decision!=='APPROVED'&&input.decision!=='REJECTED')throw new WorkspaceError(400,'Choose a review decision.')
    await reviewRecord(hubDb,adminId,String(input.recordId),input.decision,typeof input.note==='string'?input.note:'')
    return {ok:true}
  }
  throw new WorkspaceError(400,'Unknown club action.')
})}
