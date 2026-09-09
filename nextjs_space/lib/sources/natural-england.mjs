import { createHash } from 'node:crypto';

export const LAYER = 'https://services.arcgis.com/JJzESW51TqeY9uat/arcgis/rest/services/SSSI_England/FeatureServer/0';
export const PORTAL = 'https://naturalengland-defra.opendata.arcgis.com/';
export const ITEM = 'https://www.arcgis.com/sharing/rest/content/items/f10cbb4425154bfda349ccf493487a80';
// Deliberately a discovery envelope, NOT an administrative or catchment boundary.
export const CAMBRIDGE_PETERBOROUGH_BBOX = [-0.55, 52.0, 0.55, 52.75];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function validateBbox(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)
    || bbox[0] >= bbox[2] || bbox[1] >= bbox[3]
    || bbox[0] < -180 || bbox[2] > 180 || bbox[1] < -90 || bbox[3] > 90
    || bbox[2] - bbox[0] > 2 || bbox[3] - bbox[1] > 2) {
    throw new Error('Expected a WGS84 bbox west,south,east,north, at most 2 degrees per axis');
  }
}

export async function collectSssi({ bbox = CAMBRIDGE_PETERBOROUGH_BBOX, fetchImpl = fetch, now = () => new Date() } = {}) {
  validateBbox(bbox);
  const requestLog = [];
  async function request(path, params, base = LAYER) {
    const url = `${base}${path}?${new URLSearchParams({ f: 'json', ...params })}`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
    if (!response.ok) throw new Error(`Natural England HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`Natural England ArcGIS error: ${data.error.message ?? 'unknown'}`);
    requestLog.push({ url, retrieved_at: now().toISOString(), response_sha256: hash(data) });
    return data;
  }
  const item = await request('', {}, ITEM);
  if (item.owner !== 'Opendata_NE' || item.url !== LAYER.replace(/\/0$/, '') || !item.licenseInfo?.includes('open-government-licence/version/3') || !item.accessInformation) throw new Error('Dataset identity or licence changed; review required');
  const metadata = await request('', {});
  const fields = new Set((metadata.fields ?? []).map(f => f.name));
  if (!['OBJECTID', 'REF_CODE', 'NAME'].every(f => fields.has(f))) throw new Error('SSSI schema changed');
  const spatialQuery = { where: '1=1', geometry: bbox.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnIdsOnly: 'true' };
  const index = await request('/query', spatialQuery);
  if (index.exceededTransferLimit || !Array.isArray(index.objectIds) || index.objectIds.some(id => !Number.isSafeInteger(id))) throw new Error('Incomplete or invalid object ID response');
  const ids = [...new Set(index.objectIds)].sort((a, b) => a - b);
  if (ids.length !== index.objectIds.length || ids.length > 10000) throw new Error('Duplicate IDs or region too large');
  const records = [];
  const references = new Set();
  const batchSize = Math.max(1, Math.min(100, Number(metadata.maxRecordCount) || 100));
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const page = await request('/query', { objectIds: batch.join(','), outFields: 'OBJECTID,REF_CODE,NAME', returnGeometry: 'true', outSR: '4326', f: 'geojson' });
    if (page.exceededTransferLimit || page.type !== 'FeatureCollection' || !Array.isArray(page.features) || page.features.length !== batch.length) throw new Error('Incomplete feature batch');
    const received = new Set();
    for (const feature of page.features) {
      const p = feature.properties ?? {};
      if (!batch.includes(p.OBJECTID) || received.has(p.OBJECTID)) throw new Error('Unexpected or duplicate object ID');
      received.add(p.OBJECTID);
      if (typeof p.REF_CODE !== 'string' || !p.REF_CODE.trim() || typeof p.NAME !== 'string' || !p.NAME.trim()) throw new Error('Missing stable site identity');
      if (references.has(p.REF_CODE)) throw new Error('Duplicate stable site reference');
      references.add(p.REF_CODE);
      if (!['Polygon', 'MultiPolygon'].includes(feature.geometry?.type) || !Array.isArray(feature.geometry.coordinates) || !feature.geometry.coordinates.length) throw new Error('Missing polygon geometry');
      records.push({
        id: `natural-england:sssi:${p.REF_CODE}`, name: p.NAME,
        source_record_id: p.REF_CODE, source_object_id: p.OBJECTID,
        evidence_type: 'official_designation_boundary',
        event_date: null, publication_date: null, date_precision: 'unknown',
        geometry: feature.geometry, raw_properties: p,
        content_sha256: hash({ name: p.NAME, reference: p.REF_CODE, geometry: feature.geometry }),
      });
    }
  }
  // Detect an upstream edit while paginating; never publish a mixed-version snapshot.
  const finalMetadata = await request('', {});
  const edit = metadata.editingInfo?.lastEditDate ?? null;
  if (edit !== (finalMetadata.editingInfo?.lastEditDate ?? null)) throw new Error('Source changed during collection; retry');
  records.sort((a, b) => a.id.localeCompare(b.id));
  return {
    schema_version: 'natural-england-sssi/1', publisher: 'Natural England',
    dataset_url: LAYER, catalogue_url: PORTAL,
    licence_url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    attribution: item.accessInformation, licence_source_url: ITEM, source_item_metadata: item,
    source_metadata: metadata,
    source_last_edited_at: typeof edit === 'number' ? new Date(edit).toISOString() : null,
    source_last_edited_precision: typeof edit === 'number' ? 'millisecond' : 'unknown',
    retrieved_at: now().toISOString(), request_log: requestLog,
    coverage: { bbox, crs: 'EPSG:4326', scope: 'discovery envelope; not administrative boundary', status: 'complete_for_returned_query', count: records.length },
    caveats: ['Not a live pollution feed or site-condition assessment.', 'Spatial overlap is not evidence of causation or hydrological connectivity.', 'Source edit time is not designation or publication time.', 'Public data use does not imply partnership or endorsement.', 'Empty results do not establish absence of protected sites outside this query.'],
    records,
  };
}
