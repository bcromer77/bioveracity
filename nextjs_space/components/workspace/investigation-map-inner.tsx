'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet'
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

export type MapLayers = { water: boolean; species: boolean; boundary: boolean }

// Recenters the map whenever the resolved location changes (e.g. after a search).
function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.6 })
  }, [lat, lng, zoom, map])
  return null
}

export default function InvestigationMapInner({
  lat,
  lng,
  zoom,
  name,
  layers,
}: {
  lat: number
  lng: number
  zoom: number
  name: string
  layers: MapLayers
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      {/* Esri light-grey basemap + labels. Keyless and reliable from server
          environments (OpenStreetMap and CARTO block/require-key here). */}
      <TileLayer
        attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <Recenter lat={lat} lng={lng} zoom={zoom} />

      {/* Site boundary lens — an indicative area around the location, not a
          surveyed red-line boundary. */}
      {layers.boundary && (
        <CircleMarker
          center={[lat, lng]}
          radius={70}
          pathOptions={{ color: '#2f6f4f', fillColor: '#2f6f4f', fillOpacity: 0.08, weight: 1.5, dashArray: '5 5' }}
        >
          <Popup>
            <div style={{ fontSize: '12px' }}>
              <strong>Indicative site boundary</strong>
              <div style={{ color: '#666' }}>Illustrative extent — not a surveyed red-line.</div>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {/* Water lens — an indicative buffer near the location. Water-quality status
          is never auto-filled; this is a navigation lens only. */}
      {layers.water && (
        <CircleMarker
          center={[lat, lng]}
          radius={38}
          pathOptions={{ color: '#2b6cb0', fillColor: '#2b6cb0', fillOpacity: 0.12, weight: 1.5 }}
        >
          <Popup>
            <div style={{ fontSize: '12px' }}>
              <strong>Water lens</strong>
              <div style={{ color: '#666' }}>EPA WFD status is not auto-filled — add it from a reviewed source.</div>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {/* Species lens — indicative search radius. Live occurrences load only for
          wired counties; here we mark the search area rather than assert records. */}
      {layers.species && (
        <CircleMarker
          center={[lat, lng]}
          radius={20}
          pathOptions={{ color: '#b7791f', fillColor: '#b7791f', fillOpacity: 0.14, weight: 1.5 }}
        >
          <Popup>
            <div style={{ fontSize: '12px' }}>
              <strong>Species search area</strong>
              <div style={{ color: '#666' }}>Indicative 500m radius — confirm any record against its source.</div>
            </div>
          </Popup>
        </CircleMarker>
      )}

      <Marker position={[lat, lng]} icon={markerIcon}>
        <Popup>
          <div style={{ fontSize: '12px' }}>
            <strong>{name}</strong>
            <div style={{ color: '#666' }}>Approximate centre for navigation.</div>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  )
}
