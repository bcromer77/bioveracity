'use client'

// UK & Ireland opportunity map for the Ellona watch. Multiple markers, styled by
// the visible PRECISION of each record (brief §7): an exact coordinate gets a
// pin; anything less precise (approximate / area / regional / national) gets a
// soft circle so we never imply a precision the source does not support. Every
// popover shows title, classification, buyer, supported location, nearest
// deadline and one action, and links to the full record.

import { AttributionControl, MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import Link from 'next/link'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

export type MapPoint = {
  id: string
  lat: number
  lng: number
  title: string
  classification: string
  buyer: string
  location: string
  precision: string
  deadline: string | null
  nextAction: string
}

function precisionLabel(p: string): string {
  const map: Record<string, string> = {
    exact: 'Exact coordinate',
    approximate: 'Approximate location',
    area: 'Area / catchment (indicative)',
    regional: 'Regional (indicative)',
    national: 'National scope',
  }
  return map[p] || 'Indicative location'
}

export default function EllonaMapInner({ points }: { points: MapPoint[] }) {
  return (
    <MapContainer
      attributionControl={false}
      center={[53.6, -4.2]}
      zoom={5}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='Tiles &copy; <a href="/attribution">Esri</a>'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      {points.map((p) => {
        const popup = (
          <Popup>
            <div style={{ fontSize: '12px', maxWidth: 220 }}>
              <strong>{p.title}</strong>
              <div style={{ color: '#173d35', fontWeight: 700, marginTop: 4 }}>{p.classification}</div>
              <div style={{ color: '#555', marginTop: 2 }}>{p.buyer}</div>
              <div style={{ marginTop: 6 }}>{p.location}</div>
              <div style={{ color: '#8a6d1f', marginTop: 2 }}>{precisionLabel(p.precision)}</div>
              {p.deadline ? <div style={{ marginTop: 6 }}>Deadline: {p.deadline}</div> : null}
              <div style={{ marginTop: 6, color: '#333' }}>{p.nextAction}</div>
              <Link href={`/ellona/opportunity/${p.id}`} style={{ display: 'inline-block', marginTop: 8, fontWeight: 700 }}>
                Open full record →
              </Link>
            </div>
          </Popup>
        )
        if (p.precision === 'exact') {
          return (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={markerIcon}>
              {popup}
            </Marker>
          )
        }
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={16}
            pathOptions={{ color: '#e0a53a', fillColor: '#e0a53a', fillOpacity: 0.16, weight: 1.5, dashArray: '4 4' }}
          >
            {popup}
          </CircleMarker>
        )
      })}
      <AttributionControl prefix={false} />
    </MapContainer>
  )
}
