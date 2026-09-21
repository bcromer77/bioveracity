import { journalRequest } from '@/lib/venue-journal/http'
import { body } from '@/lib/workspaces/request-body'
import { HubError, record, text } from '@/lib/wild-hubs/domain'
export const dynamic='force-dynamic'
export async function GET() {return journalRequest(async s=>({photos:await s.reviewQueue()}))}
export async function PATCH(request:Request) {
 return journalRequest(async s=>{
  const v=record(await body(request))
  if(v.confirmed!==true || !['approve','reject'].includes(String(v.action))) throw new HubError(400,'Confirm your review and choose a decision.')
  await s.decide(text(v.photoId,80),Number(v.revision),v.action==='approve',text(v.reason,2000))
  return {ok:true}
 })
}
