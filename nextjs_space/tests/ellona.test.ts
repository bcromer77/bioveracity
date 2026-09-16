// Security & correctness tests for the private Ellona Environmental Opportunity Watch.
//
// These cover the acceptance-critical behaviours from the brief:
//   1. Malware scanning actually blocks infected uploads (EICAR-style verdict).
//   2. A scanner that is unavailable/ambiguous BLOCKS import (never fails open).
//   3. The assessment parser produces PRECISE per-format locators.
//   4. A hostile/slow document is bounded by a wall-clock parser timeout.
//   5. Schema-validated extraction demotes any fabricated SOURCE FACT locator
//      to analysis, and returns honest blanks when there is no text.
//   6. Password policy + breached-password (HIBP) checks behave correctly.
//   7. Invitation tokens are single-use, time-limited and unguessable.
//   8. Assessment reads are strictly tenant-scoped (cross-tenant → not found).
//
// Everything network-facing is injected (no real Cloudmersive / HIBP / model
// calls). DB-backed tests (7,8) run against the preview database when
// DATABASE_URL is set, and delete every row they create.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { PDFDocument, StandardFonts } from 'pdf-lib'

import { scanBytes, ScanError } from '../lib/workspaces/scan-file.mjs'
import {
  parseAssessmentFile,
  parseAssessmentWithTimeout,
  ASSESSMENT_PARSER_VERSION,
} from '../lib/ellona/parse-assessment.mjs'
import {
  validateExtraction,
  extractAssessment,
  FIELD_SCHEMA,
} from '../lib/ellona/extraction'
import {
  createInvitation,
  verifyInvitation,
  validatePasswordPolicy,
  isBreachedPassword,
} from '../lib/ellona/invitation'
import {
  resolveEllonaView,
  findEllonaWorkspace,
  ORIGINATOR_EMAIL,
} from '../lib/ellona/access'
import { ELLONA } from '../lib/ellona/config'
import {
  evaluateOpportunity,
  opportunityVersionHash,
  classifyChange,
  parseCanonicalOpportunityInput,
  routeCanonicalOpportunity,
  type CanonicalOpportunityInput,
} from '../lib/ellona/routing'
import { renderOpportunityBrief, renderPortfolio } from '../lib/ellona/pdf'

const require = createRequire(import.meta.url)
const SCAN_KEY = 'test-scanner-key-0123456789'
const sample = Buffer.from('BioVeracity synthetic test bytes.')

// A fetch double that returns a canned Cloudmersive verdict.
function scanFetch(body: any, { status = 200, throwError = false } = {}) {
  return async () => {
    if (throwError) throw new Error('network down')
    return { ok: status >= 200 && status < 300, status, json: async () => body } as any
  }
}

// ---------------------------------------------------------------------------
// 1 + 2. Malware scanning: blocks threats and NEVER fails open.
// ---------------------------------------------------------------------------
describe('malware scanning gate', () => {
  test('blocks an EICAR-style detected threat (422, names surfaced)', async () => {
    await assert.rejects(
      scanBytes(sample, SCAN_KEY, {
        fetchFn: scanFetch({ CleanResult: false, FoundViruses: [{ VirusName: 'EICAR-Test-File' }] }),
      }),
      (e: any) => e instanceof ScanError && e.status === 422 && /EICAR-Test-File/.test(e.message),
    )
  })

  test('blocks a detected threat even with no virus name (422)', async () => {
    await assert.rejects(
      scanBytes(sample, SCAN_KEY, { fetchFn: scanFetch({ CleanResult: false, FoundViruses: [] }) }),
      (e: any) => e instanceof ScanError && e.status === 422,
    )
  })

  test('blocks embedded executables/macros/scripts even when virus-clean (422)', async () => {
    for (const flag of ['ContainsExecutable', 'ContainsMacros', 'ContainsScript']) {
      await assert.rejects(
        scanBytes(sample, SCAN_KEY, { fetchFn: scanFetch({ CleanResult: true, [flag]: true }) }),
        (e: any) => e instanceof ScanError && e.status === 422,
        `expected ${flag} to be blocked`,
      )
    }
  })

  test('scanner unavailable — missing key blocks import (503, nothing imported)', async () => {
    await assert.rejects(
      scanBytes(sample, '', { fetchFn: scanFetch({ CleanResult: true }) }),
      (e: any) => e instanceof ScanError && e.status === 503 && /Nothing imported/.test(e.message),
    )
  })

  test('scanner unavailable — provider unreachable blocks import (503)', async () => {
    await assert.rejects(
      scanBytes(sample, SCAN_KEY, { fetchFn: scanFetch(null, { throwError: true }) }),
      (e: any) => e instanceof ScanError && e.status === 503,
    )
  })

  test('ambiguous verdict (no explicit CleanResult:true) blocks import (503)', async () => {
    await assert.rejects(
      scanBytes(sample, SCAN_KEY, { fetchFn: scanFetch({ CleanResult: null }) }),
      (e: any) => e instanceof ScanError && e.status === 503,
    )
  })

  test('a clean verdict is accepted (resolves)', async () => {
    await scanBytes(sample, SCAN_KEY, { fetchFn: scanFetch({ CleanResult: true }) })
  })
})

