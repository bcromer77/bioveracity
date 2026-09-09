import { privateRequest } from '@/lib/workspaces/http'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(_request: Request, context: { params: Promise<{ workspaceId: string; caseId: string }> }) {
  return privateRequest(async s => {
    const { workspaceId, caseId } = await context.params
    return { case: await s.getCase(workspaceId, caseId) }
  })
}
