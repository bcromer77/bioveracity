import { auth } from '@/auth'
import { placeAccessDb } from '@/lib/place/access-db'
import { handleAccessPointQr } from '@/lib/place/access-operator'
export const dynamic = 'force-dynamic'

// Operator-only: QR SVG whose payload is `${PLACE_PUBLIC_ORIGIN}/p/${publicAccessId}`.
export async function GET(request: Request, { params }: { params: Promise<{ publicAccessId: string }> }) {
  const { publicAccessId } = await params
  const download = new URL(request.url).searchParams.get('download') === '1'
  const res = await handleAccessPointQr({ session: await auth(), db: placeAccessDb }, publicAccessId, download)
  return new Response(res.body, { status: res.status, headers: res.headers })
}
