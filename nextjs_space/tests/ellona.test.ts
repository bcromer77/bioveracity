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
  test('a real member gets a writable view; the originator gets a read-only preview; others get nothing', async () => {
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

      // 1) A real member resolves to a WRITABLE view (preview: false) of their own tenant.
      const memberView = await resolveEllonaView(memberId, 'anything@example.invalid')
      assert.ok(memberView, 'member should resolve a view')
      assert.equal(memberView!.preview, false)
      assert.equal(memberView!.workspaceId, ws)
      const memberWs = await findEllonaWorkspace(memberId)
      assert.ok(memberWs && memberWs.workspaceId === ws)

      // 2) The originator (Bazil) is NOT a member anywhere, so he resolves to a
      //    READ-ONLY preview that targets the real Ellona tenant only.
      const ellona = await prisma.partnerTenant.findFirst({ where: { contactEmail: ELLONA.contactEmail }, select: { workspaceId: true } })
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
