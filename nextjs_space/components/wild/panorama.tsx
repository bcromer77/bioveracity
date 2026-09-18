'use client'
import { useState } from 'react'
import type { PanoramaPoint } from '@/lib/wild-hubs/photos'

// A panorama is an ordinary WildHub photo (kind='panorama') with a small set of
// editorial points stored in its meta. It is NOT a second media system: the
// image is served by the same /api/wild/photos/{id} endpoint and degrades to a
// plain, elegant photograph if JavaScript never runs or there are no points.

const PROMPT: Record<PanoramaPoint['kind'], string> = {
  'look-closer': 'Look closer',
  listen: 'Listen',
  'whats-living': "What's living here?",
  'after-dark': 'What changes after dark?',
  'seen-something': 'Seen something?',
}

export function Panorama({
  photoId,
  caption,
  credit,
  points,
}: {
  photoId: string
  caption: string
  credit: string
  points: PanoramaPoint[]
}) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <figure className="bv-panorama">
      <div className="bv-panorama-frame">
        <img
          src={`/api/wild/photos/${photoId}`}
          alt={caption || 'A view of the place'}
          loading="lazy"
        />
        {points.map((p, i) => (
          <button
            key={i}
            type="button"
            className={`bv-panorama-point${open === i ? ' is-open' : ''}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-label={p.label || PROMPT[p.kind]}
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="bv-panorama-dot" aria-hidden="true" />
            <span className="bv-panorama-label">
              <strong>{PROMPT[p.kind]}</strong>
              {p.label ? <span>{p.label}</span> : null}
            </span>
          </button>
        ))}
      </div>
      {(caption || credit) && (
        <figcaption>
          {caption}
          {caption && credit ? ' · ' : ''}
          {credit}
        </figcaption>
      )}
    </figure>
  )
}
