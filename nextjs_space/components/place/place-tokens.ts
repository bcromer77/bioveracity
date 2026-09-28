// Place Experience design tokens (PR D). Nature before interface: warm white
// ground, botanical green for structure and text, restrained gold for rules,
// and living fuchsia as a small accent only (the Place mark and focus). The
// interface itself is never fuchsia.

import type { CSSProperties } from 'react'

export const PLACE_COLOURS = {
  warmWhite: '#FBF8F1',
  paper: '#FFFFFF',
  ink: '#1C2A22',
  muted: '#4A5B51',
  green: '#1E5B3F',
  greenDeep: '#143F2C',
  greenSoft: '#E7EFE8',
  gold: '#B08A3E',
  goldText: '#7A5B17',
  fuchsia: '#B0246A',
  fuchsiaSoft: '#F7E6EF',
  line: '#E4DED0',
} as const

export const PLACE_FONTS = {
  editorial: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  body: 'var(--font-sans), system-ui, sans-serif',
} as const

/** CSS custom properties applied once on the shell root. */
export const placeTokenStyle: CSSProperties = {
  ['--pl-warm' as string]: PLACE_COLOURS.warmWhite,
  ['--pl-paper' as string]: PLACE_COLOURS.paper,
  ['--pl-ink' as string]: PLACE_COLOURS.ink,
  ['--pl-muted' as string]: PLACE_COLOURS.muted,
  ['--pl-green' as string]: PLACE_COLOURS.green,
  ['--pl-green-deep' as string]: PLACE_COLOURS.greenDeep,
  ['--pl-green-soft' as string]: PLACE_COLOURS.greenSoft,
  ['--pl-gold' as string]: PLACE_COLOURS.gold,
  ['--pl-gold-text' as string]: PLACE_COLOURS.goldText,
  ['--pl-fuchsia' as string]: PLACE_COLOURS.fuchsia,
  ['--pl-fuchsia-soft' as string]: PLACE_COLOURS.fuchsiaSoft,
  ['--pl-line' as string]: PLACE_COLOURS.line,
  ['--pl-editorial' as string]: PLACE_FONTS.editorial,
  backgroundColor: PLACE_COLOURS.warmWhite,
  color: PLACE_COLOURS.ink,
}
