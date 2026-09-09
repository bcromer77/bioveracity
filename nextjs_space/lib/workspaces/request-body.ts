import { WorkspaceError } from './service'
export async function body(request: Request, limit = 16384): Promise<unknown> {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new WorkspaceError(403, 'Same-origin request required')
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

