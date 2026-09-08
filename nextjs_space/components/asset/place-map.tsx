'use client'

import dynamic from 'next/dynamic'
import { MapPin } from 'lucide-react'

const PlaceMapInner = dynamic(() => import('./place-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-secondary/30">
      <span className="text-xs text-muted-foreground">Loading map…</span>
    </div>
  ),
})

export function PlaceMap({
  lat,
  lng,
  name,
  type,
}: {
  lat: number | null | undefined
  lng: number | null | undefined
  name: string
  type?: string | null
}) {
  // Linear water bodies (rivers) carry only an indicative point on their course.
  const indicative = type === 'river'
  if (lat == null || lng == null) {
    return (
      <div className="flex h-[420px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-card text-center">
        <MapPin className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No verified coordinates recorded for this place yet.</p>
        <p className="max-w-sm text-xs text-muted-foreground/80">
          Location is an evidence gap here — we don’t place a marker where the record does not support one.
        </p>
      </div>
    )
  }
  return (
    <div className="h-[420px] w-full overflow-hidden rounded-xl border border-border/60">
      <PlaceMapInner lat={lat} lng={lng} name={name} type={type} indicative={indicative} />
    </div>
  )
}
