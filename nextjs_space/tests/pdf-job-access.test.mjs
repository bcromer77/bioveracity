import test from 'node:test'
import assert from 'node:assert/strict'
import { createPdfHandlers } from '../lib/pdf-job-access.mjs'

const request = data => new Request('https://example.test/api', { method: 'POST', body: JSON.stringify(data) })
function fixture() {
  const state = { actor: { id: 'owner', institutional: true }, clock: 1000000, calls: [], env: { PUBLIC_PDF_EXTERNAL_PROCESSING_ENABLED: 'true', PDF_JOB_ENCRYPTION_KEY: 'a'.repeat(64), ABACUSAI_API_KEY: 'test-only' } }
  const handlers = createPdfHandlers({ getActor: async () => state.actor, now: () => state.clock, env: state.env, upstream: async (url, options) => {
    state.calls.push({ url, body: JSON.parse(options.body) })
    return Response.json(url.endsWith('createConvertHtmlToPdfRequest') ? { request_id: 'provider-private-id' } : { status: 'SUCCESS', result: { result: 'dGVzdA==' } })
  } })
  return { state, handlers, issue: async (reportKind = 'summary') => (await (await handlers.create(request({ html_content: '<p>Public fixture</p>', reportKind }))).json()).request_id }
}

test('owner creates and polls opaque receipt without exposing provider ID', async () => {
  const f = fixture(); const token = await f.issue()
  assert.ok(!Buffer.from(token, 'base64url').toString().includes('provider-private-id'))
  const response = await f.handlers.status(request({ request_id: token }))
  assert.equal(response.status, 200); assert.equal((await response.json()).pdf_base64, 'dGVzdA==')
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(f.state.calls[1].body.request_id, 'provider-private-id')
})
test('anonymous create and poll never contact provider', async () => {
  const f = fixture(); f.state.actor = null
  assert.equal((await f.handlers.create(request({ html_content: 'x' }))).status, 401)
  assert.equal((await f.handlers.status(request({ request_id: 'x' }))).status, 401)
  assert.equal(f.state.calls.length, 0)
})
test('wrong account, including institutional account, cannot poll', async () => {
  const f = fixture(); const token = await f.issue(); f.state.actor.id = 'other'
  assert.equal((await f.handlers.status(request({ request_id: token }))).status, 404)
  assert.equal(f.state.calls.length, 1)
})
test('raw provider IDs and tampered receipts are denied before provider', async () => {
  const f = fixture(); const token = await f.issue()
  for (const value of ['provider-private-id', token.slice(0, 10) + (token[10] === 'a' ? 'b' : 'a') + token.slice(11), '', null, 123]) assert.equal((await f.handlers.status(request({ request_id: value }))).status, 404)
  assert.equal(f.state.calls.length, 1)
})
test('expired receipt and revoked account fail closed', async () => {
  const f = fixture(); const token = await f.issue(); f.state.clock += 900000
  assert.equal((await f.handlers.status(request({ request_id: token }))).status, 404)
  f.state.actor = null
  assert.equal((await f.handlers.status(request({ request_id: token }))).status, 401)
  assert.equal(f.state.calls.length, 1)
})
test('downgrade blocks full report at poll and create', async () => {
  const f = fixture(); const token = await f.issue('report'); f.state.actor.institutional = false
  assert.equal((await f.handlers.status(request({ request_id: token }))).status, 403)
  assert.equal((await f.handlers.create(request({ html_content: 'x', reportKind: 'report' }))).status, 403)
  assert.equal(f.state.calls.length, 1)
})
test('missing/malformed key, missing provider key and disabled processing deny outbound', async () => {
  for (const [name, value] of [['PDF_JOB_ENCRYPTION_KEY', undefined], ['PDF_JOB_ENCRYPTION_KEY', 'weak'], ['ABACUSAI_API_KEY', undefined], ['PUBLIC_PDF_EXTERNAL_PROCESSING_ENABLED', undefined]]) {
    const f = fixture(); f.state.env[name] = value
    assert.equal((await f.handlers.create(request({ html_content: 'x' }))).status, 503)
    assert.equal(f.state.calls.length, 0)
  }
})
test('key rotation invalidates existing receipts', async () => {
  const f = fixture(); const token = await f.issue(); f.state.env.PDF_JOB_ENCRYPTION_KEY = 'b'.repeat(64)
  assert.equal((await f.handlers.status(request({ request_id: token }))).status, 404)
  assert.equal(f.state.calls.length, 1)
})
test('private case context, oversized and malformed payloads never reach provider', async () => {
  const f = fixture()
  for (const key of ['caseId', 'workspaceId', 'case_id', 'workspace_id']) assert.equal((await f.handlers.create(request({ html_content: 'x', [key]: 'private' }))).status, 403)
  assert.equal((await f.handlers.create(request({ html_content: 'x'.repeat(1024 * 1024) }))).status, 400)
  assert.equal((await f.handlers.create(request({ html_content: {} }))).status, 400)
  assert.equal((await f.handlers.create(request({ html_content: 'x', reportKind: 'fake' }))).status, 400)
  assert.equal(f.state.calls.length, 0)
})
test('provider errors are generic, never reflected to clients', async () => {
  const handlers = createPdfHandlers({ getActor: async () => ({ id: 'owner', institutional: true }), env: fixture().state.env, upstream: async () => Response.json({ error: 'SECRET provider details' }, { status: 500 }) })
  const response = await handlers.create(request({ html_content: 'x' }))
  assert.equal(response.status, 502); assert.ok(!(await response.text()).includes('SECRET'))
})
