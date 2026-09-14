import { reviewRequest } from '@/lib/wild-hubs/review-http'
import { body } from '@/lib/workspaces/request-body'
export const dynamic = 'force-dynamic'
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return reviewRequest(async s => s.decide((await params).id, await body(request, 5000)))
}
