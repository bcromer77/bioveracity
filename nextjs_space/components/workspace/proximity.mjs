// Pure, testable geographic proximity helpers for the public-records comparison.
//
// This answers ONE review question — "Which planning applications are near
// recorded bat observations?" — as a prompt to review, NOT a finding of
// ecological conflict. Distance is only ever computed between a planning point
// and a bat observation whose location is NOT generalised: a generalised record
// has no precise point, so measuring a distance from it would be misleading.

// Great-circle distance in metres between two { lat, lng } points.
export function haversineMeters(a, b) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// A bat observation may be used for a distance measurement ONLY if it has a
// stated precise point: not generalised, real coordinates, AND an explicit
// coordinate precision. A record whose precision is "not stated"
// (precisionMeters null/absent) is NOT treated as precise — measuring a
// distance from it would describe an unstated precision as if it were exact.
export function hasPrecisePoint(b) {
  return Boolean(b)
    && b.generalised !== true
    && Number.isFinite(b.lat) && Number.isFinite(b.lng)
    && Number.isFinite(b.precisionMeters) && b.precisionMeters > 0
}

// For each planning application, find nearby bat observations within
// `radiusMeters`. Only bats with a stated precise point are used (see
// `hasPrecisePoint`); generalised OR precision-not-stated records are skipped —
// count them with `countImprecise` so the UI can say honestly how many were
// left out. Returns pairs sorted nearest first, each carrying both source
// links and both dates for the reviewer.
export function pairPlanningNearBats(planning, bats, radiusMeters = 2000) {
  const precise = (bats || []).filter(hasPrecisePoint)
  const pairs = []
  for (const p of planning || []) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    for (const bat of precise) {
      const distanceMeters = Math.round(haversineMeters(p, bat))
      if (distanceMeters > radiusMeters) continue
      pairs.push({
        planningId: p.id,
        batId: bat.id,
        distanceMeters,
        planning: { id: p.id, title: p.title, status: p.status ?? null, date: p.eventDate ?? null, sourceUrl: p.sourceUrl },
        bat: { id: bat.id, title: bat.title, date: bat.eventDate ?? null, sourceUrl: bat.sourceUrl, precisionMeters: bat.precisionMeters ?? null },
      })
    }
  }
  pairs.sort((a, b) => a.distanceMeters - b.distanceMeters)
  return pairs
}

// How many bat records were generalised (excluded from distance comparison).
export function countGeneralised(bats) {
  return (bats || []).filter(b => b && b.generalised).length
}

// How many plotted bat records were excluded from the distance comparison
// because their location is not precise — either generalised OR precision not
// stated. Counts only records that have coordinates (i.e. are plotted), so the
// UI can report exactly how many on-map bats were left out of the distances.
export function countImprecise(bats) {
  return (bats || []).filter(b => b && Number.isFinite(b.lat) && Number.isFinite(b.lng) && !hasPrecisePoint(b)).length
}
