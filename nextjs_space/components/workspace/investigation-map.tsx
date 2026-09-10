'use client'

import dynamic from 'next/dynamic'
import type { MapLayers, MapPoint } from './investigation-map-inner'

const InvestigationMapInner = dynamic(() => import('./investigation-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-secondary/30">
      <span className="text-xs text-muted-foreground">Loading map...</span>
    </div>
  ),
})

export type { MapLayers, MapPoint }

export function InvestigationMap({
  lat,
  lng,
  zoom,
  name,
  layers,
  bufferMeters,
  species,
  planning,
  selectedId,
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
  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-border/60">
      <InvestigationMapInner
        lat={lat}
        lng={lng}
        zoom={zoom}
        name={name}
        layers={layers}
        bufferMeters={bufferMeters}
        species={species}
        planning={planning}
        selectedId={selectedId}
        onSelectRecord={onSelectRecord}
      />
    </div>
  )
}
