import { reviewRequest } from '@/lib/wild-hubs/review-http'
import { privateHeaders } from '@/lib/wild-hubs/http'
export const dynamic = 'force-dynamic'
export async function GET(_: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  return reviewRequest(async s => {
    const { id, photoId } = await params
    const photo = await s.photo(id, photoId)
    return new Response(new Uint8Array(photo.bytes), { headers: { ...privateHeaders, 'Content-Type': 'image/jpeg' } })
  })
}
