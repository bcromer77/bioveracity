import { body, privateRequest } from '@/lib/workspaces/http'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type Context = { params: Promise<{ workspaceId: string; caseId: string }> }
export async function GET(_request: Request, context: Context) {
  return privateRequest(async s => {
    const { workspaceId, caseId } = await context.params
    return { obligations: await s.listObligations(workspaceId, caseId) }
  })
}
export async function POST(request: Request, context: Context) {
  return privateRequest(async s => {
    const { workspaceId, caseId } = await context.params
    return { obligation: await s.createObligation(workspaceId, caseId, await body(request)) }
  }, 201)
}
