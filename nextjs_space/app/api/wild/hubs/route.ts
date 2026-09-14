import { body } from '@/lib/workspaces/request-body'
import { hubRequest } from '@/lib/wild-hubs/http'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  return hubRequest(async (s) => ({ hubs: await s.list() }))
}
export async function POST(request: Request) {
  return hubRequest(
    async (s) => ({ hub: await s.create(await body(request)) }),
    201,
  )
}
