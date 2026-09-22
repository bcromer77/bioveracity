import { hubDb } from '@/lib/wild-hubs/http'
import { receiveRevolut } from '@/lib/billing/club-service'
import { revolutConfig } from '@/lib/billing/revolut'
import { WorkspaceError } from '@/lib/workspaces/service'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export async function POST(request:Request){
  try{
    const config=revolutConfig(),reader=request.body?.getReader()
    if(!reader)throw new WorkspaceError(400,'Body required.')
    const chunks:Uint8Array[]=[];let size=0
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw new WorkspaceError(413,'Body too large.');chunks.push(value)}}finally{await reader.cancel()}
    const raw=Buffer.concat(chunks).toString('utf8')
    await receiveRevolut(hubDb,config,raw,request.headers.get('revolut-request-timestamp'),request.headers.get('revolut-signature'))
    return new Response(null,{status:204})
  }catch(error){return Response.json({error:'Webhook could not be accepted.'},{status:error instanceof WorkspaceError?error.status:503})}
}
