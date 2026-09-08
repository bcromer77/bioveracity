'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Data shapes
// ---------------------------------------------------------------------------
export interface MapPoint {
  slug: string
  name: string
  type: string
  lat: number
  lng: number
  /** Linear water bodies (rivers) are marked indicatively, not as a hard pin. */
  indicative?: boolean
  /** Plain-language category used to line the map up with the page filter chips. */
  category?: string
  /** Latest meaningful change on the public record for this place (source-backed). */
  latestChange?: string | null
  latestChangeDate?: string | null
  /** Honest evidence posture: 'divergence' | 'verified' | 'neutral'. */
  evidenceState?: string | null
}

export interface MapConnection {
  fromSlug: string
  toSlug: string
  label: string
}

// ---------------------------------------------------------------------------
// Restrained palette
// ---------------------------------------------------------------------------
const COLOR = {
  neutral: '#475569', // slate-600 — ordinary asset
  divergence: '#dc2626', // red — genuine evidence divergence only
  verified: '#16a34a', // green — verified / resolved only
  selected: '#E9AD20', // BioVeracity yellow — focused place
  line: '#64748b', // slate-500 — relationship lines
}

function colorFor(p: MapPoint, selected: boolean): string {
  if (selected) return COLOR.selected
  if (p.evidenceState === 'divergence') return COLOR.divergence
  if (p.evidenceState === 'verified') return COLOR.verified
  return COLOR.neutral
}

// Visual grammar by asset type. Shapes are deliberately sparse so the map does
// not turn into a rainbow of symbols.
type Shape = 'circle' | 'ring' | 'square' | 'diamond' | 'target'
function shapeFor(type: string): Shape {
  switch (type) {
    case 'wastewater':
      return 'circle'
    case 'industrial':
      return 'square'
    case 'river':
    case 'lake':
      return 'ring'
    case 'monitoring':
      return 'target'
    case 'port':
    case 'project':
      return 'diamond'
    default:
      return 'circle'
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'wastewater':
      return 'Wastewater treatment'
    case 'industrial':
      return 'Industrial site'
    case 'river':
      return 'River / water body'
    case 'lake':
      return 'Lake / water body'
    case 'monitoring':
      return 'Monitoring'
    case 'port':
      return 'Port / maritime'
    case 'project':
      return 'Project'
    default:
      return type.charAt(0).toUpperCase() + type.slice(1)
  }
}

// Build a small, understated divIcon for a point.
function buildIcon(p: MapPoint, selected: boolean, dimmed: boolean): L.DivIcon {
  const shape = shapeFor(p.type)
  const color = colorFor(p, selected)
  const size = selected ? 20 : 14
  const half = size / 2
  const opacity = dimmed ? 0.35 : 1
  const halo = selected ? `0 0 0 3px rgba(233,173,32,0.35), ` : ''
  const whiteRing = '0 0 0 1.5px #ffffff'

  // Rivers/lakes render as a hollow ring; indicative rivers use a dashed ring.
  const filled = shape === 'circle' || shape === 'square' || shape === 'diamond'
  const bg = filled ? color : 'transparent'
  const borderStyle = p.indicative && shape === 'ring' ? 'dashed' : 'solid'
  const borderWidth = filled ? 1 : 2.5
  const borderColor = filled ? 'rgba(0,0,0,0.35)' : color

  let radius = '50%'
  let transform = ''
  if (shape === 'square') radius = '2px'
  if (shape === 'diamond') {
    radius = '2px'
    transform = 'transform: rotate(45deg);'
  }

  // 'target' = ring with a centre dot (monitoring)
  const inner =
    shape === 'target'
      ? `<span style="position:absolute;top:50%;left:50%;width:4px;height:4px;border-radius:50%;background:${color};transform:translate(-50%,-50%);"></span>`
      : ''

  const html = `<span style="
    display:block;position:relative;width:${size}px;height:${size}px;
    background:${bg};border:${borderWidth}px ${borderStyle} ${borderColor};
    border-radius:${radius};${transform}
    box-shadow:${halo}${whiteRing};opacity:${opacity};
    transition:all .12s ease;">${inner}</span>`

  return L.divIcon({
    html,
    className: 'bv-marker',
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half - 2],
  })
}

