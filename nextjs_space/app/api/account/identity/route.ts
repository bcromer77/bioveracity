import { authReturnPath } from '@/lib/auth-return-path'
import { body } from '@/lib/workspaces/request-body'
import { WorkspaceError } from '@/lib/workspaces/service'
import { identities } from '@/lib/account-recovery/security-http'
import { securityIp } from '@/lib/account-recovery/security'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  const headers = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
  try {
    const input = await body(request,4096) as Record<string,unknown>
    if (!input || typeof input !== 'object') throw new WorkspaceError(400,'Invalid request')
    const service=identities(), ip=securityIp(request)
    if (input.action==='verify') return Response.json(await service.verify(input.token,ip),{headers})
    if (!['resend','admin-code'].includes(String(input.action))) throw new WorkspaceError(400,'Invalid request')
    await service.issue({email:input.email,password:input.password,ip,purpose:input.action==='admin-code'?'ADMIN_LOGIN':'VERIFY_EMAIL',returnTo:authReturnPath(typeof input.callbackUrl === 'string' ? input.callbackUrl : null)})
    return Response.json({ok:true,message:'If the details match an eligible account, we will attempt to send an email. Check your inbox and spam folder; you can retry later if it does not arrive.'},{headers})
  } catch(error) {
    return Response.json({error:error instanceof WorkspaceError?error.message:'Unable to process this request. Please try again.'},{status:error instanceof WorkspaceError?error.status:503,headers})
  }
}
