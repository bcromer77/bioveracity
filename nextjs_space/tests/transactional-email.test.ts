import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveEmailConfig,
  createEmailer,
  parseFrom,
  EmailConfigError,
  EmailDeliveryError,
  type EmailMessage,
} from '../lib/email/transactional'

const MESSAGE: EmailMessage = {
  to: 'recipient@example.com',
  subject: 'Reset your BioVeracity password',
  html: '<p>link</p>',
  text: 'link',
}

type MockResponse = { ok: boolean; status: number; json?: () => Promise<unknown> }

function mockFetch(response: MockResponse) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return response as unknown as Response
  }) as unknown as typeof fetch & { calls: typeof calls }
  ;(fn as unknown as { calls: typeof calls }).calls = calls
  return fn as typeof fetch & { calls: typeof calls }
}

test('parseFrom handles bare and named addresses', () => {
  assert.deepEqual(parseFrom('sender@example.com'), { email: 'sender@example.com' })
  assert.deepEqual(parseFrom('BioVeracity <hello@bioveracity.com>'), { email: 'hello@bioveracity.com', name: 'BioVeracity' })
  assert.deepEqual(parseFrom('"BioVeracity Team" <hello@bioveracity.com>'), { email: 'hello@bioveracity.com', name: 'BioVeracity Team' })
})

test('resolveEmailConfig selects resend explicitly', () => {
  const config = resolveEmailConfig({
    TRANSACTIONAL_EMAIL_PROVIDER: 'resend',
    TRANSACTIONAL_EMAIL_FROM: 'hello@bioveracity.com',
    RESEND_API_KEY: 'rk_test',
  })
  assert.deepEqual(config, { provider: 'resend', from: 'hello@bioveracity.com', apiKey: 'rk_test' })
})

test('resolveEmailConfig selects abacus explicitly', () => {
  const config = resolveEmailConfig({
    TRANSACTIONAL_EMAIL_PROVIDER: 'abacus',
    TRANSACTIONAL_EMAIL_FROM: 'hello@bioveracity.com',
    ABACUSAI_API_KEY: 'ak_test',
    WEB_APP_ID: 'app_test',
    NOTIF_ID_TRANSACTIONAL_EMAIL: 'notif_test',
  })
  assert.deepEqual(config, {
    provider: 'abacus',
    from: 'hello@bioveracity.com',
    apiKey: 'ak_test',
    appId: 'app_test',
    notificationId: 'notif_test',
  })
})

test('resolveEmailConfig never falls back silently and reports what is missing', () => {
  assert.throws(() => resolveEmailConfig({}), EmailConfigError)
  assert.throws(() => resolveEmailConfig({ TRANSACTIONAL_EMAIL_PROVIDER: 'resend' }), EmailConfigError)
  assert.throws(
    () => resolveEmailConfig({ TRANSACTIONAL_EMAIL_PROVIDER: 'resend', TRANSACTIONAL_EMAIL_FROM: 'x@y.com' }),
    EmailConfigError,
  )
  // Abacus with missing pieces.
  assert.throws(
    () => resolveEmailConfig({ TRANSACTIONAL_EMAIL_PROVIDER: 'abacus', TRANSACTIONAL_EMAIL_FROM: 'x@y.com' }),
    EmailConfigError,
  )
  // Unknown provider is rejected, not defaulted.
  assert.throws(
    () => resolveEmailConfig({ TRANSACTIONAL_EMAIL_PROVIDER: 'sendgrid', TRANSACTIONAL_EMAIL_FROM: 'x@y.com' }),
    EmailConfigError,
  )
})

test('resend emailer posts the correct contract and succeeds on 2xx', async () => {
  const fetchImpl = mockFetch({ ok: true, status: 200 })
  const emailer = createEmailer({ provider: 'resend', from: 'hello@bioveracity.com', apiKey: 'rk_test' }, fetchImpl)
  await emailer.send(MESSAGE)
  assert.equal(fetchImpl.calls.length, 1)
  const call = fetchImpl.calls[0]
  assert.equal(call.url, 'https://api.resend.com/emails')
  assert.equal(call.init.method, 'POST')
  const headers = call.init.headers as Record<string, string>
  assert.equal(headers.Authorization, 'Bearer rk_test')
  const body = JSON.parse(call.init.body as string)
  assert.equal(body.from, 'hello@bioveracity.com')
  assert.deepEqual(body.to, ['recipient@example.com'])
  assert.equal(body.subject, MESSAGE.subject)
  assert.equal(body.html, MESSAGE.html)
  assert.equal(body.text, MESSAGE.text)
})

test('resend emailer throws a delivery error on non-2xx', async () => {
  const fetchImpl = mockFetch({ ok: false, status: 422 })
  const emailer = createEmailer({ provider: 'resend', from: 'hello@bioveracity.com', apiKey: 'rk_test' }, fetchImpl)
  await assert.rejects(emailer.send(MESSAGE), EmailDeliveryError)
})

test('abacus emailer posts the correct contract and requires a confirmed delivery', async () => {
  const fetchImpl = mockFetch({ ok: true, status: 200, json: async () => ({ result: { success: true } }) })
  const emailer = createEmailer(
    { provider: 'abacus', from: 'BioVeracity <hello@bioveracity.com>', apiKey: 'ak_test', appId: 'app_test', notificationId: 'notif_test' },
    fetchImpl,
  )
  await emailer.send(MESSAGE)
  const call = fetchImpl.calls[0]
  assert.equal(call.url, 'https://apps.abacus.ai/api/sendNotificationEmail')
  const headers = call.init.headers as Record<string, string>
  assert.equal(headers.Authorization, 'Bearer ak_test')
  const body = JSON.parse(call.init.body as string)
  assert.equal(body.app_id, 'app_test')
  assert.equal(body.notification_id, 'notif_test')
  assert.equal(body.recipient_email, 'recipient@example.com')
  assert.equal(body.is_html, true)
  assert.equal(body.sender_email, 'hello@bioveracity.com')
  assert.equal(body.sender_alias, 'BioVeracity')
})

test('abacus emailer throws when delivery is not confirmed', async () => {
  const fetchImpl = mockFetch({ ok: true, status: 200, json: async () => ({ result: { success: false } }) })
  const emailer = createEmailer(
    { provider: 'abacus', from: 'hello@bioveracity.com', apiKey: 'ak_test', appId: 'app_test', notificationId: 'notif_test' },
    fetchImpl,
  )
  await assert.rejects(emailer.send(MESSAGE), EmailDeliveryError)
})

test('abacus emailer treats a disabled notification as delivered', async () => {
  const fetchImpl = mockFetch({ ok: true, status: 200, json: async () => ({ result: { notification_disabled: true } }) })
  const emailer = createEmailer(
    { provider: 'abacus', from: 'hello@bioveracity.com', apiKey: 'ak_test', appId: 'app_test', notificationId: 'notif_test' },
    fetchImpl,
  )
  await emailer.send(MESSAGE)
  assert.equal(fetchImpl.calls.length, 1)
})

test('abacus emailer throws a delivery error on non-2xx', async () => {
  const fetchImpl = mockFetch({ ok: false, status: 500 })
  const emailer = createEmailer(
    { provider: 'abacus', from: 'hello@bioveracity.com', apiKey: 'ak_test', appId: 'app_test', notificationId: 'notif_test' },
    fetchImpl,
  )
  await assert.rejects(emailer.send(MESSAGE), EmailDeliveryError)
})
