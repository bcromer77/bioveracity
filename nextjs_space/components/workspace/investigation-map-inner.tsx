'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap } from 'react-leaflet'
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

// `buffer` is a genuine geometric search buffer in metres (see bufferMeters),
// NOT a surveyed boundary. `species` and `planning` toggle the display of REAL
// retrieved public records (bat occurrences from GBIF, planning applications
// from the national ArcGIS layer); each layer is only enabled by the parent
// after its retrieval actually succeeds.
export type MapLayers = { buffer: boolean; species: boolean; planning: boolean }

// The plottable subset of a retrieved public record.
export type MapPoint = {
  id: string
  kind: 'species' | 'planning'
  title: string
  subtitle: string
  lat: number
  lng: number
  precisionMeters: number | null
  generalised: boolean
  eventDate: string | null
  datePrecision?: string
  status: string | null
  detail: string | null
  sourceUrl: string
}

const SPECIES_COLOR = '#2f6f4f'
const PLANNING_COLOR = '#b7791f'
const SELECTED_COLOR = '#b91c1c'

// Recenters the map whenever the resolved location changes (e.g. after a search).
function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.6 })
  }, [lat, lng, zoom, map])
  return null
}

// Pans to a record when it is selected from a card (cross-highlight), without
// changing the zoom the user set.
function FocusSelected({ point }: { point: MapPoint | null }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.panTo([point.lat, point.lng], { animate: true })
  }, [point, map])
  return null
}

function dateLabel(point: MapPoint): string {
  if (!point.eventDate) return 'date unknown'
  return point.eventDate
}

function RecordMarker({ point, selected, onSelect }: { point: MapPoint; selected: boolean; onSelect?: (id: string) => void }) {
  const base = point.kind === 'species' ? SPECIES_COLOR : PLANNING_COLOR
  const color = selected ? SELECTED_COLOR : base
  const radius = selected ? 10 : 6
  return (
    <>
      {/* A generalised species record has no precise point: show its stated
          uncertainty area as a translucent circle rather than implying a
          pin-point location. */}
      {point.kind === 'species' && point.generalised && point.precisionMeters && (
        <Circle center={[point.lat, point.lng]} radius={point.precisionMeters}
          pathOptions={{ color: base, fillColor: base, fillOpacity: 0.05, weight: 1, dashArray: '4 4' }} />
      )}
      <CircleMarker
        center={[point.lat, point.lng]}
        radius={radius}
        pathOptions={{ color, fillColor: color, fillOpacity: selected ? 0.9 : 0.7, weight: selected ? 3 : 1.5 }}
        eventHandlers={{ click: () => onSelect?.(point.id) }}
      >
        <Popup>
          <div style={{ fontSize: '12px', maxWidth: '220px' }}>
            <strong>{point.title}</strong>
            <div style={{ color: '#555' }}>{point.subtitle}</div>
            {point.status && <div style={{ color: '#555' }}>{point.status}</div>}
            {point.detail && <div style={{ color: '#555', marginTop: '2px' }}>{point.detail}</div>}
            <div style={{ color: '#555', marginTop: '2px' }}>Date: {dateLabel(point)}</div>
            {point.kind === 'species' && (
              <div style={{ color: '#555' }}>{point.generalised ? 'Generalised location (area shown, not a precise point)' : point.precisionMeters ? `Location precision ±${point.precisionMeters} m` : 'Location precision not stated'}</div>
            )}
            <a href={point.sourceUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '4px', color: '#1d4ed8' }}>View source record</a>
          </div>
        </Popup>
      </CircleMarker>
    </>
  )
}

export default function InvestigationMapInner({
  lat,
  lng,
  zoom,
  name,
  layers,
  bufferMeters = 500,
  species = [],
  planning = [],
  selectedId = null,
  onSelectRecord,
}: {
  lat: number
  lng: number
  zoom: number
  name: string
  layers: MapLayers
  bufferMeters?: number
  species?: MapPoint[]
  planning?: MapPoint[]
  selectedId?: string | null
  onSelectRecord?: (id: string) => void
}) {
  const selectedPoint = selectedId ? [...species, ...planning].find(p => p.id === selectedId) ?? null : null
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
      <FocusSelected point={selectedPoint} />

      {/* Search buffer — a REAL circle of radius `bufferMeters` metres around the
          navigation centre. It is a search/proximity buffer for locating nearby
          evidence, NOT a surveyed red-line site boundary. */}
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

      {layers.species && species.map(point => (
        <RecordMarker key={point.id} point={point} selected={point.id === selectedId} onSelect={onSelectRecord} />
      ))}
      {layers.planning && planning.map(point => (
        <RecordMarker key={point.id} point={point} selected={point.id === selectedId} onSelect={onSelectRecord} />
      ))}

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
