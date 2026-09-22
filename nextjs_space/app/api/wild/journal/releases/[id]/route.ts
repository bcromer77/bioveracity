import { journalRequest } from '@/lib/venue-journal/http'
import { body } from '@/lib/workspaces/request-body'
import { record, text } from '@/lib/wild-hubs/domain'
export const dynamic='force-dynamic'
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}) {
 return journalRequest(async s=>{const v=record(await body(request));return s.releaseReceipt((await ctx.params).id,text(v.token,100),v.withdrawFuture===true)},false)
}
