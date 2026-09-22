import { rightsRequest } from '@/lib/data-rights/http'
import { body } from '@/lib/workspaces/request-body'
export const dynamic = 'force-dynamic'
export async function GET() { return rightsRequest(s => s.queue()) }
export async function POST(request: Request) {
  return rightsRequest(async s => {
    const input = await body(request) as Record<string, unknown>
    return s.respond(String(input?.id || ''), input)
  })
}
