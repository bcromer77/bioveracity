'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, ChevronDown } from 'lucide-react'
import type { MapPoint, MapConnection } from './regional-map-inner'

const RegionalMapInner = dynamic(() => import('./regional-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-secondary/30">
      <span className="text-xs text-muted-foreground">Loading map…</span>
    </div>
  ),
})

const KEY_ITEMS: { label: string; render: () => React.ReactNode }[] = [
  {
    label: 'Wastewater',
    render: () => <span className="inline-block h-3 w-3 rounded-full bg-slate-600" />,
  },
  {
    label: 'Water body',
    render: () => <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-600" />,
  },
  {
    label: 'Industrial',
    render: () => <span className="inline-block h-3 w-3 rounded-[2px] bg-slate-600" />,
  },
  {
    label: 'Divergence',
    render: () => <span className="inline-block h-3 w-3 rounded-full bg-red-600" />,
  },
  {
    label: 'Verified',
    render: () => <span className="inline-block h-3 w-3 rounded-full bg-green-600" />,
  },
  {
    label: 'Selected',
    render: () => <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#E9AD20' }} />,
  },
]

export function RegionalMap({
  points,
  connections = [],
  activeCategory = 'all',
}: {
  points: MapPoint[]
  connections?: MapConnection[]
  activeCategory?: string
}) {
  const [keyOpen, setKeyOpen] = useState(false)

  if (!points.length) {
    return (
      <div className="flex h-[440px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card text-center">
        <MapPin className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No mapped coordinates are recorded for these places yet.</p>
      </div>
    )
  }

  return (
    <div className="relative h-[500px] w-full overflow-hidden rounded-lg border border-border md:h-[520px]">
      <RegionalMapInner points={points} connections={connections} activeCategory={activeCategory} />

      {/* Compact map key (disclosure) */}
      <div className="absolute bottom-3 left-3 z-[500]">
        <button
          onClick={() => setKeyOpen((v) => !v)}
          className="flex items-center gap-1 rounded-md border border-border bg-white/95 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur hover:bg-white"
        >
          Map key
          <ChevronDown className={`h-3 w-3 transition-transform ${keyOpen ? 'rotate-180' : ''}`} />
        </button>
        {keyOpen && (
          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-border bg-white/97 p-3 text-[11px] text-foreground shadow-md backdrop-blur">
            {KEY_ITEMS.map((k) => (
              <span key={k.label} className="flex items-center gap-2">
                {k.render()}
                <span>{k.label}</span>
              </span>
            ))}
            <span className="col-span-2 mt-0.5 flex items-center gap-2 text-muted-foreground">
              <span className="inline-block h-0 w-4 border-t-2 border-dashed border-slate-500" />
              Source-backed connection
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
