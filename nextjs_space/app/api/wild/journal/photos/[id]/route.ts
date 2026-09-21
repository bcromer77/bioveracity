import { journalRequest } from '@/lib/venue-journal/http'
import { privateHeaders } from '@/lib/wild-hubs/http'
import { body } from '@/lib/workspaces/request-body'
import { record, text } from '@/lib/wild-hubs/domain'
type Ctx = {params:Promise<{id:string}>}
export const dynamic='force-dynamic'
export async function GET(request:Request,ctx:Ctx) {
 const url=new URL(request.url), mode=url.searchParams.get('mode'), download=url.searchParams.get('download')==='1'
 return journalRequest(async s=>{
  const photo=await s.read((await ctx.params).id,mode==='review'?'review':mode==='owner'||download?'owner':'public')
  if(url.searchParams.get('metadata')==='1') {
   const metadata={id:photo.id,caption:photo.caption,credit:photo.credit,location:photo.location,observedOn:photo.observedOn,contributedAt:photo.createdAt}
   return new Response(JSON.stringify({...metadata,recordType:'Community photograph — unverified observation'},null,2),{headers:{...privateHeaders,'Content-Type':'application/json','Content-Disposition':`attachment; filename="bioveracity-${photo.id}-credit.json"`}})
  }
  return new Response(new Uint8Array(photo.bytes),{headers:{...privateHeaders,'Content-Type':'image/jpeg','Content-Disposition':download?`attachment; filename="bioveracity-${photo.id}.jpg"`:'inline'}})
 },mode==='owner'||mode==='review'||download)
}
export async function DELETE(request:Request,ctx:Ctx) {
 return journalRequest(async s=>{const v=record(await body(request));await s.withdraw((await ctx.params).id,text(v.token,100));return {ok:true}},false)
}
