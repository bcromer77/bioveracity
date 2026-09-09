import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const TTL = 15 * 60 * 1000
const MAX_BODY = 1024 * 1024
const AAD = Buffer.from('bioveracity:public-pdf-job:v1')

/** @param {Record<string, string | undefined>} env */
function key(env) {
  if (!/^[a-fA-F0-9]{64}$/.test(env.PDF_JOB_ENCRYPTION_KEY || '')) throw new Error('PDF unavailable')
  return Buffer.from(env.PDF_JOB_ENCRYPTION_KEY, 'hex')
}

/** @param {unknown} payload @param {Buffer} secret */
function seal(payload, secret) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', secret, iv)
  cipher.setAAD(AAD)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

/** @param {unknown} token @param {Buffer} secret */
function open(token, secret) {
  if (typeof token !== 'string' || token.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('Invalid receipt')
  const bytes = Buffer.from(token, 'base64url')
  if (bytes.length < 29) throw new Error('Invalid receipt')
  const decipher = createDecipheriv('aes-256-gcm', secret, bytes.subarray(0, 12))
  decipher.setAAD(AAD)
  decipher.setAuthTag(bytes.subarray(12, 28))
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'))
}

/** @param {Request} request */
async function body(request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Invalid body')
  let size = 0
  const chunks = []
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY) { await reader.cancel(); throw new Error('Body too large') }
    chunks.push(Buffer.from(value))
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body')
  return parsed
}

/** @param {unknown} data @param {number} [status] */
const reply = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } })
/** @param {number} code @param {string} error */
const fail = (code, error) => reply({ success: false, status: 'FAILED', error }, code)

/**
 * Public-report containment only. Never use for private case exports.
 * Actor MUST be reloaded from persistent account state on every request.
 * @param {{ getActor: () => Promise<{id: string, institutional: boolean} | null>, upstream?: typeof fetch, env?: Record<string,string|undefined>, now?: () => number }} deps
 */
export function createPdfHandlers({ getActor, upstream = fetch, env = process.env, now = Date.now }) {
  /** @param {Request} request @param {boolean} polling */
  async function handle(request, polling) {
    try {
      const actor = await getActor()
      if (!actor?.id) return fail(401, 'Sign in to access your PDF job.')
      if (env.PUBLIC_PDF_EXTERNAL_PROCESSING_ENABLED !== 'true' || !env.ABACUSAI_API_KEY) return fail(503, 'External PDF processing is not enabled.')
      const secret = key(env)
      let input
      try { input = await body(request) } catch { return fail(400, 'Invalid or oversized request.') }
      if ('caseId' in input || 'workspaceId' in input || 'case_id' in input || 'workspace_id' in input) return fail(403, 'Private case exports are not supported by this endpoint.')
      let upstreamId
      let kind
      if (polling) {
        let job
        try { job = open(input.request_id, secret) } catch { return fail(404, 'PDF job unavailable.') }
        if (job.owner !== actor.id || job.version !== 1 || !Number.isSafeInteger(job.expires) || !Number.isSafeInteger(job.issued) || job.issued > now() || job.expires <= now() || job.expires - job.issued !== TTL || !['summary', 'report'].includes(job.kind) || typeof job.id !== 'string' || !job.id) return fail(404, 'PDF job unavailable.')
        kind = job.kind
        upstreamId = job.id
      } else {
        if (input.reportKind !== undefined && !['summary', 'report'].includes(input.reportKind)) return fail(400, 'Invalid report kind.')
        kind = input.reportKind || 'summary'
        if (typeof input.html_content !== 'string' || !input.html_content.trim()) return fail(400, 'Nothing to render.')
        if (input.css_stylesheet !== undefined && typeof input.css_stylesheet !== 'string') return fail(400, 'Invalid stylesheet.')
      }
      if (kind === 'report' && !actor.institutional) return fail(403, 'Institutional access is required.')
      const response = await upstream(`https://apps.abacus.ai/api/${polling ? 'getConvertHtmlToPdfStatus' : 'createConvertHtmlToPdfRequest'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ABACUSAI_API_KEY}` },
        cache: 'no-store', signal: AbortSignal.timeout(30000),
        body: JSON.stringify(polling ? { request_id: upstreamId } : { html_content: input.html_content, css_stylesheet: input.css_stylesheet, pdf_options: { format: 'A4', print_background: true, margin: { top: '18mm', right: '16mm', bottom: '20mm', left: '16mm' } } }),
      })
      if (!response.ok) return fail(502, 'PDF provider unavailable.')
      const result = await response.json()
      if (!polling) {
        if (typeof result.request_id !== 'string' || !result.request_id || result.request_id.length > 1024) return fail(502, 'Invalid PDF provider response.')
        const issued = now()
        return reply({ success: true, request_id: seal({ version: 1, id: result.request_id, owner: actor.id, kind, issued, expires: issued + TTL }, secret) })
      }
      if (result.status === 'SUCCESS' && typeof result.result?.result === 'string') return reply({ status: 'SUCCESS', pdf_base64: result.result.result })
      if (['PENDING', 'PROCESSING', 'QUEUED', 'RUNNING'].includes(result.status)) return reply({ status: result.status })
      return fail(502, 'PDF generation failed.')
    } catch { return fail(503, 'PDF service unavailable.') }
  }
  return { create: (/** @type {Request} */ request) => handle(request, false), status: (/** @type {Request} */ request) => handle(request, true) }
}
