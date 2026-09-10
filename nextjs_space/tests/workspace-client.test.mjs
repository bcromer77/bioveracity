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
test('selection screen has account remount boundary, single fetch, persona grid and no mock storage', () => {
  const ui = readFileSync(new URL('../components/workspace/workspace-dashboard.tsx', import.meta.url), 'utf8');
  assert.match(ui, /AccountWorkspace key=\{session.user.id\}/);
  assert.match(ui, /data-persona=/);
  assert.equal((ui.match(/return \(\) => controller.abort\(\)/g) || []).length, 1);
  assert.doesNotMatch(ui, /localStorage|dangerouslySetInnerHTML/);
  assert.match(ui, /CBAM liability/);
  assert.doesNotMatch(ui, /CaseBoard|CaseSummary/);
});
test('universal canvas keeps workspace/case remount boundaries and per-fetch cancellation', () => {
  const ui = readFileSync(new URL('../components/workspace/workspace-canvas.tsx', import.meta.url), 'utf8');
  assert.match(ui, /CanvasBody key=\{session.user.id\}/);
  assert.match(ui, /CaseBoard key=\{workspaceId\}/);
  assert.match(ui, /Investigation key=\{selected\}/);
  assert.match(ui, /CaseSummary key=\{caseId\}/);
  assert.equal((ui.match(/return \(\) => controller.abort\(\)/g) || []).length, 3);
  assert.doesNotMatch(ui, /localStorage|dangerouslySetInnerHTML/);
  assert.match(ui, /not a CBAM calculation/);
  // Real backend wiring, not sample data.
  assert.doesNotMatch(ui, /investigation-data|SAMPLE_/);
  assert.match(ui, /action=search&q=/);
  assert.match(ui, /action: 'import'/);
  assert.match(ui, /action: 'export'/);
});
test('five personas expose only presentation-level presets over the shared canvas', async () => {
  const { personas, getPersona } = await import('../components/workspace/personas.mjs');
  assert.equal(personas.length, 5);
  const keys = personas.map(p => p.key);
  assert.deepEqual(keys, ['ecology', 'planning', 'architecture', 'maritime', 'custom']);
  for (const p of personas) {
    assert.ok(p.title && p.exportTitle && p.template);
    assert.equal(p.prompts.length, 3);
    assert.ok(Array.isArray(p.layers) && p.layers.length > 0);
    for (const l of p.layers) assert.equal(typeof l.default, 'boolean');
  }
  assert.ok(getPersona('custom').layers.every(l => l.default));
  assert.equal(getPersona('does-not-exist').key, 'custom');
});

test('investigation repairs: URL-persisted case, stale-response guards, real audit export, honest map, term-expansion retrieval', () => {
  const ui = readFileSync(new URL('../components/workspace/workspace-canvas.tsx', import.meta.url), 'utf8');
  // A1 — selected case persisted in the URL so a reload restores it.
  assert.match(ui, /useSearchParams/);
  assert.match(ui, /params\.get\('case'\)/);
  assert.match(ui, /router\.replace/);
  assert.match(ui, /sp\.set\('case'/);
  // A2 — monotonic sequence guards prevent a slow earlier response overwriting a newer one.
  for (const seq of ['placeSeq', 'askSeq', 'claimSeq']) assert.match(ui, new RegExp(`${seq}\\.current`));
  assert.match(ui, /seq === askSeq\.current/);
  assert.match(ui, /seq === claimSeq\.current/);
  assert.match(ui, /seq === placeSeq\.current/);
  // A3 — the header "Generate audit pack" runs the real export, not just a scroll.
  assert.match(ui, /async function generateAuditPack/);
  assert.match(ui, /onClick=\{generateAuditPack\}/);
  assert.match(ui, /generateAuditPack[\s\S]*?produceExport\(\)/);
  // A4 — map draws a real metre buffer; species/water are honestly not plotted; no fake "boundary" layer.
  assert.match(ui, /buffer: true/);
  assert.match(ui, /bufferMeters=\{BUFFER_METERS\}/);
  assert.match(ui, /Search buffer/);
  assert.match(ui, /not plotted/);
  assert.doesNotMatch(ui, /boundary: true|'boundary'|Site boundary/);
  // A5 — term-expansion retrieval reuses the existing permissioned search endpoint.
  assert.match(ui, /expandQuery, rankResults/);
  assert.match(ui, /async function retrieve/);
  assert.match(ui, /questionHits\.ranked/);
  assert.match(ui, /claimHits\.ranked/);
  assert.match(ui, /term-expansion/i);
  assert.doesNotMatch(ui, /exact text search/);
});
