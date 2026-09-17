import { auth } from '@/auth'
import { enabled, hubDb, privateHeaders } from '@/lib/wild-hubs/http'
import { previewablePhoto } from '@/lib/wild-hubs/service'
export const dynamic = 'force-dynamic'
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!enabled())
    return new Response('Not found', { status: 404, headers: privateHeaders })
  const session = await auth()
  try {
    const photo = await previewablePhoto(
      hubDb,
      (await params).id,
      session?.user?.id || null,
    )
    if (!photo)
      return new Response('Not found', { status: 404, headers: privateHeaders })
    return new Response(new Uint8Array(photo.bytes), {
      headers: {
        ...privateHeaders,
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline',
      },
    })
  } catch {
    return new Response('Photo unavailable', {
      status: 503,
      headers: privateHeaders,
    })
  }
}
