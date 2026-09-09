import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSssi, validateBbox, ITEM, LAYER } from '../lib/sources/natural-england.mjs';

const metadata = { fields: ['OBJECTID', 'REF_CODE', 'NAME'].map(name => ({ name })), maxRecordCount: 1, editingInfo: { lastEditDate: 1000 }, copyrightText: 'Test attribution' };
const feature = id => ({ type: 'Feature', properties: { OBJECTID: id, REF_CODE: `test-${id}`, NAME: `Test ${id}` }, geometry: { type: 'Polygon', coordinates: [[[0, 52], [1, 52], [1, 53], [0, 52]]] } });
function fake(overrides = {}) {
  return async url => {
    const u = new URL(url);
    let data = metadata;
    if (url.startsWith(ITEM)) data = { owner: 'Opendata_NE', url: LAYER.replace(/\/0$/, ''), licenseInfo: 'open-government-licence/version/3', accessInformation: 'Test attribution' };
    if (u.searchParams.has('returnIdsOnly')) data = { objectIds: [2, 1] };
    if (u.searchParams.has('objectIds')) data = { type: 'FeatureCollection', features: [feature(Number(u.searchParams.get('objectIds')))] };
    return { ok: true, json: async () => overrides.transform ? overrides.transform(data, u) : data };
  };
}
test('stable IDs, batch completeness, provenance and unknown event dates', async () => {
  const result = await collectSssi({ fetchImpl: fake() });
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].id, 'natural-england:sssi:test-1');
  assert.equal(result.records[0].event_date, null);
  assert.equal(result.records[0].publication_date, null);
  assert.equal(result.source_last_edited_at, '1970-01-01T00:00:01.000Z');
  assert.equal(result.attribution, 'Test attribution');
  assert.equal(result.request_log.length, 6);
  const again = await collectSssi({ fetchImpl: fake() });
  assert.equal(result.records[0].content_sha256, again.records[0].content_sha256);
});
test('rejects invalid and overbroad envelopes', () => {
  for (const bbox of [[1,2,0,3], [0,0,10,10], [NaN,0,1,1]]) assert.throws(() => validateBbox(bbox));
});
test('rejects HTTP and ArcGIS errors', async () => {
  await assert.rejects(collectSssi({ fetchImpl: async () => ({ ok: false, status: 403 }) }), /403/);
  await assert.rejects(collectSssi({ fetchImpl: fake({ transform: () => ({ error: { message: 'Unavailable' } }) }) }), /Unavailable/);
});
test('rejects schema drift', async () => {
  await assert.rejects(collectSssi({ fetchImpl: fake({ transform: d => d === metadata ? { fields: [] } : d }) }), /schema/);
});
test('rejects changed licence', async () => {
  await assert.rejects(collectSssi({ fetchImpl: fake({ transform: d => d.licenseInfo ? { ...d, licenseInfo: 'restricted' } : d }) }), /licence changed/);
});
test('rejects truncated batches', async () => {
  await assert.rejects(collectSssi({ fetchImpl: fake({ transform: d => d.features ? { ...d, exceededTransferLimit: true } : d }) }), /Incomplete/);
});
test('rejects malformed feature identities', async () => {
  await assert.rejects(collectSssi({ fetchImpl: fake({ transform: d => d.features ? { ...d, features: [feature(99)] } : d }) }), /object ID/);
});
test('rejects source change during read', async () => {
  let reads = 0;
  await assert.rejects(collectSssi({ fetchImpl: fake({ transform: d => d === metadata && ++reads === 2 ? { ...d, editingInfo: { lastEditDate: 2000 } } : d }) }), /changed during/);
});
test('empty successful query stays explicitly scoped', async () => {
  const result = await collectSssi({ fetchImpl: fake({ transform: d => d.objectIds ? { objectIds: [] } : d }) });
  assert.equal(result.records.length, 0);
  assert.equal(result.coverage.status, 'complete_for_returned_query');
});
