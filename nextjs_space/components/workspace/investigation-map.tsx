'use client'

import dynamic from 'next/dynamic'
import type { MapLayers } from './investigation-map-inner'

const InvestigationMapInner = dynamic(() => import('./investigation-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-secondary/30">
      <span className="text-xs text-muted-foreground">Loading map...</span>
    </div>
  ),
})

export type { MapLayers }

export function InvestigationMap({
  lat,
  lng,
  zoom,
  name,
  layers,
  bufferMeters,
}: {
  lat: number
  lng: number
  zoom: number
  name: string
  layers: MapLayers
  bufferMeters?: number
}) {
  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-border/60">
      <InvestigationMapInner lat={lat} lng={lng} zoom={zoom} name={name} layers={layers} bufferMeters={bufferMeters} />
    </div>
  )
}
