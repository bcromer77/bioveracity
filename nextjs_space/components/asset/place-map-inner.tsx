'use client'

import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix Leaflet's default marker icon paths (they break under bundlers).
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

export default function PlaceMapInner({
  lat,
  lng,
  name,
  type,
  indicative = false,
}: {
  lat: number
  lng: number
  name: string
  type?: string | null
  // When true (e.g. rivers / linear water bodies) we show a soft area rather than
  // a precise pin, because the point is only indicative of the course.
  indicative?: boolean
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={indicative ? 11 : 12}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      {/* Esri light-grey basemap + place labels. Keyless and reliable from
          server environments (OpenStreetMap and CARTO block/require-key here). */}
      <TileLayer
        attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      {indicative ? (
        // Soft, dashed area — deliberately NOT a precise pin, to signal that the
        // location is indicative of a linear water body's course, not an asserted point.
        <CircleMarker
          center={[lat, lng]}
          radius={26}
          pathOptions={{ color: '#e0a53a', fillColor: '#e0a53a', fillOpacity: 0.14, weight: 1.5, dashArray: '4 4' }}
        >
          <Popup>
            <div style={{ fontSize: '12px' }}>
              <strong>{name}</strong>
              <div style={{ color: '#666' }}>Indicative location — linear water body</div>
            </div>
          </Popup>
        </CircleMarker>
      ) : (
        <>
          <CircleMarker center={[lat, lng]} radius={18} pathOptions={{ color: '#e0a53a', fillColor: '#e0a53a', fillOpacity: 0.12, weight: 1 }} />
          <Marker position={[lat, lng]} icon={markerIcon}>
            <Popup>
              <div style={{ fontSize: '12px' }}>
                <strong>{name}</strong>
                {type ? <div style={{ color: '#666', textTransform: 'capitalize' }}>{type}</div> : null}
              </div>
            </Popup>
          </Marker>
        </>
      )}
    </MapContainer>
  )
}
