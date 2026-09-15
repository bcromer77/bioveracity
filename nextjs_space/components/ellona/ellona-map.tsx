'use client'

import dynamic from 'next/dynamic'
import type { MapPoint } from './ellona-map-inner'

const Inner = dynamic(() => import('./ellona-map-inner'), {
  ssr: false,
  loading: () => <div className="bv-ellona-map-loading">Loading map…</div>,
})

export function EllonaMap({ points }: { points: MapPoint[] }) {
  return (
    <div className="bv-ellona-map">
      {points.length === 0 ? (
        <div className="bv-ellona-map-loading">No mappable opportunities in the current view.</div>
      ) : (
        <Inner points={points} />
      )}
    </div>
  )
}
