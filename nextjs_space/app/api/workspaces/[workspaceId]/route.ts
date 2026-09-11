import { body, privateRequest } from '@/lib/workspaces/http'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type Context = { params: Promise<{ workspaceId: string }> }
export async function GET(_request: Request, context: Context) {
  return privateRequest(async s => ({ workspace: await s.getWorkspace((await context.params).workspaceId) }))
}
export async function PATCH(request: Request, context: Context) {
  return privateRequest(async s => ({ workspace: await s.renameWorkspace((await context.params).workspaceId, await body(request)) }))
}
