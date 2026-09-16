'use client'

import dynamic from 'next/dynamic'
import type { MapPoint } from './ellona-map-inner'

const Inner = dynamic(() => import('./ellona-map-inner'), {
  ssr: false,
  loading: () => <div className="bv-ellona-map-loading">Loading map…</div>,
})

export function EllonaMap({ points, matchingCount }: { points: MapPoint[]; matchingCount?: number }) {
  const emptyMessage =
    matchingCount && matchingCount > 0
      ? `${matchingCount} matching ${matchingCount === 1 ? 'opportunity is' : 'opportunities are'} listed below — none in the current selection have a precise map location to plot here.`
      : 'No mappable opportunities in the current view.'
  return (
    <div className="bv-ellona-map">
      {points.length === 0 ? (
        <div className="bv-ellona-map-loading">{emptyMessage}</div>
      ) : (
        <Inner points={points} />
      )}
    </div>
  )
}
