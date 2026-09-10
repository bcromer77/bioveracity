import { WorkspaceError } from './service'

// Same-origin guard that survives the deployment reverse proxy. Behind the proxy,
// `new URL(request.url).origin` is the internal origin (e.g. http://localhost:3000)
// while the browser's Origin header carries the public host (e.g. https://bioveracity.com),
// so a strict full-origin string match would reject legitimate first-party requests and
// surface as a spurious "unavailable / sign in again" error. We instead require an Origin
// header whose host matches the request host, trusting the proxy's forwarded host header.
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  if (!origin) throw new WorkspaceError(403, 'Same-origin request required')
  let originHost: string
  try { originHost = new URL(origin).host } catch { throw new WorkspaceError(403, 'Same-origin request required') }
  const forwardedHost = request.headers.get('x-forwarded-host')
  const requestHost = request.headers.get('host')
  const selfHost = (() => { try { return new URL(request.url).host } catch { return '' } })()
  const allowed = new Set([forwardedHost, requestHost, selfHost].filter(Boolean) as string[])
  if (!allowed.has(originHost)) throw new WorkspaceError(403, 'Same-origin request required')
}

export async function body(request: Request, limit = 16384): Promise<unknown> {
  assertSameOrigin(request)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new WorkspaceError(415, 'JSON required')
  if (Number(request.headers.get('content-length')) > limit) throw new WorkspaceError(413, 'Request too large')
  const reader = request.body?.getReader()
  if (!reader) throw new WorkspaceError(400, 'Body required')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) { await reader.cancel(); throw new WorkspaceError(413, 'Request too large') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
    catch { throw new WorkspaceError(400, 'Invalid JSON') }
  } finally { reader.releaseLock() }
}
