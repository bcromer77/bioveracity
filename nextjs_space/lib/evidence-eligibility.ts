import { Prisma } from '@prisma/client'

// The calling SQL must select the newest document BEFORE applying this gate.
// All current consumers alias EvidenceDocument as d. Source-register permittedUses
// is an explicit comma-separated list: display, embedding, export, acquisition.
// Free-form prose and unknown permissions deliberately do not grant access.
export function evidenceEligibility(use: 'display' | 'embedding' | 'export') {
  return Prisma.sql`d.status = 'VERIFIED'
    AND d.sensitivity = 'PUBLIC' AND d."reusePermission" = 'PERMITTED'
    AND d."catalogueOnly" = false
    AND NULLIF(trim(d."incomingSensitivity"), '') IS NULL
    AND EXISTS (
      SELECT 1 FROM "EvidenceSourceRegister" s
      WHERE s.id = d."sourceRegisterId"
        AND trim(s.licence) <> '' AND trim(s."requiredAttribution") <> ''
        AND ${use} = ANY(regexp_split_to_array(lower(s."permittedUses"), '\\s*,\\s*'))
    )`
}
