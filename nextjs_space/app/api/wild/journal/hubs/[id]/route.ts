import { journalRequest } from '@/lib/venue-journal/http'
import { body } from '@/lib/workspaces/request-body'
import { record, text } from '@/lib/wild-hubs/domain'
type Ctx = { params: Promise<{id:string}> }
export const dynamic = 'force-dynamic'
export async function GET(_: Request, ctx: Ctx) {
 return journalRequest(async s=>{const {id}=await ctx.params; return {photos:await s.list(id),settings:await s.settings(id)}})
}
export async function PATCH(request: Request, ctx: Ctx) {
 return journalRequest(async s=>{
  const {id}=await ctx.params, v=record(await body(request))
  if(v.action==='settings') return {settings:await s.configure(id,{contributionsEnabled:v.contributionsEnabled as boolean,weeklyEnabled:v.weeklyEnabled as boolean})}
  await s.change(id,text(v.photoId,80),Number(v.revision),text(v.action,20))
  return {ok:true}
 })
}
