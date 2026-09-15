import { randomUUID, createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { EllonaAccessError } from '@/lib/ellona/access'
import { requireCaller, jsonError, privateHeaders } from '@/lib/ellona/http'
import {
  checkAssessmentFormatAllowed,
  extensionOf,
  ASSESSMENT_MAX_BYTES,
} from '@/lib/ellona/flow-format-policy'
import { parseAssessmentWithTimeout } from '@/lib/ellona/parse-assessment.mjs'
import { extractAssessment } from '@/lib/ellona/extraction'
import { trialAllowsWrites } from '@/lib/ellona/access'
import { DECISION_TYPES } from '@/lib/ellona/config'
import { cipher } from '@/lib/workspaces/case-files'
// @ts-ignore - .mjs module without types
import { scanBytes, ScanError } from '@/lib/workspaces/scan-file.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MEDIA: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  eml: 'message/rfc822',
  txt: 'text/plain',
  csv: 'text/csv',
}

export async function POST(request: Request) {
  try {
    const { userId, membership } = await requireCaller()
    const workspaceId = membership.workspaceId

    const tenant = await prisma.partnerTenant.findUnique({ where: { workspaceId } })
    if (!tenant) return jsonError(404, 'Workspace unavailable')
    if (!trialAllowsWrites(tenant.trialState)) {
      return jsonError(403, 'Your trial is read-only. New assessments cannot be created until the trial is converted.')
    }

    const form = await request.formData().catch(() => null)
    if (!form) return jsonError(400, 'Expected a file upload.')
    const file = form.get('file')
    const decisionRaw = String(form.get('decision') || '').toUpperCase()
    const decision = (DECISION_TYPES as readonly string[]).includes(decisionRaw) ? decisionRaw : 'UNSURE'
    if (!(file instanceof File)) return jsonError(400, 'No file was provided.')
    if (file.size === 0) return jsonError(400, 'The file is empty.')
    if (file.size > ASSESSMENT_MAX_BYTES) {
      return jsonError(413, `The file is too large. The limit is ${(ASSESSMENT_MAX_BYTES / 1_000_000).toFixed(1)} MB.`)
    }

    const name = file.name || 'document'
    checkAssessmentFormatAllowed(name)
    const ext = extensionOf(name)
    const bytes = Buffer.from(await file.arrayBuffer())

    // 1) Malware scan of the OUTER file bytes (Cloudmersive). Rejects on virus /
    //    executable / macro / script / unsafe archive; 503 if unavailable.
    try {
      await scanBytes(bytes, process.env.CLOUDMERSIVE_API_KEY || '')
    } catch (e: any) {
      if (e instanceof ScanError || (e && typeof e.status === 'number')) {
        return jsonError(e.status ?? 422, e.message || 'The file failed the security scan. Nothing was imported.')
      }
      return jsonError(503, 'The security scan could not be completed. Nothing was imported.')
    }

    // 2) Parse with a wall-clock timeout so a hostile document cannot hang the
    //    request. Precise locators are produced per format.
    let parsed
    try {
      parsed = await parseAssessmentWithTimeout(bytes, name)
    } catch (e: any) {
      if (e?.message === 'PARSER_TIMEOUT') {
        return jsonError(422, 'The document took too long to read and was rejected. Try a simpler or smaller file.')
      }
      return jsonError(422, 'The document could not be read. Check it is a valid file and try again.')
    }

    // 3) Schema-validated extraction. Never invents; honest blanks; locators
    //    verified against real passages.
    let extraction
    try {
      extraction = await extractAssessment(parsed.passages)
    } catch (e: any) {
      return jsonError(503, 'The analysis service is unavailable right now. The document was read but not analysed; try again shortly.')
    }

    // 4) Store the ENCRYPTED original + the extraction, tenant-scoped.
    const key = process.env.PRIVATE_EVIDENCE_KEY || ''
    const vault = cipher(key)
    const id = randomUUID()
    const encrypted = vault.encrypt(bytes, `assessment/${workspaceId}/${id}`)

    await prisma.opportunityAssessment.create({
      data: {
        id,
        workspaceId,
        createdBy: userId,
        title: name.replace(/\.[^.]+$/, '').slice(0, 160) || 'Opportunity assessment',
        decisionType: decision,
        status: 'EXTRACTED',
        documentName: name,
        documentHash: createHash('sha256').update(bytes).digest('hex'),
        encryptedBytes: encrypted,
        byteLength: bytes.length,
        mediaType: MEDIA[ext] || 'application/octet-stream',
        parserVersion: parsed.parserVersion,
        extraction: {
          version: extraction.version,
          model: extraction.model,
          fields: extraction.fields,
          warnings: [...(parsed.warnings || []), ...extraction.warnings],
          passageCount: extraction.passageCount,
        },
        corrections: {},
        comments: [],
      },
    })

    return Response.json(
      { id, status: 'EXTRACTED', warnings: [...(parsed.warnings || []), ...extraction.warnings] },
      { status: 201, headers: privateHeaders },
    )
  } catch (error) {
    if (error instanceof EllonaAccessError) return jsonError(error.status, error.message)
    if (error && typeof (error as any).status === 'number' && (error as any).message) {
      return jsonError((error as any).status, (error as any).message)
    }
    return jsonError(500, 'The assessment could not be created.')
  }
}
