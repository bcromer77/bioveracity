import type { WildTopic } from '@/lib/wild-counties/types'

// A lightweight, dependency-free discovery map. It plots approximate PUBLIC localities
// (towns, landmarks, designated areas) — never precise or sensitive species locations —
// as numbered pins that correspond to the numbered discovery list on the same page.
// No map tiles, no client JavaScript: it renders identically on a slow phone and cannot
// "fail to load", and the numbered discovery list is the equivalent, always-present index.
export function CountyMap({ topics, countyName }: { topics: readonly WildTopic[]; countyName: string }) {
  const points = topics
    .map((t, i) => ({ t, i, lat: t.lat, lng: t.lng }))
    .filter((p): p is { t: WildTopic; i: number; lat: number; lng: number } => typeof p.lat === 'number' && typeof p.lng === 'number')
  if (points.length < 2) return null

  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const pad = 0.06
  const minLat = Math.min(...lats) - pad
  const maxLat = Math.max(...lats) + pad
  const minLng = Math.min(...lngs) - pad
  const maxLng = Math.max(...lngs) + pad
  const W = 460
  const H = 360
  const inset = 34
  const spanLat = maxLat - minLat || 1
  const spanLng = maxLng - minLng || 1
  const project = (lat: number, lng: number) => ({
    x: inset + ((lng - minLng) / spanLng) * (W - inset * 2),
    y: inset + ((maxLat - lat) / spanLat) * (H - inset * 2),
  })

  return (
    <figure className="bv-map" aria-hidden="false">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Approximate discovery map of ${countyName}, showing ${points.length} public localities numbered to match the discovery list below.`} preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width={W} height={H} rx="10" fill="#eef1e4" />
        <rect x="6" y="6" width={W - 12} height={H - 12} rx="8" fill="none" stroke="#c7cdb6" strokeWidth="1.5" />
        {points.map((p) => {
          const { x, y } = project(p.lat, p.lng)
          return (
            <g key={p.t.slug}>
              <circle cx={x} cy={y} r="15" fill="#173d35" stroke="#dfc27a" strokeWidth="2" />
              <text x={x} y={y + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#f7f4ec">{p.i + 1}</text>
            </g>
          )
        })}
      </svg>
      <figcaption>Approximate public localities in {countyName}. Numbers match the discovery list. Sensitive or precise wildlife locations are never shown.</figcaption>
    </figure>
  )
}
