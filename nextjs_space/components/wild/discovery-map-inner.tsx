'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, AttributionControl, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// A real, interactive discovery map, built on the app's existing supported map
// architecture (react-leaflet + keyless Esri tiles — the same reliable basemap
// used by the asset place map). It plots the APPROXIMATE PUBLIC localities that
// already live in the county data — towns, landmarks, designated areas — never a
// precise or sensitive species location. Each pin is numbered to match the
// story below it; tapping one opens a compact editorial card and offers a way
// to read the full story.

export type DiscoveryPoint = {
  slug: string
  index: number // 0-based position in the full story list
  title: string
  place: string
  summary: string
  season?: string
  sourceUrl: string
  publisher: string
  sourceChecked?: string
  lat: number
  lng: number
}

function pinIcon(n: number, active: boolean) {
  return L.divIcon({
    className: 'bv-dmap-pin-wrap',
    html: `<span class="bv-dmap-pin${active ? ' is-active' : ''}">${n}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

function FitToPoints({ points }: { points: DiscoveryPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11)
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 })
  }, [map, points])
  return null
}

export default function DiscoveryMapInner({
  points,
  countyName,
}: {
  points: DiscoveryPoint[]
  countyName: string
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const center = useMemo<[number, number]>(() => {
    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length
    const lng = points.reduce((s, p) => s + p.lng, 0) / points.length
    return [lat, lng]
  }, [points])

  const open = points.find((p) => p.slug === openSlug) ?? null

  function goToStory(slug: string) {
    setOpenSlug(null)
    const el = document.getElementById(slug)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bv-discovery-flash')
      window.setTimeout(() => el.classList.remove('bv-discovery-flash'), 1600)
    }
  }

  return (
    <div className="bv-dmap">
      <div className="bv-dmap-frame">
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <FitToPoints points={points} />
        {points.map((p) => (
          <Marker
            key={p.slug}
            position={[p.lat, p.lng]}
            icon={pinIcon(p.index + 1, p.slug === openSlug)}
            keyboard
            title={`${p.index + 1}. ${p.title}`}
            eventHandlers={{ click: () => setOpenSlug(p.slug) }}
          />
        ))}
        <AttributionControl prefix={false} />
      </MapContainer>

      {open && (
        <aside className="bv-dmap-card" aria-live="polite">
          <button type="button" className="bv-dmap-close" aria-label="Close" onClick={() => setOpenSlug(null)}>
            ×
          </button>
          <p className="bv-dmap-place">{open.place || countyName}</p>
          <h3>{open.title}</h3>
          <p className="bv-dmap-summary">{open.summary}</p>
          {open.season && (
            <p className="bv-dmap-season">
              <strong>When to look</strong> {open.season}
            </p>
          )}
          <button type="button" className="bv-dmap-jump" onClick={() => goToStory(open.slug)}>
            Read the full story ↓
          </button>
        </aside>
      )}
      </div>

      <p className="bv-dmap-note">
        Approximate public localities in {countyName}, numbered to match the stories below. Sensitive or
        precise wildlife locations are never shown. Tiles © Esri.
      </p>
    </div>
  )
}
