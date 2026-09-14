'use client'

import { MapContainer, TileLayer, Polygon, Tooltip, CircleMarker, Circle, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Cell } from '@/lib/honeycomb/geometry'
import type { HoneycombHit } from './honeycomb-panel'

export default function HoneycombMapInner({
  cells,
  selected,
  onToggle,
  hits
}: {
  cells: Cell[]
  selected: string[]
  onToggle: (id: string) => void
  hits: HoneycombHit[]
}) {
  const bounds = cells.flatMap((cell) => cell.ring.map((point) => [point.lat, point.lng] as [number, number]))
  return (
    <MapContainer
      bounds={bounds}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      {cells.map((cell, index) => (
        <Polygon
          key={cell.id}
          positions={cell.ring.map((point) => [point.lat, point.lng])}
          pathOptions={{
            color: selected.includes(cell.id) ? '#9c761f' : '#2f6f4f',
            weight: selected.includes(cell.id) ? 3 : 1,
            fillColor: '#2f6f4f',
            fillOpacity: selected.includes(cell.id) ? 0.3 : 0.06
          }}
          eventHandlers={{ click: () => onToggle(cell.id) }}
        >
          <Tooltip>
            Cell {index + 1}
            {selected.includes(cell.id) ? ' — selected' : ''}
          </Tooltip>
        </Polygon>
      ))}
      {hits
        .filter(
          (hit) =>
            hit.kind === 'species' && hit.location && hit.precisionMeters != null && hit.precisionMeters > 0
        )
        .map((hit) => (
          <Circle
            key={`uncertainty-${hit.id}`}
            center={[hit.location!.lat, hit.location!.lng]}
            radius={hit.precisionMeters!}
            pathOptions={{ color: '#2f6f4f', weight: 1, dashArray: '4 4', fillOpacity: 0.04 }}
          >
            <Tooltip>
              Source-reported coordinate uncertainty: {hit.precisionMeters} m. Not a guaranteed boundary of
              presence.
            </Tooltip>
          </Circle>
        ))}
      {hits
        .filter((hit) => hit.location)
        .map((hit) => (
          <CircleMarker
            key={hit.id}
            center={[hit.location!.lat, hit.location!.lng]}
            radius={5}
            pathOptions={{ color: hit.kind === 'species' ? '#2f6f4f' : '#9c761f', fillOpacity: 0.85 }}
          >
            <Popup>
              <strong>{hit.title}</strong>
              <p>Reported source point; not evidence of presence throughout this cell.</p>
            </Popup>
          </CircleMarker>
        ))}
    </MapContainer>
  )
}
