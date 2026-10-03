import { rightsRequest } from '@/lib/data-rights/http'
import { body } from '@/lib/workspaces/request-body'
export const dynamic = 'force-dynamic'
export async function GET() { return rightsRequest(s => s.overview()) }
export async function POST(request: Request) {
  return rightsRequest(async s => {
    const input = await body(request) as Record<string, unknown>
    if (!input || typeof input !== 'object') throw new Error('Invalid input')
    if (input.action === 'withdrawGalleryRelease' && typeof input.photoId === 'string') return s.withdrawGalleryRelease(input.photoId)
    if (input.action === 'accept') return s.accept(input)
    if (input.action === 'unpublish' && typeof input.hubId === 'string') return s.unpublish(input.hubId)
    return s.request(input)
  })
}
