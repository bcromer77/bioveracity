import { reviewRequest } from '@/lib/wild-hubs/review-http'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  return reviewRequest(s => s.list(Number(new URL(request.url).searchParams.get('page') || 0)))
}
