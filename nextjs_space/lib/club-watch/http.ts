import { auth } from '@/auth'
import { hubDb, privateHeaders } from '@/lib/wild-hubs/http'
import { WorkspaceError } from '@/lib/workspaces/service'
import { body } from '@/lib/workspaces/request-body'
export { hubDb }
export const clubEnabled = () => process.env.CLUB_LAUNCH_ENABLED === 'true' && process.env.WILD_HUBS_ENABLED === 'true'
export async function clubRequest(run:(userId:string)=>Promise<unknown>){
  try{
    if(!clubEnabled())throw new WorkspaceError(503,'Club membership is not enabled on this deployment.')
    const session=await auth()
    if(!session?.user?.id)throw new WorkspaceError(401,'Sign in to your account.')
    return Response.json(await run(session.user.id),{headers:privateHeaders})
  }catch(error){return Response.json({error:error instanceof WorkspaceError?error.message:'This operation could not be confirmed. Refresh the page or contact support.'},{status:error instanceof WorkspaceError?error.status:503,headers:privateHeaders})}
}
export async function clubBody(request:Request){
  // Pin money/admin operations to configuration, not untrusted forwarded headers.
  const configured=process.env.APP_BASE_URL
  if(!configured || request.headers.get('origin')!==new URL(configured).origin)throw new WorkspaceError(403,'Same-origin request required.')
  const input=await body(request)
  if(!input || typeof input!=='object'||Array.isArray(input))throw new WorkspaceError(400,'Invalid request.')
  return input as Record<string,unknown>
}