// ---------------------------------------------------------------------------
// 3. Precise per-format locators.
// ---------------------------------------------------------------------------
describe('assessment parser locators (per format)', () => {
  test('TXT → line-range locators', async () => {
    const txt = Buffer.from('Tender notice line one.\nEnvironmental monitoring required.\nDeadline 23 Sep 2026.')
    const out = await parseAssessmentFile(txt, 'notice.txt')
    assert.equal(out.parserVersion, ASSESSMENT_PARSER_VERSION)
    assert.equal(out.mediaType, 'text/plain')
    assert.match(out.passages[0].locator, /^Lines 1\u2013/)
    assert.match(out.passages[0].text, /Environmental monitoring/)
  })

  test('CSV → row + named-column locators', async () => {
    const csv = Buffer.from('Item,Deadline\nAir monitoring,23 Sep 2026')
    const out = await parseAssessmentFile(csv, 'schedule.csv')
    assert.equal(out.mediaType, 'text/csv')
    const dl = out.passages.find((p: any) => /Deadline/.test(p.locator))
    assert.ok(dl, 'expected a locator naming the Deadline column')
    assert.match(dl.locator, /row 2, column \u201cDeadline\u201d/)
  })

  test('DOCX → heading/paragraph/table locators', async () => {
    const JSZip = require('jszip')
    const zip = new JSZip()
    zip.file(
      '[Content_Types].xml',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
    )
    zip.file(
      'word/document.xml',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Scope of Works</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>Continuous air-quality monitoring across the site.</w:t></w:r></w:p>' +
        '</w:body></w:document>',
    )
    const bytes = await zip.generateAsync({ type: 'nodebuffer' })
    const out = await parseAssessmentFile(bytes, 'brief.docx')
    assert.equal(out.mediaType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const para = out.passages.find((p: any) => /air-quality monitoring/.test(p.text))
    assert.ok(para, 'expected the body paragraph to be extracted')
    assert.match(para.locator, /paragraph \d+/)
  })

  test('EML → subject/body-paragraph locators', async () => {
    const eml = Buffer.from(
      'From: buyer@example.test\r\nTo: bids@example.test\r\nDate: Mon, 1 Sep 2026 09:00:00 +0100\r\n' +
        'Subject: Air monitoring tender\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' +
        'We are seeking continuous air emissions monitoring.\r\n\r\nSubmissions close 23 Sep 2026.',
    )
    const out = await parseAssessmentFile(eml, 'enquiry.eml')
    assert.equal(out.mediaType, 'message/rfc822')
    assert.ok(out.passages.some((p: any) => p.locator === 'Email subject'))
    assert.ok(out.passages.some((p: any) => /Email body paragraph 1/.test(p.locator)))
  })

  test('empty/scanned document yields no passages + an honest warning', async () => {
    const blank = await PDFDocument.create()
    blank.addPage()
    const out = await parseAssessmentFile(Buffer.from(await blank.save()), 'scan.pdf')
    assert.equal(out.passages.length, 0)
    assert.ok(out.warnings.some((w: string) => /No extractable text/.test(w)))
  })
})

// ---------------------------------------------------------------------------
// 4. Parser is bounded by a wall-clock timeout.
// ---------------------------------------------------------------------------
describe('parser timeout', () => {
  test('a 1ms budget on a real PDF rejects with PARSER_TIMEOUT', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    doc.addPage().drawText('Air emissions monitoring programme scope and deadlines.', { font })
    const pdf = Buffer.from(await doc.save())
    await assert.rejects(
      parseAssessmentWithTimeout(pdf, 'tender.pdf', 1),
      (e: any) => e instanceof Error && e.message === 'PARSER_TIMEOUT',
    )
  })
})

// ---------------------------------------------------------------------------
// 5. Schema-validated extraction — no fabricated locators, honest blanks.
// ---------------------------------------------------------------------------
describe('extraction locator verification', () => {
  const passages = [{ locator: 'Page 1', text: 'The Environmental Protection Agency seeks air monitoring.' }]

  test('a SOURCE FACT with a real locator is preserved', () => {
    const { fields, warnings } = validateExtraction(
      { fields: [{ key: 'buyer', value: 'Environmental Protection Agency', category: 'SOURCE FACT', locator: 'Page 1' }] },
      passages,
    )
    const buyer = fields.find((f) => f.key === 'buyer')!
    assert.equal(buyer.category, 'SOURCE FACT')
    assert.equal(buyer.locator, 'Page 1')
    assert.equal(warnings.length, 0)
  })

  test('a SOURCE FACT with a fabricated locator is demoted to analysis + warned', () => {
    const { fields, warnings } = validateExtraction(
      { fields: [{ key: 'buyer', value: 'Somebody', category: 'SOURCE FACT', locator: 'Page 999 (invented)' }] },
      passages,
    )
    const buyer = fields.find((f) => f.key === 'buyer')!
    assert.equal(buyer.category, 'BIOVERACITY ANALYSIS')
    assert.equal(buyer.locator, null)
    assert.ok(warnings.some((w) => /could not be verified/.test(w)))
  })

  test('missing values become UNKNOWN honest blanks; every schema key is present', () => {
    const { fields } = validateExtraction({ fields: [] }, passages)
    assert.equal(fields.length, FIELD_SCHEMA.length)
    assert.ok(fields.every((f) => f.value === 'Not located in the document.' && f.category === 'UNKNOWN'))
  })

  test('no passages → all-UNKNOWN result with no model call', async () => {
    let called = false
    const result = await extractAssessment([], { fetchFn: (async () => { called = true; return {} as any }) })
    assert.equal(called, false)
    assert.equal(result.passageCount, 0)
    assert.equal(result.model, 'none')
    assert.ok(result.fields.every((f) => f.category === 'UNKNOWN'))
  })
})

