'use client'
import { useRef, useState } from 'react'
import { Panorama } from './panorama'
import type { PanoramaPoint } from '@/lib/wild-hubs/photos'

// The five restrained prompts a point may carry. These are invitations to
// notice, never claims about what is present. Kept in sync with PANORAMA_POINTS
// in lib/wild-hubs/photos.ts; declared here as the client-safe source of the
// selectable kinds so this component never imports the Node-only photo pipeline.
const PROMPT: Record<PanoramaPoint['kind'], string> = {
  'look-closer': 'Look closer',
  listen: 'Listen',
  'whats-living': "What's living here?",
  'after-dark': 'What changes after dark?',
  'seen-something': 'Seen something?',
}

const round = (n: number) => Math.round(n * 10) / 10

// Owner control for a panorama's editorial points. It edits ONLY the points
// (the meta) of an existing WildHub photo — the image itself is untouched, so
// this is not a second media system. Click the view to place a point, refine
// its prompt and words, then save. The live preview is the exact visitor view.
export function PanoramaEditor({
  photoId,
  caption,
  credit,
  points,
  disabled,
  onSave,
}: {
  photoId: string
  caption: string
  credit: string
  points: PanoramaPoint[]
  disabled: boolean
  onSave: (points: PanoramaPoint[]) => Promise<void>
}) {
  const [draft, setDraft] = useState<PanoramaPoint[]>(points)
  const [saving, setSaving] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(points)

  function place(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled || draft.length >= 8) return
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = round(((e.clientX - rect.left) / rect.width) * 100)
    const y = round(((e.clientY - rect.top) / rect.height) * 100)
    setDraft([
      ...draft,
      { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)), kind: 'look-closer', label: '' },
    ])
  }

  function edit(i: number, patch: Partial<PanoramaPoint>) {
    setDraft(draft.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }

  return (
    <div className="bv-pano-editor">
      <p className="bv-small">
        Click the view to place a point where a guest might pause. Keep it
        restrained — a few quiet invitations to notice, never claims about what
        is present. Up to eight.
      </p>
      <div
        ref={frameRef}
        className={`bv-panorama-frame bv-pano-canvas${disabled || draft.length >= 8 ? ' is-locked' : ''}`}
        onClick={place}
        role="presentation"
      >
        <img src={`/api/wild/photos/${photoId}`} alt={caption || 'A view of the place'} />
        {draft.map((p, i) => (
          <span
            key={i}
            className="bv-panorama-point is-open"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-hidden="true"
          >
            <span className="bv-panorama-dot" />
          </span>
        ))}
      </div>
      {draft.length === 0 && (
        <p className="bv-small">No points yet. Click the view above to add one.</p>
      )}
      <ul className="bv-pano-points">
        {draft.map((p, i) => (
          <li key={i} className="bv-pano-point-row">
            <span className="bv-pano-index" aria-hidden="true">{i + 1}</span>
            <div className="bv-pano-fields">
              <label>
                Prompt
                <select
                  value={p.kind}
                  disabled={disabled}
                  onChange={(e) => edit(i, { kind: e.target.value as PanoramaPoint['kind'] })}
                >
                  {(Object.keys(PROMPT) as PanoramaPoint['kind'][]).map((k) => (
                    <option key={k} value={k}>{PROMPT[k]}</option>
                  ))}
                </select>
              </label>
              <label>
                A few words (optional)
                <input
                  value={p.label}
                  maxLength={120}
                  disabled={disabled}
                  placeholder="e.g. the old alder leaning over the water"
                  onChange={(e) => edit(i, { label: e.target.value })}
                />
              </label>
            </div>
            <button
              type="button"
              className="bv-text-link"
              disabled={disabled}
              onClick={() => setDraft(draft.filter((_, idx) => idx !== i))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="bv-actions">
        <button
          type="button"
          className="bv-button bv-green"
          disabled={disabled || saving || !dirty}
          onClick={async () => {
            setSaving(true)
            try {
              await onSave(draft)
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? 'Saving points…' : 'Save editorial points'}
        </button>
        {dirty && (
          <button type="button" className="bv-text-link" disabled={saving} onClick={() => setDraft(points)}>
            Discard point changes
          </button>
        )}
      </div>
      <p className="bv-eyebrow">How guests will see it</p>
      <Panorama photoId={photoId} caption={caption} credit={credit} points={draft} />
    </div>
  )
}
