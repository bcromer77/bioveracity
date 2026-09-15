import { BOUNDARY_SERVICE, DISTRICTS, isDistrict, type Snapshot } from './model'

// Strict whitelist projection: arbitrary imported fields never reach public search.
export function parseSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid snapshot')
  const s = value as Snapshot
  if (s.version !== 1 || typeof s.generatedAt !== 'string' || !Number.isFinite(Date.parse(s.generatedAt)) || s.boundarySource !== BOUNDARY_SERVICE ||
    !Array.isArray(s.coverage) || s.coverage.length !== 6 || new Set(s.coverage.map(c => c.district)).size !== 6 || !Array.isArray(s.groups) || s.groups.length > 50000) throw new Error('Invalid snapshot header')
  const coverage = s.coverage.map(c => {
    if (!c || !isDistrict(c.district) || c.source !== 'gbif' || !['complete', 'partial', 'unavailable'].includes(c.state) ||
      ![c.inspected, c.accepted, c.rejected, c.duplicates, c.nextOffset].every(n => Number.isSafeInteger(n) && n >= 0) ||
      c.accepted + c.rejected + c.duplicates !== c.inspected || typeof c.checkedAt !== 'string' || !Number.isFinite(Date.parse(c.checkedAt)) || typeof c.reason !== 'string') throw new Error('Invalid coverage')
    return { district: c.district, source: c.source, state: c.state, inspected: c.inspected, accepted: c.accepted, rejected: c.rejected, duplicates: c.duplicates, nextOffset: c.nextOffset, checkedAt: c.checkedAt, reason: c.reason.slice(0, 500) }
  })
  const ids = new Set<string>()
  const groups = s.groups.map(g => {
    if (!g || typeof g.id !== 'string' || ids.has(g.id) || !isDistrict(g.district) ||
      typeof g.datasetKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(g.datasetKey) || typeof g.taxon !== 'string' || !g.taxon || g.taxon.length > 160 || typeof g.attribution !== 'string' || !g.attribution || g.attribution.length > 240 ||
      !['http://creativecommons.org/publicdomain/zero/1.0/legalcode', 'http://creativecommons.org/licenses/by/4.0/legalcode'].includes(g.licence) ||
      !Number.isSafeInteger(g.count) || g.count < 1 || !Number.isInteger(g.firstYear) || !Number.isInteger(g.lastYear) || g.firstYear < 1600 || g.firstYear > g.lastYear || g.lastYear > new Date().getUTCFullYear() ||
      !Array.isArray(g.taxonKeys) || !g.taxonKeys.every(k => typeof k === 'string' && k.length < 160)) throw new Error('Invalid aggregate')
    ids.add(g.id)
    return { id: g.id, district: g.district, taxon: g.taxon, count: g.count, firstYear: g.firstYear, lastYear: g.lastYear, licence: g.licence, attribution: g.attribution, datasetKey: g.datasetKey, taxonKeys: [...g.taxonKeys] }
  })
  for (const district of Object.keys(DISTRICTS)) {
    if (groups.filter(g => g.district === district).reduce((n, g) => n + g.count, 0) !== coverage.find(c => c.district === district)?.accepted) throw new Error('Aggregate count mismatch')
  }
  return { version: 1, generatedAt: s.generatedAt, boundarySource: s.boundarySource, coverage, groups }
}