// ---------------------------------------------------------------------------
// 6. Password policy + breached-password check.
// ---------------------------------------------------------------------------
describe('password policy + breach check', () => {
  test('rejects weak passwords, accepts a strong one', () => {
    assert.match(validatePasswordPolicy('short') || '', /at least 12/)
    assert.match(validatePasswordPolicy('alllowercase123') || '', /upper-case/)
    assert.match(validatePasswordPolicy('ALLUPPERCASE123') || '', /lower-case/)
    assert.match(validatePasswordPolicy('NoNumbersHereAtAll') || '', /number/)
    assert.equal(validatePasswordPolicy('Str0ng-Passphrase-2026'), null)
  })

  test('breached password is detected via injected HIBP range', async () => {
    const pw = 'Str0ng-Passphrase-2026'
    const sha1 = createHash('sha1').update(pw).digest('hex').toUpperCase()
    const suffix = sha1.slice(5)
    const hit = async () => ({ ok: true, text: async () => `${suffix}:42\r\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1` }) as any
    assert.equal(await isBreachedPassword(pw, hit), true)
  })

  test('non-breached password returns false', async () => {
    const miss = async () => ({ ok: true, text: async () => 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:1' }) as any
    assert.equal(await isBreachedPassword('An0ther-Good-Passphrase!', miss), false)
  })

  test('unreachable HIBP fails OPEN (never blocks activation)', async () => {
    const boom = async () => { throw new Error('network down') }
    assert.equal(await isBreachedPassword('An0ther-Good-Passphrase!', boom), false)
  })
})

describe('canonical opportunity routing', () => {
  const input: CanonicalOpportunityInput = {
    verificationState: 'VERIFIED', sourceName: 'Official test portal', sourceUrl: 'https://example.test/notices/air-1',
    publisher: 'Test Authority', officialId: 'AIR-1', buyer: 'Test Council', title: 'Air monitoring requirement',
    country: 'United Kingdom', region: 'Cambridge', classification: 'OPEN TENDER', sourceStatus: 'OPEN',
    themes: ['air quality'], capabilities: ['air quality monitoring'], measurementNeed: 'Continuous particulate measurement.',
    publicationDate: '15 September 2026', tenderDeadline: '30 September 2026 12:00 (Europe/Dublin)',
    supportedClaim: 'The authority is procuring an air monitoring service.', supportingPassage: 'The authority invites tenders for continuous particulate monitoring.',
    sourceReadable: true, retrievedAt: new Date('2026-09-15T12:00:00Z'),
    nextAction: 'Review the notice and decide whether to bid or partner.',
  }
  const profile = { workspaceId: 'ellona', territories: ['United Kingdom'], themes: ['air quality'], capabilities: ['air quality monitoring'], immediateClassifications: ['OPEN TENDER'], enabled: true }

  test('routes only a territorial, thematic match that passes the alert gate', () => {
    const decision = evaluateOpportunity(input, profile)
    assert.equal(decision.matched, true)
    assert.equal(decision.alertEligible, true)
    assert.deepEqual(decision.matchedThemes, ['air quality'])
    assert.equal(evaluateOpportunity(input, { ...profile, territories: ['Puglia'] }).matched, false)
  })

  test('authenticated hand-off parser rejects unsupported or unbounded opportunity metadata', () => {
    const wire = { ...input, retrievedAt: input.retrievedAt.toISOString(), evidenceDocumentId: 'verified-evidence-test' }
    assert.equal(parseCanonicalOpportunityInput(wire).evidenceDocumentId, 'verified-evidence-test')
    assert.throws(() => parseCanonicalOpportunityInput({ ...wire, sourceUrl: 'http://example.test/insecure' }))
    assert.throws(() => parseCanonicalOpportunityInput({ ...wire, verificationState: 'PENDING_REVIEW' }))
    assert.throws(() => parseCanonicalOpportunityInput({ ...wire, supportedClaim: '' }))
    assert.throws(() => parseCanonicalOpportunityInput({ ...wire, customerWorkspaceId: 'ellona-test' }))
  })

  test('retrieval alone does not create a new version; a deadline correction does', () => {
    const laterRetrieval = { ...input, retrievedAt: new Date('2026-09-15T13:00:00Z') }
    assert.equal(opportunityVersionHash(input), opportunityVersionHash(laterRetrieval))
    const corrected = { ...input, tenderDeadline: '1 October 2026 12:00 (Europe/Dublin)' }
    assert.notEqual(opportunityVersionHash(input), opportunityVersionHash(corrected))
    assert.equal(classifyChange({ tenderDeadline: corrected.tenderDeadline }, false), 'DEADLINE_CHANGE')
  })

  test('one canonical test record routes to isolated overlays, deduplicates, and suppresses alerts after expiry', async () => {
    const canonicals = new Map<string, any>()
    const versions: any[] = []
    const overlays: any[] = []
    const events: any[] = []
    const emails: any[] = []
    const profiles = [
      { workspaceId: 'ellona-test', territories: ['United Kingdom'], themes: ['air quality'], capabilities: ['air quality monitoring'], immediateClassifications: ['OPEN TENDER'], enabled: true, lastEvidenceRefreshAt: null, lastSourceAccessStatus: null },
      { workspaceId: 'mara-test', territories: ['United Kingdom'], themes: ['marine'], capabilities: ['marine monitoring'], immediateClassifications: ['OPEN TENDER'], enabled: true, lastEvidenceRefreshAt: null, lastSourceAccessStatus: null },
      { workspaceId: 'expired-test', territories: ['United Kingdom'], themes: ['air quality'], capabilities: ['air quality monitoring'], immediateClassifications: ['OPEN TENDER'], enabled: true, lastEvidenceRefreshAt: null, lastSourceAccessStatus: null },
    ]
    const tenants = new Map(profiles.map((row) => [row.workspaceId, { workspaceId: row.workspaceId, contactEmail: `${row.workspaceId}@example.invalid`, trialState: 'ACTIVE', trialEndsAt: new Date(Date.now() + 86_400_000), alertsPaused: false }]))
    tenants.get('expired-test')!.trialEndsAt = new Date(Date.now() - 1)
    const tx: any = {
      $executeRaw: async () => 1,
      publicOpportunity: {
        findUnique: async ({ where }: any) => {
          const record = canonicals.get(where.canonicalKey)
          return record ? { ...record, versions: versions.filter((version) => version.publicOpportunityId === record.id).slice(-1) } : null
        },
        upsert: async ({ where, update, create }: any) => {
          const existing = canonicals.get(where.canonicalKey)
          const record = existing ? Object.assign(existing, update) : { ...create }
          canonicals.set(where.canonicalKey, record)
          return record
        },
      },
      publicOpportunityVersion: { create: async ({ data }: any) => { const row = { ...data, detectedAt: new Date() }; versions.push(row); return row } },
      partnerMonitoringProfile: {
        findMany: async () => profiles,
        update: async ({ where, data }: any) => Object.assign(profiles.find((row) => row.workspaceId === where.workspaceId)!, data),
      },
      opportunity: {
        findFirst: async ({ where }: any) => overlays.find((row) => row.workspaceId === where.workspaceId && row.publicOpportunityId === where.publicOpportunityId) || null,
        upsert: async ({ where, update, create }: any) => {
          const key = where.workspaceId_publicOpportunityId
          const existing = overlays.find((row) => row.workspaceId === key.workspaceId && row.publicOpportunityId === key.publicOpportunityId)
          if (existing) return Object.assign(existing, update)
          const row = { ...create }; overlays.push(row); return row
        },
      },
      opportunityEvent: { create: async ({ data }: any) => { events.push(data); return data } },
      partnerTenant: { findUnique: async ({ where }: any) => tenants.get(where.workspaceId) || null },
      partnerEmail: {
        upsert: async ({ where, create }: any) => {
          const key = where.workspaceId_dedupKey
          const existing = emails.find((row) => row.workspaceId === key.workspaceId && row.dedupKey === key.dedupKey)
          if (existing) return existing
          emails.push(create); return create
        },
      },
    }
    const database: any = { $transaction: async (callback: any) => callback(tx) }
    const routedInput = { ...input, themes: ['air quality', 'marine'], capabilities: ['air quality monitoring', 'marine monitoring'] }
    const interpretations = {
      'ellona-test': { relevance: 'Ellona air-quality lens.' },
      'mara-test': { relevance: 'Mara marine lens.' },
    }

    const first = await routeCanonicalOpportunity(routedInput, interpretations, database)
    assert.equal(first.duplicate, false)
    assert.equal(canonicals.size, 1)
    assert.equal(versions.length, 1)
    assert.equal(overlays.length, 3)
    assert.equal(emails.length, 2)
    assert.notEqual(overlays.find((row) => row.workspaceId === 'ellona-test').workspaceRelevance, overlays.find((row) => row.workspaceId === 'mara-test').workspaceRelevance)
    assert.equal(emails.some((row) => row.workspaceId === 'expired-test'), false)

    const repeated = await routeCanonicalOpportunity({ ...routedInput, retrievedAt: new Date('2026-09-15T13:00:00Z') }, interpretations, database)
    assert.equal(repeated.duplicate, true)
    assert.equal(versions.length, 1)
    assert.equal(overlays.length, 3)
    assert.equal(emails.length, 2)

    const corrected = await routeCanonicalOpportunity({ ...routedInput, tenderDeadline: '1 October 2026 12:00 (Europe/Dublin)' }, interpretations, database)
    assert.equal(corrected.duplicate, false)
    assert.equal(versions.length, 2)
    assert.equal(overlays.length, 3)
    assert.equal(emails.length, 4)
    assert.equal(events.filter((event) => event.kind === 'CORRECTION').length, 3)
  })
})

describe('opportunity PDF snapshots', () => {
  test('renders an individual brief and a categorised, timestamped portfolio', async () => {
    const brief = await renderOpportunityBrief({
      heading: 'Test Council — Air monitoring requirement',
      subheading: 'Continuous particulate measurement',
      recordUrl: 'https://bioveracity.com/ellona/opportunity/test-record',
      classification: 'OPEN TENDER',
      status: 'NEW',
      metaRows: [['Supported source claim', 'The authority is procuring an air monitoring service.']],
    })
    const portfolio = await renderPortfolio({
      dashboardUrl: 'https://bioveracity.com/ellona',
      generatedForLabel: 'Ellona Environmental Opportunity Watch',
      snapshotLabel: '15 September 2026, 19:00',
      evidenceRefreshedLabel: '15 September 2026, 18:55',
      versionLabel: 'v1',
      coverageNotes: ['One source reported a disclosed access limitation.'],
      items: [{
        buyer: 'Test Council', title: 'Air monitoring requirement', classification: 'OPEN TENDER',
        status: 'NEW', measurementNeed: 'Continuous particulate measurement', deadline: '30 September 2026',
        location: 'Cambridge, United Kingdom', recordUrl: 'https://bioveracity.com/ellona/opportunity/test-record',
        bucket: 'NEW', accessLimitation: null, nextAction: 'Review the notice.',
      }],
    })
    for (const [bytes, expectedTitle] of [
      [brief, 'Test Council — Air monitoring requirement'],
      [portfolio, 'Ellona opportunity portfolio'],
    ] as const) {
      assert.equal(bytes.subarray(0, 4).toString(), '%PDF')
      const parsed = await PDFDocument.load(bytes)
      assert.ok(parsed.getPageCount() >= 1)
      assert.match(parsed.getTitle() || '', new RegExp(expectedTitle, 'i'))
    }
  })
})

// ---------------------------------------------------------------------------
// 7 + 8. DB-backed: invitation single-use/expiry + tenant isolation.
//        Run only when a database is configured; every row is cleaned up.
// ---------------------------------------------------------------------------
const dbTest = process.env.DATABASE_URL ? describe : describe.skip

dbTest('invitation token security (DB)', () => {
  test('token is single-use and time-limited; invalid tokens rejected', async () => {
    const { prisma } = await import('../lib/prisma')
    const ws = `test-ws-${randomUUID()}`
    const email = `test-${randomUUID()}@example.invalid`
    try {
      const { token } = await createInvitation(ws, email, 'ACTIVATION')

      // Fresh token verifies.
      const ok = await verifyInvitation(token)
      assert.ok(ok && ok.workspaceId === ws && ok.email === email.toLowerCase())

      // A garbage token never verifies.
      assert.equal(await verifyInvitation('not-a-real-token'), null)

      // Once consumed, it can never be reused (single-use).
      await prisma.partnerInvitation.update({ where: { id: ok.id }, data: { consumedAt: new Date() } })
      assert.equal(await verifyInvitation(token), null)

      // An expired token is rejected.
      const { token: token2 } = await createInvitation(ws, email, 'ACTIVATION')
      const hash2 = createHash('sha256').update(token2).digest('hex')
      await prisma.partnerInvitation.update({
        where: { tokenHash: hash2 },
        data: { expiresAt: new Date(Date.now() - 1000) },
      })
      assert.equal(await verifyInvitation(token2), null)
    } finally {
      await prisma.partnerInvitation.deleteMany({ where: { workspaceId: ws } })
      await prisma.partnerAuthEvent.deleteMany({ where: { workspaceId: ws } })
    }
  })
})

dbTest('tenant isolation (DB)', () => {
  test('an assessment is only visible within its own workspace', async () => {
    const { prisma } = await import('../lib/prisma')
    const wsA = `test-ws-${randomUUID()}`
    const wsB = `test-ws-${randomUUID()}`
    const idA = `test-assess-${randomUUID()}`
    const base = {
      createdBy: 'test',
      title: 'Test assessment',
      decisionType: 'UNSURE',
      documentName: 'x.txt',
      documentHash: 'deadbeef',
      encryptedBytes: Buffer.from('x'),
      byteLength: 1,
      mediaType: 'text/plain',
      parserVersion: ASSESSMENT_PARSER_VERSION,
    }
    try {
      await prisma.opportunityAssessment.create({ data: { id: idA, workspaceId: wsA, ...base } })

      // Same-tenant read succeeds (the query the API performs).
      const own = await prisma.opportunityAssessment.findFirst({ where: { id: idA, workspaceId: wsA } })
      assert.ok(own, 'owner workspace should see its own assessment')

      // Cross-tenant read returns nothing — foreign workspace cannot reach it.
      const foreign = await prisma.opportunityAssessment.findFirst({ where: { id: idA, workspaceId: wsB } })
      assert.equal(foreign, null)
    } finally {
      await prisma.opportunityAssessment.deleteMany({ where: { id: idA } })
    }
  })
})

dbTest('originator read-only preview access (DB)', () => {
  test('another partner member cannot resolve the Ellona route; the originator preview targets Ellona only', async () => {
    const { prisma } = await import('../lib/prisma')
    const ws = `test-ws-${randomUUID()}`
    const memberId = `test-user-${randomUUID()}`
    const strangerId = `test-user-${randomUUID()}`
    try {
      // A self-contained partner tenant with one active member.
      await prisma.privateWorkspace.create({ data: { id: ws, name: 'Test tenant', persona: 'ecology' } })
      await prisma.partnerTenant.create({
        data: {
          workspaceId: ws,
          orgName: 'Test Org',
          workspaceName: 'Test tenant',
          contactName: 'Test Member',
          contactEmail: `member-${randomUUID()}@example.invalid`,
          originatorName: 'Origin',
          originatorOrg: 'Origin Org',
        },
      })
      await prisma.user.create({ data: { id: memberId, email: `member-${randomUUID()}@example.invalid`, name: 'Test Member', role: 'partner_member' } })
      await prisma.privateWorkspaceMember.create({ data: { workspaceId: ws, userId: memberId, role: 'CONTRIBUTOR' } })

      // A member of a *different* partner tenant resolves to their OWN tenant
      // and is never routed to the real Ellona workspace.
      const ellona = await prisma.partnerTenant.findFirst({ where: { contactEmail: ELLONA.contactEmail }, select: { workspaceId: true } })
      const memberView = await resolveEllonaView(memberId, 'anything@example.invalid')
      assert.equal(memberView?.workspaceId, ws)
      if (ellona) assert.notEqual(memberView?.workspaceId, ellona.workspaceId)
      const memberWs = await findEllonaWorkspace(memberId)
      assert.equal(memberWs?.workspaceId, ws)
      if (ellona) assert.notEqual(memberWs?.workspaceId, ellona.workspaceId)

      // 2) The originator (Bazil) is NOT a member anywhere, so he resolves to a
      //    READ-ONLY preview that targets the real Ellona tenant only.
      const originatorView = await resolveEllonaView(strangerId, ORIGINATOR_EMAIL)
      if (ellona) {
        assert.ok(originatorView, 'originator should resolve a preview view when the Ellona tenant exists')
        assert.equal(originatorView!.preview, true)
        assert.equal(originatorView!.workspaceId, ellona.workspaceId)
        assert.equal(originatorView!.role, 'ORIGINATOR_PREVIEW')
        // The originator is never granted a real membership row.
        assert.equal(await findEllonaWorkspace(strangerId), null)
      }

      // 3) A stranger who is neither a member nor the originator gets nothing.
      const none = await resolveEllonaView(strangerId, 'stranger@example.invalid')
      assert.equal(none, null)
    } finally {
      await prisma.privateWorkspaceMember.delete({ where: { workspaceId_userId: { workspaceId: ws, userId: memberId } } }).catch(() => {})
      await prisma.user.delete({ where: { id: memberId } }).catch(() => {})
      await prisma.partnerTenant.delete({ where: { workspaceId: ws } }).catch(() => {})
      await prisma.privateWorkspace.delete({ where: { id: ws } }).catch(() => {})
    }
  })
})

dbTest('canonical routing and correction lifecycle (DB)', () => {
  test('one public record feeds two isolated overlays and emits one sandbox notification per workspace/version', async () => {
    const { prisma } = await import('../lib/prisma')
    const suffix = randomUUID()
    const wsA = `test-ellona-${suffix}`
    const wsB = `test-mara-${suffix}`
    const officialId = `TEST-${suffix}`
    const base: CanonicalOpportunityInput = {
      verificationState: 'VERIFIED', sourceName: 'Official test portal', sourceUrl: `https://example.test/notices/${officialId}`,
      publisher: 'Test Authority', officialId, buyer: 'Test Council', title: 'Test air and port monitoring tender',
      country: 'Synthetica', region: 'Test Region Alpha', classification: 'OPEN TENDER', sourceStatus: 'OPEN',
      themes: ['synthetic air lens', 'synthetic marine lens'], capabilities: ['synthetic air capability', 'synthetic marine capability'],
      measurementNeed: 'Continuous environmental measurement.', publicationDate: '15 September 2026',
      tenderDeadline: '30 September 2026 12:00 (Europe/Dublin)', supportedClaim: 'The authority is procuring monitoring.',
      supportingPassage: 'The authority invites tenders for environmental monitoring.', sourceReadable: true,
      retrievedAt: new Date(), nextAction: 'Review the notice and decide whether to bid or partner.',
    }
    try {
      for (const [workspaceId, orgName, contactEmail, themes, capabilities] of [
        [wsA, 'Ellona Test', `ellona-${suffix}@example.invalid`, ['synthetic air lens'], ['synthetic air capability']],
        [wsB, 'Mara Test', `mara-${suffix}@example.invalid`, ['synthetic marine lens'], ['synthetic marine capability']],
      ] as const) {
        await prisma.partnerTenant.create({ data: { workspaceId, orgName, workspaceName: `${orgName} Watch`, contactName: orgName, contactEmail, originatorName: 'Test', originatorOrg: 'Test', trialState: 'ACTIVE', trialEndsAt: new Date(Date.now() + 86_400_000) } })
        await prisma.partnerMonitoringProfile.create({ data: { workspaceId, territories: ['Synthetica'], themes: [...themes], capabilities: [...capabilities], immediateClassifications: ['OPEN TENDER'] } })
      }
      const interpretations = {
        [wsA]: { relevance: 'Ellona air-quality lens.', nextAction: 'Assess sensor fit.' },
        [wsB]: { relevance: 'Mara marine lens.', nextAction: 'Assess port-monitoring fit.' },
      }
      const first = await routeCanonicalOpportunity(base, interpretations)
      assert.equal(first.duplicate, false)
      assert.equal(first.routedWorkspaceIds.length, 2)
      assert.equal(first.notificationIds.length, 2)
      assert.equal(await prisma.publicOpportunity.count({ where: { id: first.canonicalId } }), 1)
      const overlays = await prisma.opportunity.findMany({ where: { publicOpportunityId: first.canonicalId }, orderBy: { workspaceId: 'asc' } })
      assert.equal(overlays.length, 2)
      assert.notEqual(overlays[0].workspaceRelevance, overlays[1].workspaceRelevance)
      assert.equal(await prisma.partnerEmail.count({ where: { workspaceId: wsA } }), 1)
      assert.equal(await prisma.partnerEmail.count({ where: { workspaceId: wsB } }), 1)

      const repeated = await routeCanonicalOpportunity({ ...base, retrievedAt: new Date(Date.now() + 1000) }, interpretations)
      assert.equal(repeated.duplicate, true)
      assert.equal(repeated.versionId, null)
      assert.equal(repeated.notificationIds.length, 0)
      assert.equal(await prisma.partnerEmail.count({ where: { workspaceId: { in: [wsA, wsB] } } }), 2)

      const corrected = await routeCanonicalOpportunity({ ...base, tenderDeadline: '1 October 2026 12:00 (Europe/Dublin)', retrievedAt: new Date(Date.now() + 2000) }, interpretations)
      assert.equal(corrected.duplicate, false)
      assert.equal(corrected.notificationIds.length, 2)
      assert.equal(await prisma.publicOpportunityVersion.count({ where: { publicOpportunityId: first.canonicalId } }), 2)
      assert.equal(await prisma.opportunity.count({ where: { publicOpportunityId: first.canonicalId } }), 2)
      assert.equal(await prisma.partnerEmail.count({ where: { workspaceId: { in: [wsA, wsB] } } }), 4)
    } finally {
      const canonical = await prisma.publicOpportunity.findFirst({ where: { officialId } })
      const workspaceIds = [wsA, wsB]
      const links = await prisma.opportunity.findMany({ where: { workspaceId: { in: workspaceIds } }, select: { id: true } })
      await prisma.opportunityEvent.deleteMany({ where: { opportunityId: { in: links.map((row) => row.id) } } })
      await prisma.opportunityAction.deleteMany({ where: { workspaceId: { in: workspaceIds } } })
      await prisma.opportunity.deleteMany({ where: { workspaceId: { in: workspaceIds } } })
      await prisma.partnerEmail.deleteMany({ where: { workspaceId: { in: workspaceIds } } })
      await prisma.partnerMonitoringProfile.deleteMany({ where: { workspaceId: { in: workspaceIds } } })
      await prisma.partnerTenant.deleteMany({ where: { workspaceId: { in: workspaceIds } } })
      if (canonical) {
        await prisma.publicOpportunityVersion.deleteMany({ where: { publicOpportunityId: canonical.id } })
        await prisma.publicOpportunity.delete({ where: { id: canonical.id } })
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Shared deterministic portfolio filter (lib/ellona/filter-opportunities.ts).
// These are pure-function tests with fixtures — NO database, NO PDF byte
// comparisons. They assert on the exact set of opportunity IDs each filter
// returns, which is the only thing that guarantees the dashboard and the PDF
// route can never drift apart.
// ---------------------------------------------------------------------------
import {
  CLOSED_STATUSES,
  normalizeFilters,
  filterOpportunities,
  buildScopeLabel,
  buildPortfolioPdfQuery,
  parseFiltersFromParams,
  type FilterableOpportunity,
  type EllonaFilters,
} from '../lib/ellona/filter-opportunities'

describe('shared ellona portfolio filter', () => {
  const FILTER_NOW = Date.UTC(2026, 8, 16, 12, 0, 0)
  const DAY = 24 * 60 * 60 * 1000
  const inDays = (n: number) => FILTER_NOW + n * DAY

  function fx(over: Partial<FilterableOpportunity> & { id: string }): FilterableOpportunity {
    return {
      status: 'OPEN',
      classification: 'Tender',
      buyer: 'Public body',
      title: 'Opportunity',
      country: 'Ireland',
      region: null,
      themes: [],
      capabilities: [],
      measurementNeed: null,
      nextAction: null,
      supportedClaim: null,
      deadlineEpoch: null,
      following: false,
      ...over,
    }
  }

  const FIXTURES: FilterableOpportunity[] = [
    fx({
      id: 'air-epa',
      title: 'Ambient air quality monitoring',
      buyer: 'Environmental Protection Agency',
      country: 'Ireland',
      region: 'Leinster',
      themes: ['Air quality', 'Odour'],
      capabilities: ['Air monitoring'],
      measurementNeed: 'Continuous ambient air measurement',
      status: 'OPEN',
      deadlineEpoch: inDays(10),
    }),
    fx({
      id: 'air-defra',
      title: 'Air quality sensor network',
      buyer: 'Defra',
      country: 'United Kingdom',
      region: 'England',
      themes: ['Air quality'],
      capabilities: ['Air monitoring', 'Sensor calibration'],
      status: 'OPEN',
      deadlineEpoch: inDays(25),
      following: true,
    }),
    fx({
      id: 'wastewater-uisce',
      title: 'Wastewater effluent programme',
      buyer: 'Uisce Eireann',
      country: 'Ireland',
      themes: ['Water', 'Wastewater'],
      capabilities: ['Effluent monitoring'],
      status: 'OPEN',
      deadlineEpoch: inDays(5),
    }),
    fx({
      id: 'wastewater-scottish',
      title: 'Treatment works assessment',
      buyer: 'Scottish Water',
      country: 'United Kingdom',
      themes: ['Water', 'Odour'],
      capabilities: ['Odour monitoring'],
      status: 'CLOSED',
      deadlineEpoch: inDays(40),
      supportedClaim: 'wastewater odour nuisance abatement',
    }),
    fx({
      id: 'noise-super',
      title: 'Environmental noise survey',
      buyer: 'City Council',
      country: 'Ireland',
      themes: ['Noise'],
      capabilities: ['Noise monitoring'],
      status: 'SUPERSEDED',
      deadlineEpoch: null,
    }),
  ]

  const ALL_IDS = ['air-defra', 'air-epa', 'noise-super', 'wastewater-scottish', 'wastewater-uisce']

  const run = (filters: EllonaFilters) =>
    filterOpportunities(FIXTURES, (o) => o, filters, FILTER_NOW)
      .map((o) => o.id)
      .sort()

  // The headline regression guard: two different searches must produce two
  // different, genuinely filtered portfolios — never the same full list.
  test('different Ellona searches must not generate the same unfiltered portfolio', () => {
    const air = run({ q: 'air' })
    const wastewater = run({ q: 'wastewater' })
    assert.deepEqual(air, ['air-defra', 'air-epa'])
    assert.deepEqual(wastewater, ['wastewater-scottish', 'wastewater-uisce'])
    assert.notDeepEqual(air, wastewater)
    assert.notDeepEqual(air, ALL_IDS)
    assert.notDeepEqual(wastewater, ALL_IDS)
    assert.ok(air.length < FIXTURES.length)
    assert.ok(wastewater.length < FIXTURES.length)
  })

  test('multi-word searches match across fields (tokenised AND, not one contiguous phrase)', () => {
    // "air quality" lives in the themes and "Ireland" is the country — these are
    // never a single contiguous substring, yet a natural search for all three
    // words must find the EPA record. This is the 0-results regression guard.
    assert.deepEqual(run({ q: 'air quality ireland' }), ['air-epa'])
    // Word order is irrelevant; every token simply has to appear somewhere.
    assert.deepEqual(run({ q: 'ireland quality air' }), ['air-epa'])
    // Extra whitespace between tokens is ignored.
    assert.deepEqual(run({ q: '  air    quality  ' }), ['air-defra', 'air-epa'])
    // A token that appears in no record still narrows the result to nothing.
    assert.deepEqual(run({ q: 'air quality mongolia' }), [])
    // Words spread across buyer + theme ("Scottish" buyer, "Odour" theme).
    assert.deepEqual(run({ q: 'scottish odour' }), ['wastewater-scottish'])
  })

  test('country / theme / capability filters select the right records', () => {
    assert.deepEqual(run({ country: 'Ireland' }), ['air-epa', 'noise-super', 'wastewater-uisce'])
    assert.deepEqual(run({ country: 'United Kingdom' }), ['air-defra', 'wastewater-scottish'])
    assert.deepEqual(run({ theme: 'Odour' }), ['air-epa', 'wastewater-scottish'])
    assert.deepEqual(run({ capability: 'Air monitoring' }), ['air-defra', 'air-epa'])
  })

  test('open vs closed uses the authoritative CLOSED_STATUSES set', () => {
    assert.deepEqual([...CLOSED_STATUSES].sort(), ['CLOSED', 'NOT RELEVANT', 'SUPERSEDED'])
    assert.deepEqual(run({ status: 'open' }), ['air-defra', 'air-epa', 'wastewater-uisce'])
    assert.deepEqual(run({ status: 'closed' }), ['noise-super', 'wastewater-scottish'])
  })

  test('deadline windows honour only 14 and 30 days', () => {
    assert.deepEqual(run({ deadlineWindow: '14' }), ['air-epa', 'wastewater-uisce'])
    assert.deepEqual(run({ deadlineWindow: '30' }), ['air-defra', 'air-epa', 'wastewater-uisce'])
  })

  test('followed-only uses the authoritative follow state', () => {
    assert.deepEqual(run({ followedOnly: true }), ['air-defra'])
  })

  test('combined filters are ANDed together', () => {
    assert.deepEqual(run({ country: 'Ireland', theme: 'Odour', status: 'open' }), ['air-epa'])
    assert.deepEqual(run({ q: 'odour', country: 'United Kingdom' }), ['wastewater-scottish'])
  })

  test('zero results stay zero — never fall back to the full portfolio', () => {
    assert.deepEqual(run({ country: 'Narnia' }), [])
    assert.deepEqual(run({ status: 'closed', deadlineWindow: '14' }), [])
  })

  test('no filters returns the whole portfolio', () => {
    assert.deepEqual(run({}), ALL_IDS)
  })

  test('invalid filter values never bypass the filter or leak arbitrary state', () => {
    // Unknown status / deadline collapse to "not applied" — never interpreted.
    assert.deepEqual(run({ status: 'banana' }), ALL_IDS)
    assert.deepEqual(run({ deadlineWindow: '7' }), ALL_IDS)
    assert.deepEqual(run({ status: "garbage-value-123'--" }), ALL_IDS)
    // A bad value on one dimension must not disable the other, valid dimensions.
    assert.deepEqual(run({ status: 'banana', country: 'Ireland' }), ['air-epa', 'noise-super', 'wastewater-uisce'])
    const n = normalizeFilters({ status: 'banana', deadlineWindow: '7' })
    assert.equal(n.status, '')
    assert.equal(n.deadlineWindow, '')
  })

  test('scope label describes the active filters', () => {
    assert.equal(buildScopeLabel({ country: 'Ireland', theme: 'Odour', status: 'open' }), 'Filtered to: Ireland \u00b7 Odour \u00b7 Open opportunities')
    assert.equal(buildScopeLabel({ q: 'wastewater', deadlineWindow: '30' }), 'Search: wastewater \u00b7 Next 30 days')
    assert.equal(buildScopeLabel({}), 'All routed opportunities')
  })

  test('snapshot metadata carries only the filtered ids plus filters and scope label', () => {
    const filters: EllonaFilters = { q: 'air' }
    const snapshot = {
      filters: normalizeFilters(filters),
      scopeLabel: buildScopeLabel(filters),
      ids: run(filters),
    }
    assert.deepEqual(snapshot.ids, ['air-defra', 'air-epa'])
    assert.ok(snapshot.ids.length < ALL_IDS.length)
    assert.equal(snapshot.scopeLabel, 'Search: air')
    assert.equal(snapshot.filters.q, 'air')
  })

  test('URL builder and parser round-trip the normalised filters', () => {
    const filters: EllonaFilters = { q: 'air', country: 'Ireland', status: 'open', deadlineWindow: '30', followedOnly: true }
    const url = buildPortfolioPdfQuery(filters)
    const qs = url.split('?')[1] || ''
    const parsed = parseFiltersFromParams(new URLSearchParams(qs))
    assert.deepEqual(parsed, normalizeFilters(filters))
    // Invalid-only filters produce the bare path (no query string).
    assert.equal(buildPortfolioPdfQuery({ status: 'banana', deadlineWindow: '7' }), '/api/ellona/portfolio/pdf')
  })
})
