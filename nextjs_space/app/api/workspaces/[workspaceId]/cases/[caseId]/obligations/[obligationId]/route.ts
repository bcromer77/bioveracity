import { body, privateRequest } from '@/lib/workspaces/http'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type Context = { params: Promise<{ workspaceId: string; caseId: string; obligationId: string }> }
export async function PATCH(request: Request, context: Context) {
  return privateRequest(async s => {
    const { workspaceId, caseId, obligationId } = await context.params
    return { obligation: await s.reviseObligation(workspaceId, caseId, obligationId, await body(request)) }
  })
}
