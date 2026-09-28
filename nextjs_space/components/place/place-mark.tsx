// BioVeracityPlaceMark (Place Experience PR D): the single, reusable Place
// mark. Geometry is the six-petal shape of the approved Place Experience
// reference: six identical rounded teardrop petals, tips toward an open centre,
// one petal on the vertical axis, rotated at 60° steps. Canonical colour is
// fuchsia; white and green exist only for contrast and never alter geometry.
// This file is the ONLY place the petal geometry is defined.

import { PLACE_COLOURS } from './place-tokens'

/**
 * One petal pointing up, in a 100×100 box centred on (50, 50). Straight sides run
 * parallel to the 60° sector edges, so neighbouring petals are separated by the
 * same thin, constant-width gap seen in the reference, meeting at a small open centre.
 */
export const PLACE_MARK_PETAL_PATH = 'M50 47 L37.59 25.5 A14.33 14.33 0 1 1 62.41 25.5 Z'
export const PLACE_MARK_PETAL_ANGLES = [0, 60, 120, 180, 240, 300] as const
export const PLACE_MARK_VERSION = 'six-petal-v1'

export const PLACE_MARK_TONES = {
  fuchsia: PLACE_COLOURS.fuchsia,
  green: PLACE_COLOURS.green,
  white: '#FFFFFF',
} as const
export type PlaceMarkTone = keyof typeof PLACE_MARK_TONES

export type BioVeracityPlaceMarkProps = {
  /** Canonical fuchsia unless the surface needs white or green for contrast. */
  tone?: PlaceMarkTone
  /** Rendered width and height in CSS pixels. */
  size?: number
  /** Accessible name. Omit when the mark is decorative beside visible text. */
  title?: string
  className?: string
}

export function BioVeracityPlaceMark({ tone = 'fuchsia', size = 32, title, className }: BioVeracityPlaceMarkProps) {
  const fill = PLACE_MARK_TONES[tone] ?? PLACE_MARK_TONES.fuchsia
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const, focusable: 'false' as const }
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      data-bv-place-mark={PLACE_MARK_VERSION}
      data-tone={tone}
      {...a11y}
    >
      {title ? <title>{title}</title> : null}
      <g fill={fill}>
        {PLACE_MARK_PETAL_ANGLES.map((angle) => (
          <path key={angle} d={PLACE_MARK_PETAL_PATH} transform={angle ? `rotate(${angle} 50 50)` : undefined} />
        ))}
      </g>
    </svg>
  )
}
