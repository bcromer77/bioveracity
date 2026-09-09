import { body, privateRequest } from '@/lib/workspaces/http'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type Context = { params: Promise<{ workspaceId: string }> }
export async function GET(_request: Request, context: Context) {
  return privateRequest(async s => ({ cases: await s.listCases((await context.params).workspaceId) }))
}
export async function POST(request: Request, context: Context) {
  return privateRequest(async s => ({ case: await s.createCase((await context.params).workspaceId, await body(request)) }), 201)
}