// ---------------------------------------------------------------------------
// Fit the view to the actual plotted geography (no fixed regional zoom).
// ---------------------------------------------------------------------------
function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 })
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11)
    }
  }, [points, map])
  return null
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
export default function RegionalMapInner({
  points,
  connections = [],
  activeCategory = 'all',
}: {
  points: MapPoint[]
  connections?: MapConnection[]
  activeCategory?: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  // Which categories actually map onto an asset-type emphasis.
  const emphasisActive = activeCategory === 'water' || activeCategory === 'sewage'
  const isEmphasised = (p: MapPoint) => {
    if (!emphasisActive) return true
    return p.category === activeCategory
  }

  const bySlug = useMemo(() => {
    const m: Record<string, MapPoint> = {}
    for (const p of points) m[p.slug] = p
    return m
  }, [points])

  // Only draw a relationship where BOTH endpoints are actually plotted. Nothing
  // is inferred from proximity — these edges come from the source-backed record.
  const edges = useMemo(
    () =>
      connections
        .map((c) => {
          const a = bySlug[c.fromSlug]
          const b = bySlug[c.toSlug]
          if (!a || !b) return null
          return { a, b, label: c.label, key: `${c.fromSlug}->${c.toSlug}` }
        })
        .filter((e): e is { a: MapPoint; b: MapPoint; label: string; key: string } => e !== null),
    [connections, bySlug],
  )

  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lng]
    : [52.4, 0.05]

  return (
    <MapContainer
      center={center}
      zoom={10}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
      className="z-0 bg-[#f6f7f8]"
    >
      <FitBounds points={points} />

      {/* Low-noise Esri light-grey basemap + place labels. Keyless and reliable
          from server environments. */}
      <TileLayer
        attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />

      {/* Source-backed relationship lines (thin, low opacity). */}
      {edges.map((e) => {
        const active =
          !emphasisActive || isEmphasised(e.a) || isEmphasised(e.b) ? 1 : 0.15
        return (
          <Polyline
            key={e.key}
            positions={[
              [e.a.lat, e.a.lng],
              [e.b.lat, e.b.lng],
            ]}
            pathOptions={{
              color: COLOR.line,
              weight: 1.5,
              opacity: 0.5 * active,
              dashArray: '4 5',
            }}
          />
        )
      })}

      {points.map((p) => {
        const isSel = selected === p.slug
        const dimmed = !isEmphasised(p) && !isSel
        return (
          <Marker
            key={p.slug}
            position={[p.lat, p.lng]}
            icon={buildIcon(p, isSel, dimmed)}
            zIndexOffset={isSel ? 1000 : 0}
            eventHandlers={{ click: () => setSelected(p.slug) }}
          >
            <Popup>
              <div style={{ fontSize: '12.5px', lineHeight: 1.45, minWidth: 180 }}>
                <strong style={{ fontSize: '13.5px' }}>{p.name}</strong>
                <div style={{ color: '#64748b', marginTop: 1 }}>
                  {typeLabel(p.type)}
                  {p.indicative ? ' · indicative location' : ''}
                </div>

                <div style={{ marginTop: 8, color: '#334155' }}>
                  <div style={{ fontWeight: 600, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    What changed
                  </div>
                  <div style={{ marginTop: 2 }}>
                    {p.latestChange ? p.latestChange : 'No recent change recorded on the public record.'}
                  </div>
                </div>

                {p.evidenceState && p.evidenceState !== 'neutral' && (
                  <div style={{ marginTop: 8 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '1px 7px',
                        borderRadius: 999,
                        color: p.evidenceState === 'divergence' ? '#b91c1c' : '#15803d',
                        background: p.evidenceState === 'divergence' ? '#fee2e2' : '#dcfce7',
                      }}
                    >
                      {p.evidenceState === 'divergence' ? 'Unresolved divergence' : 'Established record'}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => router.push(`/asset/${p.slug}`)}
                  style={{
                    marginTop: 10,
                    color: '#1663c7',
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  Open record →
                </button>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
