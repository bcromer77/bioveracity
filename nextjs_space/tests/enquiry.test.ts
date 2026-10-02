import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { ENQUIRY_CTAS, ENQUIRY_SOURCES, enquiryHref, resolveEnquiryContext } from '../lib/enquiry/config'
import { EnquiryValidationError, buildEnquiryEmail, checkRateLimit, claim, enquiryRecipient, enquiryStore, parseEnquiry, settle } from '../lib/enquiry/server'
import { POST } from '../app/api/enquiry/route'

const RECIPIENT = 'private-recipient-test@example.org'
const valid = { name: 'Ada Lovelace', email: 'ada@example.com', organisation: 'Analytical Ltd', type: 'land', message: 'One BNG site in Kent.', source: 'bng', cta: 'bng-hero', requestId: '0b8e7a52-8f1e-4c5e-9a43-5d3c1a1f0e11' }
const sent: Array<Record<string, unknown>> = []
const realFetch = globalThis.fetch

function req(body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  return new Request('http://local/api/enquiry', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
}
function reset() {
  const s = enquiryStore(); s.hits.clear(); s.done.clear(); s.inflight.clear(); sent.length = 0
  Object.assign(process.env, { BIOVERACITY_ENQUIRY_RECIPIENT: RECIPIENT, TRANSACTIONAL_EMAIL_PROVIDER: 'resend', TRANSACTIONAL_EMAIL_FROM: 'BioVeracity <noreply@example.org>', RESEND_API_KEY: 're_test' })
  globalThis.fetch = (async (url: any, init: any) => {
    if (String(url).startsWith('https://api.resend.com/')) { sent.push(JSON.parse(init.body)); return Response.json({ id: 'stub-' + sent.length }) }
    return realFetch(url, init)
  }) as typeof fetch
}
beforeEach(reset)
const uid = (n: number) => `0b8e7a52-8f1e-4c5e-9a43-${String(n).padStart(12, '0')}`

test('context is normalised to an allowlist; unknown or mismatched CTAs are dropped', () => {
  assert.deepEqual(resolveEnquiryContext('bng', 'bng-end'), { source: 'bng', cta: 'bng-end' })
  assert.deepEqual(resolveEnquiryContext('bng', 'srs-hero'), { source: 'bng', cta: null })
  assert.deepEqual(resolveEnquiryContext(undefined, 'srs-chain'), { source: 'uk-srs', cta: 'srs-chain' })
  assert.deepEqual(resolveEnquiryContext('<script>', 'x'), { source: 'home', cta: null })
  for (const cta of Object.keys(ENQUIRY_CTAS) as Array<keyof typeof ENQUIRY_CTAS>) assert.match(enquiryHref(cta), /^\/enquire\?source=[a-z-]+&cta=[a-z-]+$/)
  for (const s of Object.values(ENQUIRY_SOURCES)) assert.doesNotMatch(JSON.stringify(s), /@/)
})

test('validation: required fields, lengths, email, type and malformed bodies', () => {
  assert.equal(parseEnquiry(valid).spam, false)
  for (const bad of [null, [], 'x', { ...valid, name: '' }, { ...valid, email: 'nope' }, { ...valid, message: '   ' }, { ...valid, type: 'admin' }, { ...valid, requestId: 'short' }, { ...valid, name: 'a'.repeat(121) }, { ...valid, message: 'm'.repeat(2001) }, { ...valid, name: 'x\r\nBcc: y' }, { ...valid, email: 42 }])
    assert.throws(() => parseEnquiry(bad), EnquiryValidationError)
  assert.deepEqual(parseEnquiry({ ...valid, website_url: 'http://spam' }), { spam: true })
})

test('rate limit per email and per trusted IP; untrusted proxy uses a shared bucket', () => {
  const s = enquiryStore(); const t = 1_000_000
  for (let i = 0; i < 3; i++) assert.ok(checkRateLimit(s, '1.1.1.1', 'a@b.co', t + i))
  assert.equal(checkRateLimit(s, '1.1.1.1', 'a@b.co', t + 4), false)
  for (let i = 0; i < 2; i++) assert.ok(checkRateLimit(s, '2.2.2.2', `u${i}@b.co`, t))
  for (let i = 0; i < 5; i++) checkRateLimit(s, '3.3.3.3', `v${i}@b.co`, t)
  assert.equal(checkRateLimit(s, '3.3.3.3', 'w@b.co', t), false)
  assert.ok(checkRateLimit(s, null, 'z@b.co', t))
})

test('dedupe: same request id is delivered once, a different body is a conflict', () => {
  const s = enquiryStore(); const e = (parseEnquiry(valid) as any).enquiry
  assert.equal(claim(s, e), 'ok'); assert.equal(claim(s, e), 'inflight'); settle(s, e, true)
  assert.equal(claim(s, e), 'duplicate'); assert.equal(claim(s, { ...e, message: 'other' }), 'conflict')
})

test('recipient comes only from the env var and is validated', () => {
  assert.equal(enquiryRecipient({}), null)
  assert.equal(enquiryRecipient({ BIOVERACITY_ENQUIRY_RECIPIENT: 'not-an-email' }), null)
  assert.equal(enquiryRecipient({ BIOVERACITY_ENQUIRY_RECIPIENT: ` ${RECIPIENT} ` }), RECIPIENT)
})

test('email carries source and CTA context and escapes visitor input', () => {
  const e = (parseEnquiry({ ...valid, message: '<img src=x onerror=alert(1)>' }) as any).enquiry
  const m = buildEnquiryEmail(e)
  assert.match(m.text, /Source: BNG/); assert.match(m.text, /\[bng-hero\]/); assert.match(m.subject, /BNG/)
  assert.doesNotMatch(m.html, /<img/)
})

test('route: valid enquiry is delivered exactly once to the private recipient; response reveals nothing', async () => {
  const res = await POST(req(valid)); const text = await res.text()
  assert.equal(res.status, 200); assert.deepEqual(JSON.parse(text), { ok: true })
  assert.equal(sent.length, 1); assert.deepEqual(sent[0].to, [RECIPIENT]); assert.equal(sent[0].reply_to, 'ada@example.com')
  assert.match(String(sent[0].text), /Source: BNG/)
  assert.ok(!text.includes(RECIPIENT))
  const again = await POST(req(valid)); assert.equal(again.status, 200); assert.equal(sent.length, 1)
})

test('route: concurrent double submit sends once', async () => {
  const body = { ...valid, requestId: uid(7) }
  const [a, b] = await Promise.all([POST(req(body)), POST(req(body))])
  assert.deepEqual([a.status, b.status].sort(), [200, 409]); assert.equal(sent.length, 1)
})

test('route: malformed, oversize, wrong content type and spam fail safely', async () => {
  assert.equal((await POST(req('{nope'))).status, 400)
  assert.equal((await POST(req({ ...valid, email: 'x' }))).status, 400)
  assert.equal((await POST(req(valid, { 'content-type': 'text/plain' }))).status, 415)
  assert.equal((await POST(req({ ...valid, message: 'm'.repeat(9000) }))).status, 413)
  const spam = await POST(req({ ...valid, requestId: uid(9), website_url: 'x' }))
  assert.equal(spam.status, 200); assert.equal(sent.length, 0)
})

test('route: missing recipient or provider config fails generically and sends nothing', async () => {
  delete process.env.BIOVERACITY_ENQUIRY_RECIPIENT
  const res = await POST(req({ ...valid, requestId: uid(11) })); const text = await res.text()
  assert.equal(res.status, 503); assert.doesNotMatch(text, /RECIPIENT|configured|@/i); assert.equal(sent.length, 0)
  reset(); delete process.env.RESEND_API_KEY
  const r2 = await POST(req({ ...valid, requestId: uid(12) })); const t2 = await r2.text()
  assert.equal(r2.status, 503); assert.doesNotMatch(t2, /RESEND|configured|@/i); assert.equal(sent.length, 0)
})

test('route: provider failure is generic and the same request can be retried', async () => {
  globalThis.fetch = (async () => new Response('recipient rejected: ' + RECIPIENT, { status: 422 })) as typeof fetch
  const body = { ...valid, requestId: uid(13) }
  const res = await POST(req(body)); const text = await res.text()
  assert.equal(res.status, 503); assert.ok(!text.includes(RECIPIENT))
  reset(); assert.equal((await POST(req(body))).status, 200); assert.equal(sent.length, 1)
})

test('no recipient address or mailto is hard-coded in enquiry code or public UI', async () => {
  const files: string[] = []
  async function walk(dir: string) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`
      if (e.isDirectory()) await walk(p); else if (/\.(tsx?|mjs)$/.test(p)) files.push(p)
    }
  }
  await walk('app'); await walk('components'); await walk('lib/enquiry')
  for (const f of files) assert.doesNotMatch(await readFile(f, 'utf8'), /mailto:/i, `mailto in ${f}`)
  for (const f of ['lib/lead-notification.ts', 'lib/enquiry/config.ts', 'lib/enquiry/server.ts', 'app/api/enquiry/route.ts', 'components/enquiry/enquiry-form.tsx', 'app/enquire/page.tsx']) {
    const src = await readFile(f, 'utf8')
    assert.doesNotMatch(src.replace(/mailto:\$\{esc\(v\)\}/, ''), /['"`][^'"`\s]+@[a-z0-9-]+\.[a-z.]{2,}['"`]/i, `email literal in ${f}`)
  }
})
