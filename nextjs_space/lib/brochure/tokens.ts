// BioVeracity shared brochure design tokens ("house style").
// One source of truth for every business type. Colours, page geometry, the
// typographic scale, image proportions and status labels live here so no venue,
// uploaded file or business type can override the house style.
//
// Colours are taken from the live public brand (globals.css .bv-public):
// forest green, restrained brass gold and warm neutral backgrounds.

export const BROCHURE_TEMPLATE_VERSION = 'bv-brochure/1'

export type RGB = readonly [number, number, number]

const hex = (h: string): RGB => {
  const n = h.replace('#', '')
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  ] as const
}

export const COLORS = {
  forest: hex('#173d35'), // primary forest green
  forestDark: hex('#102d26'), // footer / deep panels
  forestMid: hex('#23483c'), // secondary panels
  gold: hex('#dfc27a'), // restrained brass gold (accents only)
  goldDeep: hex('#97702b'), // gold text on light
  brass: hex('#745a27'), // eyebrow / label text
  cream: hex('#f7f4ec'), // page background
  ivory: hex('#fbf9f0'), // card background
  tint: hex('#eeeddf'), // tinted band
  border: hex('#d3d7c5'), // hairline rules
  ink: hex('#17372f'), // body text
  muted: hex('#5b6b60'), // secondary text
  onDark: hex('#f7f4ec'), // text on forest
  onDarkMuted: hex('#c9d2c4'),
  error: hex('#9d2525'),
  white: hex('#ffffff'),
} as const

// A4 portrait in PostScript points.
export const PAGE = {
  w: 595.28,
  h: 841.89,
  margin: 48,
  get contentW() {
    return this.w - this.margin * 2
  },
} as const

// Typographic scale (points). Serif for display, sans for body/caption/source.
export const TYPE = {
  eyebrow: { size: 8.5, tracking: 1.6 },
  h1: { size: 30, leading: 33 },
  h2: { size: 19, leading: 23 },
  h3: { size: 13.5, leading: 17 },
  lede: { size: 12, leading: 17 },
  body: { size: 10.5, leading: 15 },
  caption: { size: 8.5, leading: 11.5 },
  source: { size: 8.5, leading: 12 },
  micro: { size: 7.5, leading: 10 },
} as const

// Image treatment. Editions preserve original photo proportions; the cover crop
// and focal point are chosen by the venue, never stretched.
export const IMAGE = {
  hero: { w: PAGE.contentW, h: 300 }, // page 1 establishing photo
  half: { w: (PAGE.contentW - 18) / 2, h: 190 },
  focalDefault: { x: 0.5, y: 0.5 }, // centre unless the venue sets a focal point
} as const

// Editorial length limits. Overflow is reported to the studio as an actionable
// error — text is never silently truncated, shrunk to an unreadable size, or
// allowed to overlap.
export const LIMITS = {
  headline: 90,
  landscapeConnection: 320,
  story: 1400,
  ecologyCardTitle: 70,
  ecologyCardBody: 340,
  ecologyCards: { min: 0, max: 5 },
  caption: 140,
  credit: 80,
  noticeItem: 220,
  visitorInfo: 600,
  sourceTitle: 160,
} as const

export const STATUS_LABELS = {
  DRAFT: 'DRAFT — NOT FOR PUBLIC RELEASE',
  IN_REVIEW: 'IN REVIEW — NOT YET APPROVED',
  APPROVED: 'Venue-approved edition',
  PUBLISHED: 'Venue-approved edition',
  REJECTED: 'RETURNED FOR CHANGES — NOT APPROVED',
} as const

export const FONT_FILES = {
  serif: 'DejaVuSerif.ttf',
  serifBold: 'DejaVuSerif-Bold.ttf',
  serifItalic: 'DejaVuSerif-Italic.ttf',
  sans: 'DejaVuSans.ttf',
  sansBold: 'DejaVuSans-Bold.ttf',
} as const
