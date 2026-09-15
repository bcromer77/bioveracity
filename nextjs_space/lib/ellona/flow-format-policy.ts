// Flow-scoped accepted-format policy for the "Analyse your own opportunity"
// assessment journey ONLY.
//
// IMPORTANT: the global parser allowlist in lib/workspaces/parser.ts
// (ALLOWED_EXTENSIONS = pdf/txt/csv) is deliberately NOT widened. Existing
// private-workspace upload behaviour is preserved. This flow accepts a broader
// set (adds docx + eml) because the customer's request requires it, and it does
// so through a SEPARATE check so no other upload path is affected.
//
// The malware scan (Cloudmersive, outer-file bytes) and the parser timeout still
// apply. DOCX/EML can contain embedded objects the outer scan does not
// recursively verify; the assessment flow therefore treats extracted content as
// untrusted reference material only — it is never promoted to qualified/public
// evidence, added to ingestion, or shared across tenants.

import { WorkspaceError } from '@/lib/workspaces/service'

const ASSESSMENT_ALLOWED = new Set(['pdf', 'docx', 'eml', 'txt', 'csv'])

export function extensionOf(name: string): string {
  return (name.split('.').pop() || '').toLowerCase()
}

export function checkAssessmentFormatAllowed(name: string): void {
  const ext = extensionOf(name)
  if (!ASSESSMENT_ALLOWED.has(ext)) {
    throw new WorkspaceError(
      422,
      `The file type ".${ext}" is not accepted here. Upload a public PDF, DOCX, EML, TXT or CSV document.`,
    )
  }
}

export const ASSESSMENT_MAX_BYTES = 3_000_000

export const PRE_UPLOAD_NOTICE =
  'During the trial, upload only public or non-confidential material. Do not upload customer-confidential, commercially sensitive or personal information.'
