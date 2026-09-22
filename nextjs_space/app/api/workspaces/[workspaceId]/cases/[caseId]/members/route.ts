import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { adapter, body, privateHeaders } from '@/lib/workspaces/http'
import { WorkspaceError, type Database } from '@/lib/workspaces/service'
import { collaborationService } from '@/lib/workspaces/collaboration'
export const dynamic='force-dynamic'
type Context={params:Promise<{workspaceId:string;caseId:string}>}
const db:Database={...adapter(prisma),transaction:op=>prisma.$transaction(tx=>op(adapter(tx)),{isolationLevel:'Serializable'})}
async function handle(request:Request,context:Context,write:boolean){
 try {
  const session=await auth()
  if(!session?.user?.id)throw new WorkspaceError(401,'Authentication required')
  if(process.env.PRIVATE_WORKSPACES_ENABLED!=='true')throw new WorkspaceError(503,'Private workspaces are unavailable')
  const {workspaceId,caseId}=await context.params
  const service=collaborationService(db,session.user.id)
  if(!write)return Response.json(await service.list(workspaceId,caseId),{headers:privateHeaders})
  const input=await body(request,4096) as Record<string,unknown>
  if(!input||typeof input.userId!=='string'||input.confirm!=='REMOVE CASE ACCESS')throw new WorkspaceError(400,'Confirm removal of case access')
  return Response.json(await service.revoke(workspaceId,caseId,input.userId),{headers:privateHeaders})
 }catch(e){return Response.json({error:e instanceof WorkspaceError?e.message:'Access change failed. Refresh before retrying.'},{status:e instanceof WorkspaceError?e.status:500,headers:privateHeaders})}
}
export const GET=(r:Request,c:Context)=>handle(r,c,false)
export const DELETE=(r:Request,c:Context)=>handle(r,c,true)
