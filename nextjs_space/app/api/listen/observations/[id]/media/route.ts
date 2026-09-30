import { privateHeaders } from '@/lib/workspaces/http'
import { observationService } from '@/lib/listens/observations.mjs'
import { database, failure, participant } from '@/lib/listens/participant-request'
export const dynamic = 'force-dynamic'

// Owner-only media. Photos render from the metadata-stripped display copy; the
// original (byte-for-byte, may contain device metadata) is only ever a download.
// Untrusted bytes: sniffed type only, nosniff, and a sandboxing CSP.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await participant()
    const { id } = await params
    const variant = new URL(req.url).searchParams.get('variant') === 'original' ? 'original' : 'display'
    const media = await observationService(database, ownerId).media(id, variant)
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/aac': 'aac' } as Record<string, string>)[media.mime] ?? 'bin'
    const bytes = new Uint8Array(media.bytes)
    return new Response(bytes, {
      headers: {
        ...privateHeaders,
        'Content-Type': media.mime,
        'Content-Length': String(bytes.byteLength),
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Content-Disposition': media.variant === 'original' ? `attachment; filename="observation-${id.slice(0, 8)}-original.${ext}"` : 'inline',
      },
    })
  } catch (error) { return failure(error) }
}
