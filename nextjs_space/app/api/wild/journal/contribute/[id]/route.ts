import { journalRequest } from '@/lib/venue-journal/http'
import { contributionInput } from '@/lib/venue-journal/domain'
import { photoInput, preparePhoto } from '@/lib/wild-hubs/photos'
import { body } from '@/lib/workspaces/request-body'
type Ctx = {params:Promise<{id:string}>}
export const runtime = 'nodejs'
export async function POST(request:Request, ctx:Ctx) {
 return journalRequest(async s=>{
  const {id}=await ctx.params
  const raw=await body(request,4300000), metadata=contributionInput(raw), input=photoInput(raw)
  await s.reserveScan(id)
  const clean=await preparePhoto(input)
  return s.contribute(id,{...clean,...metadata})
 },false)
}
