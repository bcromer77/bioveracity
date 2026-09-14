// BioVeracity shared Edition data model + backwards-compatible validation.
//
// One versioned Edition drives BOTH the public venue page and the downloadable
// brochure for EVERY business type. The renderer only ever reads an Edition, so
// any business type that produces a valid Edition gets the same six-page output.
//
// Validation is additive and backwards compatible: unknown/extra fields are
// ignored, optional fields may be absent, and the validator NEVER silently
// truncates. Overflow and insufficient-material are reported as actionable
// messages that the studio/preview surfaces to the venue before publication.

import { LIMITS } from './tokens'

export const EDITION_SCHEMA_VERSION = 'bv-edition/1'

export type BusinessType =
  | 'pottery_craft'
  | 'hotel_guesthouse'
  | 'cafe_food'
  | 'visitor_attraction'

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  pottery_craft: 'Pottery & craft',
  hotel_guesthouse: 'Hotel & guesthouse',
  cafe_food: 'Café & food',
  visitor_attraction: 'Visitor attraction',
}

export type EditionStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'

export type Orientation = 'landscape' | 'portrait' | 'square'

/** Focal point in normalised image coordinates (0..1 from top-left). */
export interface FocalPoint {
  x: number
  y: number
}

export interface EditionPhoto {
  id: string
  /** Absolute path or URL to the (already optimised, scanned) image bytes. */
  src: string
  caption: string
  credit: string
  /** 1-based display order chosen by the venue. */
  sequence: number
  isCover?: boolean
  focal?: FocalPoint
  orientation?: Orientation
  /** The venue confirmed it holds or is licensed for the rights to publish. */
  rightsConfirmed: boolean
}

/**
 * A sourced ecology story. Common name is shown first; the scientific name is
 * italicised by the renderer. `scope` keeps wider-area evidence visually and
 * semantically distinct from anything observed at the venue itself.
 */
export interface EcologyCard {
  id: string
  commonName: string
  scientificName?: string
  body: string
  scope: 'wider-area' | 'at-venue'
  sourceIds: string[]
}

export interface SourceRecord {
  id: string
  title: string
  publisher?: string
  url?: string
  /** Page / section / dataset locator within the source. */
  locator?: string
  /** Geographic scope the record actually covers (e.g. "County Kilkenny"). */
  geographicScope: string
  /** ISO date the record was retrieved. */
  retrievedAt: string
}

export interface NoticeGuidance {
  notice: string[]
  wonder: string[]
  remember: string[]
}

export interface VisitorInfo {
  addressLines?: string[]
  openingInfo?: string
  /** Access + respectful-visiting guidance. */
  accessNotes?: string
  /** Official venue website (venue-owned, verified). */
  officialUrl: string
  /** Destination the printed QR opens. */
  qrTarget: string
  /**
   * True when qrTarget is the official venue URL used as a clearly-labelled
   * demo stand-in because no published venue page exists yet. A QR is never
   * printed to an unavailable draft page.
   */
  qrIsOfficialUrl?: boolean
}

export interface Edition {
  schemaVersion?: string
  // Identity
  venueName: string
  businessType: BusinessType
  headline: string
  // P1 arrival — why this place and its surroundings belong together
  landscapeConnection: string
  // P2 working life — venue-approved account of what is made / served / offered
  story: string
  workingLifeFacts?: string[]
  // Photographs (venue-owned)
  photos: EditionPhoto[]
  // P3 living system — 3..5 sourced ecology stories where evidence exists
  ecologyCards: EcologyCard[]
  // P4 look a little longer
  guidance: NoticeGuidance
  // P5 your visit
  visitor: VisitorInfo
  // P6 sources / credits
  sources: SourceRecord[]
  // Meta
  status: EditionStatus
  revision: number
  editionDate: string
  publicationInfo?: string
}

export type IssueSeverity = 'error' | 'warning'

export interface ValidationIssue {
  field: string
  message: string
  severity: IssueSeverity
}

export interface ValidationResult {
  ok: boolean // no errors (warnings are allowed)
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  issues: ValidationIssue[]
}

const len = (s: string | undefined) => (s ? s.trim().length : 0)

/**
 * Validate an Edition for preview and for publication.
 *
 * - `error` issues block publication (missing required content, overflow beyond
 *   the house-style limits, unconfirmed photo rights, structural problems).
 * - `warning` issues are the "insufficient material" advisories shown in the
 *   PRIVATE preview so the venue can add specific content; they never invent
 *   facts and never block a draft from being previewed.
 *
 * Nothing here truncates text — overflow is always surfaced as an actionable
 * message identifying the field and the limit.
 */
