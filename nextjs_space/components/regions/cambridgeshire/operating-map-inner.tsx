'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap, LayersControl, ZoomControl, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { OPPoint, OPConnection } from './operating-picture'

// ---------------------------------------------------------------------------
// Restrained palette (tuned for a dark satellite basemap)
// ---------------------------------------------------------------------------
const COLOR = {
  neutral: '#475569', // slate-300 — ordinary place, legible on imagery
  divergence: '#f87171', // red-400 — genuine evidence divergence only
  verified: '#4ade80', // green-400 — verified / resolved only
  selected: '#E9AD20', // BioVeracity yellow — focused place
  line: '#7dd3fc', // sky-300 — source-backed relationship lines
}

function colorFor(p: OPPoint, selected: boolean): string {
  if (selected) return COLOR.selected
  if (p.evidenceState === 'divergence') return COLOR.divergence
  if (p.evidenceState === 'verified') return COLOR.verified
  return COLOR.neutral
}

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

// Build an understated marker. `active` places (evidence inside the current
// replay window) get a soft pulsing ring so the eye is drawn to what changed.
function buildIcon(p: OPPoint, selected: boolean, dimmed: boolean, active: boolean): L.DivIcon {
  const shape = shapeFor(p.type)
  const color = colorFor(p, selected)
  const size = selected ? 20 : 14
  const half = size / 2
  const opacity = dimmed ? 0.3 : 1

  const filled = shape === 'circle' || shape === 'square' || shape === 'diamond'
  const bg = filled ? color : 'transparent'
  const borderStyle = p.indicative && shape === 'ring' ? 'dashed' : 'solid'
  const borderWidth = filled ? 1 : 2.5
  const borderColor = filled ? 'rgba(0,0,0,0.45)' : color

  let radius = '50%'
  let transform = ''
  if (shape === 'square') radius = '2px'
  if (shape === 'diamond') {
    radius = '2px'
    transform = 'transform: rotate(45deg);'
  }

  const inner =
    shape === 'target'
      ? `<span style="position:absolute;top:50%;left:50%;width:4px;height:4px;border-radius:50%;background:${color};transform:translate(-50%,-50%);"></span>`
      : ''

  // Pulsing evidence ring — only where activity falls inside the replay window.
  const pulse = active
    ? `<span class="bv-pulse" style="--bv-pulse:${color};"></span>`
    : ''

  const halo = selected ? '0 0 0 3px rgba(233,173,32,0.4), ' : ''
  const ring = '0 0 0 1.5px rgba(0,0,0,0.55)'

  const html = `<span style="display:block;position:relative;width:${size}px;height:${size}px;">
    ${pulse}
    <span style="display:block;position:relative;width:${size}px;height:${size}px;
      background:${bg};border:${borderWidth}px ${borderStyle} ${borderColor};
      border-radius:${radius};${transform}
      box-shadow:${halo}${ring};opacity:${opacity};transition:all .12s ease;">${inner}</span>
  </span>`

  return L.divIcon({
    html,
    className: 'bv-op-marker',
    iconSize: [size, size],
    iconAnchor: [half, half],
  })
}

function FitBounds({ points }: { points: OPPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 11 })
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11)
    }
  }, [points, map])
  return null
}

export default function OperatingMapInner({
  points,
  connections,
  activeSlugs,
  selectedSlug,
  onSelect,
  emphasisCategory,
}: {
  points: OPPoint[]
  connections: OPConnection[]
  activeSlugs: Set<string>
  selectedSlug: string | null
  onSelect: (slug: string) => void
  emphasisCategory: string | null
}) {
  const bySlug = useMemo(() => {
    const m: Record<string, OPPoint> = {}
    for (const p of points) m[p.slug] = p
    return m
  }, [points])

  const edges = useMemo(
    () =>
      connections
        .map((c) => ({ a: bySlug[c.fromSlug], b: bySlug[c.toSlug], label: c.label }))
        .filter((e) => e.a && e.b),
    [connections, bySlug],
  )

  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lng]
    : [52.35, 0.05]

  const isEmphasised = (p: OPPoint) => !emphasisCategory || p.category === emphasisCategory

  return (
    <MapContainer
      center={center}
      zoom={10}
      className="h-full w-full bg-[#0b1220]"
      zoomControl={false}
      attributionControl={true}
      scrollWheelZoom
    >
      <ZoomControl position="bottomright" />
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Reference map">
          <TileLayer attribution='Tiles &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer attribution='Tiles &copy; Esri, Maxar, Earthstar Geographics and the GIS User Community' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={18} />
        </LayersControl.BaseLayer>
      </LayersControl>
      <TileLayer attribution='Labels &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={18} />

      <FitBounds points={points} />

      {/* Source-backed relationships only. */}
      {edges.map((e, i) => {
        const dim = emphasisCategory ? !(isEmphasised(e.a) || isEmphasised(e.b)) : false
        return (
          <Polyline
            key={i}
            positions={[
              [e.a.lat, e.a.lng],
              [e.b.lat, e.b.lng],
            ]}
            pathOptions={{
              color: COLOR.line,
              weight: 1.5,
              opacity: dim ? 0.12 : 0.6,
              dashArray: '4 5',
            }}
          />
        )
      })}

      {points.map((p) => {
        const isSel = selectedSlug === p.slug
        const dimmed = !isEmphasised(p) && !isSel
        const active = activeSlugs.has(p.slug)
        return (
          <Marker
            key={p.slug}
            position={[p.lat, p.lng]}
            icon={buildIcon(p, isSel, dimmed, active)}
            eventHandlers={{ click: () => onSelect(p.slug) }}
          >
            <Tooltip>{p.name}{p.indicative ? ' · indicative location' : ''}</Tooltip>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
