import { Prisma } from '@prisma/client'
import { evidenceDb } from '@/lib/evidence-db'
import { validateEvidence, validateReview, classifyOnIngest } from '@/lib/evidence-contract'
import { scanForSensitiveContent } from '@/lib/evidence-sensitivity'

export async function receiveEvidence(input: unknown) {
  const record = validateEvidence(input)
  return evidenceDb().$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${record.documentKey}))`
    const old = await tx.evidenceDocument.findUnique({ where: { versionHash: record.versionHash } })
    if (old) {
      // A retry cannot erase an audit trail or move observation time backwards.
      if (record.observedAt > old.observedAt) await tx.evidenceDocument.update({ where: { id: old.id }, data: { observedAt: record.observedAt } })
      return { id: old.id, duplicate: true, status: old.status }
    }
    const c = record.content

    // Control #7: screen the actual content (passages, locators, links, title),
    // not just any incoming label. Precise-locality signals force RESTRICTED.
    const scan = scanForSensitiveContent({ sections: c.sections, links: [c.url], text: [c.title] })

    // Control #4 (no silent downgrade): if any existing version of this document
    // is already restricted, a later import can never relax it.
    const priorRestricted = await tx.evidenceDocument.findFirst({
      where: { documentKey: record.documentKey, sensitivity: 'RESTRICTED' }, select: { id: true },
    })

    // Control #5: without resolved acquisition permission, retain only a minimal
    // catalogue reference rather than ingesting the underlying dataset content.
    const catalogueOnly = record.acquisitionPermitted !== true
    const classification = classifyOnIngest({
      contentSensitive: scan.sensitive,
      inheritedRestricted: Boolean(priorRestricted),
      catalogueOnly,
    })
    const storedSections = catalogueOnly
      ? [{ locator: 'catalogue-reference', text: `Catalogue reference only. Underlying dataset not retained pending acquisition permission. Source: ${c.url}` }]
      : c.sections

    const created = await tx.evidenceDocument.create({ data: {
      documentKey: record.documentKey, versionHash: record.versionHash, observedAt: record.observedAt,
      url: c.url, title: c.title, publisher: c.publisher, authorityId: c.authority_id,
      jurisdiction: c.jurisdiction, eventDate: c.event_date, eventPrecision: c.event_date_precision,
      publicationDate: c.publication_date, contentKind: c.content_kind, sections: storedSections,
      status: 'PENDING_REVIEW',
      sensitivity: classification.sensitivity,
      reusePermission: classification.reusePermission,
      incomingSensitivity: record.incomingSensitivity,
      catalogueOnly,
    } })
    return { id: created.id, duplicate: false, status: created.status, sensitivity: created.sensitivity, catalogueOnly }
  })
}

export async function reviewEvidence(id: string, input: unknown, reviewer: string) {
  return evidenceDb().$transaction(async tx => {
    const found = await tx.evidenceDocument.findUniqueOrThrow({ where: { id } })
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.documentKey}))`
    const latest = await tx.evidenceDocument.findFirst({ where: { documentKey: found.documentKey }, orderBy: [{ observedAt: 'desc' }, { id: 'desc' }] })
    if (latest?.id !== id) throw new Error('A newer source version requires review')
    const review = validateReview(input, found.sections as { locator: string; text: string }[])
    const audit = await tx.evidenceReview.create({ data: { documentId: id, reviewer, ...review } })
    await tx.evidenceDocument.update({ where: { id }, data: { status: 'VERIFIED', activeReviewId: audit.id } })
    return { id, status: 'VERIFIED', reviewId: audit.id }
  })
}

export type EvidenceHit = {
  id: string; title: string; url: string; publisher: string; authorityId: string; jurisdiction: string;
  eventDate: string | null; eventPrecision: string; publicationDate: string | null;
  observedAt: Date; claim: string; excerpt: string; locator: string; evidenceType: string; checkedAt: Date;
  matchType?: 'keyword' | 'meaning' | 'both';
}
export async function withdrawEvidence(id: string, reviewer: string, reason: string) {
  if (reason.trim().length < 30 || reason.length > 2000) throw new Error('Substantive withdrawal reason required')
  return evidenceDb().$transaction(async tx => {
    const found = await tx.evidenceDocument.findUniqueOrThrow({ where: { id } })
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.documentKey}))`
    await tx.evidenceReview.create({ data: { documentId: id, reviewer, claim: 'Claim withdrawn', excerpt: '', locator: '', basis: reason, evidenceType: 'withdrawal' } })
    await tx.evidenceDocument.update({ where: { id }, data: { status: 'REVOKED', activeReviewId: null } })
    return { id, status: 'REVOKED' }
  })
}
export async function searchEvidence(q: string, authority = '', from = '', to = ''): Promise<EvidenceHit[]> {
  validateSearchFilters(q, authority, from, to)
  return keywordEvidence(q, authority, from, to)
}
export function validateSearchFilters(q: string, authority = '', from = '', to = '') {
  if (![q, authority, from, to].every(v => typeof v === 'string')) throw new Error('Invalid search')
  if (q.length > 300 || authority.length > 200) throw new Error('Search too long')
  for (const value of [from, to]) if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('Invalid date filter')
  if (from && to && from > to) throw new Error('Reversed date range')
}
async function keywordEvidence(q: string, authority: string, from: string, to: string): Promise<EvidenceHit[]> {
  // Current-version choice precedes verification and keyword filters: a changed,
  // unreviewed source must hide its older verified version from current results.
  return evidenceDb().$queryRaw<EvidenceHit[]>(Prisma.sql`
    WITH current_documents AS (
      SELECT DISTINCT ON ("documentKey") * FROM "EvidenceDocument"
      ORDER BY "documentKey", "observedAt" DESC, id DESC
    )
    SELECT d.id, d.title, d.url, d.publisher, d."authorityId", d.jurisdiction,
      d."eventDate", d."eventPrecision", d."publicationDate", d."observedAt",
      r.claim, r.excerpt, r.locator, r."evidenceType", r."createdAt" AS "checkedAt"
    FROM current_documents d JOIN "EvidenceReview" r ON r.id = d."activeReviewId" AND r."documentId" = d.id
    WHERE d.status = 'VERIFIED'
      AND (${authority} = '' OR d."authorityId" = ${authority})
      AND (${from} = '' OR (d."eventPrecision" = 'day' AND d."eventDate" >= ${from}))
      AND (${to} = '' OR (d."eventPrecision" = 'day' AND d."eventDate" <= ${to}))
      AND (${q} = '' OR to_tsvector('english', d.title || ' ' || d.publisher || ' ' || r.claim || ' ' || r.excerpt)
        @@ websearch_to_tsquery('english', ${q}))
    ORDER BY ts_rank(to_tsvector('english', d.title || ' ' || r.claim || ' ' || r.excerpt), websearch_to_tsquery('english', ${q})) DESC,
      d."observedAt" DESC, d.id
    LIMIT 30
  `)
}