export function validateEdition(edition: Edition): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const err = (field: string, message: string) => errors.push({ field, message, severity: 'error' })
  const warn = (field: string, message: string) => warnings.push({ field, message, severity: 'warning' })

  const overflow = (field: string, value: string | undefined, limit: number, label: string) => {
    const n = len(value)
    if (n > limit) err(field, `${label} is ${n} characters; the house style allows up to ${limit}. Shorten it by ${n - limit} to keep the page readable — text is never shrunk or cut to fit.`)
  }

  // Identity
  if (!len(edition.venueName)) err('venueName', 'Add the venue name — it heads every page.')
  if (!BUSINESS_TYPE_LABELS[edition.businessType]) err('businessType', 'Choose a business type so the correct edition can be prepared.')
  if (!len(edition.headline)) err('headline', 'Add a specific headline for the arrival page (page 1).')
  overflow('headline', edition.headline, LIMITS.headline, 'The headline')

  // P1
  if (!len(edition.landscapeConnection)) err('landscapeConnection', 'Describe why this place and its surroundings belong together (page 1). This is written by the venue — nothing is invented for you.')
  overflow('landscapeConnection', edition.landscapeConnection, LIMITS.landscapeConnection, 'The place-and-surroundings text')

  // P2
  if (!len(edition.story)) err('story', 'Add your venue story for the working-life page (page 2).')
  overflow('story', edition.story, LIMITS.story, 'The venue story')

  // Photographs
  const photos = edition.photos ?? []
  if (photos.length === 0) {
    err('photos', 'Add at least one photograph. Page 1 needs one strong establishing image.')
  } else {
    const covers = photos.filter(p => p.isCover)
    if (covers.length === 0) err('photos.cover', 'Choose which photograph is the cover (the page 1 establishing image).')
    if (covers.length > 1) err('photos.cover', `Only one cover photograph is allowed; ${covers.length} are marked. Pick a single cover.`)
    const seqs = new Set<number>()
    photos.forEach((p, i) => {
      const where = `photos[${i}]${p.id ? ` (${p.id})` : ''}`
      if (!p.rightsConfirmed) err(`${where}.rights`, 'Confirm you hold or are licensed for the rights to publish this photograph before it can be included.')
      if (!len(p.caption)) warn(`${where}.caption`, 'Add a caption so visitors know what they are looking at.')
      overflow(`${where}.caption`, p.caption, LIMITS.caption, 'A photo caption')
      overflow(`${where}.credit`, p.credit, LIMITS.credit, 'A photo credit')
      if (typeof p.sequence === 'number') {
        if (seqs.has(p.sequence)) warn(`${where}.sequence`, 'Two photographs share the same position; set a distinct order.')
        seqs.add(p.sequence)
      }
    })
  }

  // P3 living system
  const cards = edition.ecologyCards ?? []
  if (cards.length > LIMITS.ecologyCards.max) err('ecologyCards', `The living-system page holds up to ${LIMITS.ecologyCards.max} ecology stories; ${cards.length} were supplied. Remove ${cards.length - LIMITS.ecologyCards.max}.`)
  if (cards.length < 3) warn('ecologyCards', `Only ${cards.length} sourced ecology ${cards.length === 1 ? 'story is' : 'stories are'} attached. Three to five give the fullest living-system page — add more only where you have a real source; nothing is invented to fill the page.`)
  cards.forEach((c, i) => {
    const where = `ecologyCards[${i}]${c.id ? ` (${c.id})` : ''}`
    if (!len(c.commonName)) err(`${where}.commonName`, 'Give the common name (shown first).')
    overflow(`${where}.commonName`, c.commonName, LIMITS.ecologyCardTitle, 'An ecology story title')
    if (!len(c.body)) err(`${where}.body`, 'Add the sourced ecology story text.')
    overflow(`${where}.body`, c.body, LIMITS.ecologyCardBody, 'An ecology story')
    if (!c.sourceIds || c.sourceIds.length === 0) err(`${where}.sources`, 'Every ecology story must cite at least one source record — no unsupported claims.')
    else {
      for (const sid of c.sourceIds) {
        if (!(edition.sources ?? []).some(s => s.id === sid)) err(`${where}.sources`, `Cited source "${sid}" is not in the source list. Add the record or fix the reference.`)
      }
    }
    if (c.scope !== 'wider-area' && c.scope !== 'at-venue') err(`${where}.scope`, 'Mark whether this story is wider-area evidence or observed at the venue, so the two stay distinct.')
  })

  // P4 guidance
  const g = edition.guidance ?? { notice: [], wonder: [], remember: [] }
  const guidanceCount = (g.notice?.length ?? 0) + (g.wonder?.length ?? 0) + (g.remember?.length ?? 0)
  if (guidanceCount === 0) warn('guidance', 'Add a few Notice / Wonder / Remember prompts so page 4 is useful even when no animal is seen.')
  ;[...(g.notice ?? []), ...(g.wonder ?? []), ...(g.remember ?? [])].forEach((item, i) => overflow(`guidance[${i}]`, item, LIMITS.noticeItem, 'A guidance prompt'))

  // P5 visit
  const v = edition.visitor
  if (!v || !len(v.officialUrl)) err('visitor.officialUrl', 'Add the official venue website.')
  if (v) {
    if (!len(v.qrTarget)) err('visitor.qrTarget', 'A QR destination is required. Use the published venue page, or the official venue URL clearly labelled as a stand-in — never a draft page that is not yet public.')
    overflow('visitor.accessNotes', v.accessNotes, LIMITS.visitorInfo, 'The visitor / access notes')
  }

  // P6 sources
  const sources = edition.sources ?? []
  if (cards.length > 0 && sources.length === 0) err('sources', 'The living-system stories cite sources, but no source records are listed. Add them so every claim is checkable.')
  sources.forEach((s, i) => {
    const where = `sources[${i}]${s.id ? ` (${s.id})` : ''}`
    if (!len(s.title)) err(`${where}.title`, 'A source needs a title.')
    overflow(`${where}.title`, s.title, LIMITS.sourceTitle, 'A source title')
    if (!len(s.geographicScope)) warn(`${where}.scope`, 'State the geographic scope this record covers, so readers know how local it is.')
    if (!len(s.retrievedAt)) warn(`${where}.retrievedAt`, 'Record the date this source was retrieved.')
  })

  const issues = [...errors, ...warnings]
  return { ok: errors.length === 0, errors, warnings, issues }
}
