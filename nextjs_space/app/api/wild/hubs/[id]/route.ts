import { body } from '@/lib/workspaces/request-body'
import { hubRequest } from '@/lib/wild-hubs/http'
type Context = { params: Promise<{ id: string }> }
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(_: Request, ctx: Context) {
  return hubRequest(async (s) => ({ hub: await s.get((await ctx.params).id) }))
}
export async function PATCH(request: Request, ctx: Context) {
  return hubRequest(async (s) => ({
    hub: await s.change((await ctx.params).id, await body(request, 160000)),
  }))
}
