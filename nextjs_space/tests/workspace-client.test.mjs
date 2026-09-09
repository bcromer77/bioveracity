import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { casePayload, caseListPath, workspaceRequest, apiMessage, displayDate, templates } from '../components/workspace/workspace-client.mjs';

test('normalises user-entered title and sites without inventing coordinates', () => {
  assert.deepEqual(casePayload(' Permit review ', 'PLANNING', ' North site \n\n South site '), { title: 'Permit review', template: 'PLANNING', sites: [{ name: 'North site' }, { name: 'South site' }] });
});
test('same case shape supports all five templates', () => {
  for (const template of templates) assert.deepEqual(casePayload('Decision', template.id, '').sites, []);
});
test('rejects empty, overlong and unsupported input before network call', () => {
  for (const title of ['', ' '.repeat(5), 'a'.repeat(161)]) assert.throws(() => casePayload(title, 'PLANNING', ''));
  assert.throws(() => casePayload('Case', 'CBAM_CALCULATOR', ''));
  assert.throws(() => casePayload('Case', 'GENERAL', Array(21).fill('Site').join('\n')));
  assert.throws(() => casePayload('Case', 'GENERAL', 's'.repeat(161)));
});
test('20 sites accepted, path components encoded', () => {
  assert.equal(casePayload('Case', 'FARMER', Array(20).fill('Site').join('\n')).sites.length, 20);
  assert.equal(caseListPath('a/b?x'), '/api/workspaces/a%2Fb%3Fx/cases');
});
test('GET uses no-store and same-origin credentials and forwards cancellation', async () => {
  const controller = new AbortController();
  const result = await workspaceRequest('/api/workspaces', { signal: controller.signal }, async (url, options) => {
    assert.equal(url, '/api/workspaces'); assert.equal(options.cache, 'no-store'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.signal, controller.signal);
    return { ok: true, json: async () => ({ workspaces: [] }) };
  });
  assert.deepEqual(result, { workspaces: [] });
});
test('POST preserves submitted data but enforces private cache policy', async () => {
  await workspaceRequest('/api/workspaces', { method: 'POST', body: '{"name":"Review"}', cache: 'force-cache' }, async (_, options) => {
    assert.equal(options.method, 'POST'); assert.equal(options.body, '{"name":"Review"}'); assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => ({ workspace: { id: 'one' } }) };
  });
});
test('errors expose bounded guidance not arbitrary server error contents', async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 503]) {
    await assert.rejects(workspaceRequest('/api/workspaces', {}, async () => ({ ok: false, status, json: async () => { throw new Error('must not read private server internals'); } })), { message: apiMessage(status) });
  }
  assert.match(apiMessage(503), /not enabled/);
  assert.equal(apiMessage(403), apiMessage(404));
});
test('preserves invalid date as unavailable; displays UTC for creation timestamp', () => {
  assert.equal(displayDate('not a date'), 'Date unavailable');
  assert.match(displayDate('2026-09-09T12:00:00Z'), /12:00:00 UTC$/);
});
test('UI source has account/workspace/case remount boundaries and no mock storage', () => {
  const ui = readFileSync(new URL('../components/workspace/workspace-dashboard.tsx', import.meta.url), 'utf8');
  assert.match(ui, /AccountWorkspace key=\{session.user.id\}/);
  assert.match(ui, /CaseBoard key=\{selected\}/);
  assert.match(ui, /CaseSummary key=\{selected\}/);
  assert.equal((ui.match(/return \(\) => controller.abort\(\)/g) || []).length, 3);
  assert.doesNotMatch(ui, /localStorage|dangerouslySetInnerHTML/);
  assert.match(ui, /not a CBAM calculation/);
});
