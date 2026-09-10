'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
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

// water/species are agency-feed layers that require real retrieved features to
// draw; until such features exist for a location they stay disabled in the UI
// and this map draws nothing for them. `buffer` is a genuine geometric search
// buffer measured in metres (see bufferMeters), NOT a surveyed boundary.
export type MapLayers = { water: boolean; species: boolean; buffer: boolean }

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
  bufferMeters = 500,
}: {
  lat: number
  lng: number
  zoom: number
  name: string
  layers: MapLayers
  bufferMeters?: number
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

      {/* Search buffer — a REAL circle of radius `bufferMeters` metres around the
          navigation centre. Leaflet's Circle takes its radius in metres, so this
          scales correctly at every zoom level (unlike a fixed-pixel marker). It
          is a search/proximity buffer for locating nearby evidence, NOT a
          surveyed red-line site boundary. */}
      {layers.buffer && (
        <Circle
          center={[lat, lng]}
          radius={bufferMeters}
          pathOptions={{ color: '#2f6f4f', fillColor: '#2f6f4f', fillOpacity: 0.06, weight: 1.5, dashArray: '5 5' }}
        >
          <Popup>
            <div style={{ fontSize: '12px' }}>
              <strong>Search buffer — {bufferMeters} m radius</strong>
              <div style={{ color: '#666' }}>A proximity buffer for locating nearby evidence. This is not a surveyed site boundary or red-line.</div>
            </div>
          </Popup>
        </Circle>
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
