// BioVeracity shared brochure renderer.
//
// ONE renderer, ONE house style, SIX pages — for every business type. It only
// reads an `Edition` (see edition.ts), so a pottery, a hotel, a café and a
// visitor attraction all flow through exactly this code and come out visually
// identical in structure. Pure pdf-lib (no headless browser) so it runs in the
// standalone production runtime.
//
// Consistency guarantees baked in here:
//  - fonts embedded once, subsetted (serif display, sans body, italic sci-names)
//  - forest-green / restrained-gold / neutral tokens are the only colours used
//  - photos keep their real proportions (cover-crop with focal point, or
//    letterboxed contain) — never stretched
//  - venue statements, wider-area evidence and editorial guidance are visually
//    distinct
//  - a DRAFT / IN REVIEW / RETURNED status banner is stamped on drafts
//  - overflow is prevented upstream by validateEdition(); this renderer wraps on
//    word boundaries and never overlaps.

import {
  PDFDocument,
  rgb,
  PDFName,
  PDFString,
  PDFArray,
  pushGraphicsState,
  popGraphicsState,
  moveTo,
  lineTo,
  closePath,
  clip,
  endPath,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type Color,
} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'node:fs'
import path from 'node:path'
import {
  BROCHURE_TEMPLATE_VERSION,
  COLORS,
  PAGE,
  TYPE,
  FONT_FILES,
  STATUS_LABELS,
  type RGB,
} from './tokens'
import {
  BUSINESS_TYPE_LABELS,
  EDITION_SCHEMA_VERSION,
  type Edition,
  type EditionPhoto,
  type SourceRecord,
} from './edition'

export const BROCHURE_RENDERER_VERSION = 'bv-brochure-renderer/1'

const col = (c: RGB): Color => rgb(c[0], c[1], c[2])

type Fonts = {
  serif: PDFFont
  serifBold: PDFFont
  serifItalic: PDFFont
  sans: PDFFont
  sansBold: PDFFont
}

export interface RenderResult {
  bytes: Buffer
  pageCount: number
  byteLength: number
}

/** Resolve image bytes from an absolute path or a file:// URL. Missing images
 *  degrade to a tinted placeholder box rather than throwing. */
function readImageBytes(src: string): Buffer | null {
  try {
    const p = src.startsWith('file://') ? src.slice(7) : src
    if (p.startsWith('/') && fs.existsSync(p)) return fs.readFileSync(p)
    return null
  } catch {
    return null
  }
}

export async function renderEdition(edition: Edition): Promise<RenderResult> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const dir = path.join(process.cwd(), 'public', 'fonts')
  const embed = (f: string) => pdf.embedFont(fs.readFileSync(path.join(dir, f)), { subset: true })
  const fonts: Fonts = {
    serif: await embed(FONT_FILES.serif),
    serifBold: await embed(FONT_FILES.serifBold),
    serifItalic: await embed(FONT_FILES.serifItalic),
    sans: await embed(FONT_FILES.sans),
    sansBold: await embed(FONT_FILES.sansBold),
  }

  pdf.setTitle(`${edition.venueName} — BioVeracity visitor brochure`)
  pdf.setProducer(`BioVeracity ${BROCHURE_RENDERER_VERSION} (${BROCHURE_TEMPLATE_VERSION})`)
  pdf.setCreator('BioVeracity')
  const created = new Date(edition.editionDate || Date.now())
  pdf.setCreationDate(created)
  pdf.setModificationDate(created)

  // Cache embedded images so a reused photo is embedded once.
  const imageCache = new Map<string, PDFImage | null>()
  const getImage = async (src: string): Promise<PDFImage | null> => {
    if (imageCache.has(src)) return imageCache.get(src)!
    const bytes = readImageBytes(src)
    let img: PDFImage | null = null
    if (bytes) {
      try {
        img = /\.png$/i.test(src) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
      } catch {
        img = null
      }
    }
    imageCache.set(src, img)
    return img
  }

  const safe = (s: string, f: PDFFont) =>
    Array.from(s ?? '')
      .map(ch => {
        try {
          f.encodeText(ch)
          return ch
        } catch {
          return `[U+${ch.codePointAt(0)!.toString(16).toUpperCase()}]`
        }
      })
      .join('')

  const wrap = (text: string, size: number, f: PDFFont, maxW: number): string[] => {
    const clean = safe(text, f).replace(/[\r\n\t]+/g, ' ')
    const out: string[] = []
    let cur = ''
    const hardSplit = (word: string) => {
      let piece = ''
      for (const ch of word) {
        if (piece && f.widthOfTextAtSize(piece + ch, size) > maxW) {
          out.push(piece)
          piece = ''
        }
        piece += ch
      }
      cur = piece
    }
    for (const word of clean.split(' ')) {
      if (word === '') continue
      if (f.widthOfTextAtSize(word, size) > maxW) {
        if (cur) {
          out.push(cur)
          cur = ''
        }
        hardSplit(word)
        continue
      }
      const cand = cur ? cur + ' ' + word : word
      if (cur && f.widthOfTextAtSize(cand, size) > maxW) {
        out.push(cur)
        cur = word
      } else cur = cand
    }
    if (cur) out.push(cur)
    return out
  }

  // ---- primitive drawers ---------------------------------------------------
  const rect = (page: PDFPage, x: number, y: number, w: number, h: number, c: RGB, opts: { opacity?: number } = {}) =>
    page.drawRectangle({ x, y, width: w, height: h, color: col(c), opacity: opts.opacity })

  const line = (page: PDFPage, x1: number, y: number, x2: number, c: RGB, thickness = 0.8) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color: col(c) })

  /** Flow wrapped paragraph text down from a baseline. Returns the new y. */
  const flow = (
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    maxW: number,
    opts: { size?: number; leading?: number; font?: PDFFont; color?: RGB } = {},
  ): number => {
    const size = opts.size ?? TYPE.body.size
    const leading = opts.leading ?? TYPE.body.leading
    const f = opts.font ?? fonts.sans
    const c = col(opts.color ?? COLORS.ink)
    for (const ln of wrap(text, size, f, maxW)) {
      page.drawText(ln, { x, y, size, font: f, color: c })
      y -= leading
    }
    return y
  }

  const measureFlow = (text: string, size: number, f: PDFFont, maxW: number, leading: number) =>
    wrap(text, size, f, maxW).length * leading

  const eyebrow = (page: PDFPage, text: string, x: number, y: number, c: RGB = COLORS.brass) => {
    const spaced = safe(text.toUpperCase(), fonts.sansBold).split('').join('\u200a')
    page.drawText(spaced, { x, y, size: TYPE.eyebrow.size, font: fonts.sansBold, color: col(c) })
    return y - 14
  }

  const addLink = (page: PDFPage, x: number, y: number, w: number, h: number, url: string) => {
    const annot = pdf.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, y, x + w, y + h],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    })
    const ref = pdf.context.register(annot)
    const existing = page.node.lookup(PDFName.of('Annots'), PDFArray)
    if (existing) existing.push(ref)
    else page.node.set(PDFName.of('Annots'), pdf.context.obj([ref]))
  }

  /** Draw an image to COVER a box (preserving proportions) using a clip path and
   *  the venue focal point. Falls back to a tinted placeholder if missing. */
  const drawCover = (page: PDFPage, img: PDFImage | null, x: number, y: number, w: number, h: number, focal = { x: 0.5, y: 0.5 }) => {
    if (!img) {
      rect(page, x, y, w, h, COLORS.tint)
      const msg = 'Photograph to follow'
      const fs2 = 9
      page.drawText(msg, { x: x + (w - fonts.sans.widthOfTextAtSize(msg, fs2)) / 2, y: y + h / 2 - 4, size: fs2, font: fonts.sans, color: col(COLORS.muted) })
      return
    }
    const scale = Math.max(w / img.width, h / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    const dx = x - (dw - w) * Math.min(Math.max(focal.x, 0), 1)
    const dy = y - (dh - h) * (1 - Math.min(Math.max(focal.y, 0), 1))
    page.pushOperators(pushGraphicsState(), moveTo(x, y), lineTo(x + w, y), lineTo(x + w, y + h), lineTo(x, y + h), closePath(), clip(), endPath())
    page.drawImage(img, { x: dx, y: dy, width: dw, height: dh })
    page.pushOperators(popGraphicsState())
    page.drawRectangle({ x, y, width: w, height: h, borderColor: col(COLORS.border), borderWidth: 0.8 })
  }

  /** Draw an image to fit INSIDE a box (letterboxed on a tint) preserving
   *  proportions — used where cropping would lose content. */
  const drawContain = (page: PDFPage, img: PDFImage | null, x: number, y: number, w: number, h: number) => {
    rect(page, x, y, w, h, COLORS.tint)
    if (img) {
      const scale = Math.min(w / img.width, h / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      page.drawImage(img, { x: x + (w - dw) / 2, y: y + (h - dh) / 2, width: dw, height: dh })
    }
    page.drawRectangle({ x, y, width: w, height: h, borderColor: col(COLORS.border), borderWidth: 0.8 })
  }

  const M = PAGE.margin
  const CW = PAGE.contentW
  const status = edition.status
  const draftLike = status === 'DRAFT' || status === 'IN_REVIEW' || status === 'REJECTED'

  const newPage = (): PDFPage => {
    const page = pdf.addPage([PAGE.w, PAGE.h])
    rect(page, 0, 0, PAGE.w, PAGE.h, COLORS.cream)
    return page
  }

  // Running header on inner pages.
  const runningHeader = (page: PDFPage, sectionNo: string, sectionName: string) => {
    const top = PAGE.h - M
    const right = `${sectionNo} · ${sectionName.toUpperCase()}`
    const spaced = right.split('').join('\u200a')
    const w = fonts.sans.widthOfTextAtSize(spaced, TYPE.eyebrow.size)
    // Truncate the venue name so it never collides with the section label.
    const avail = PAGE.w - M - w - 18 - M
    let name = safe(edition.venueName, fonts.serifBold)
    if (fonts.serifBold.widthOfTextAtSize(name, 10) > avail) {
      while (name.length > 1 && fonts.serifBold.widthOfTextAtSize(name + '…', 10) > avail) {
        name = name.slice(0, -1)
      }
      name = name.trimEnd() + '…'
    }
    page.drawText(name, { x: M, y: top, size: 10, font: fonts.serifBold, color: col(COLORS.forest) })
    page.drawText(spaced, { x: PAGE.w - M - w, y: top, size: TYPE.eyebrow.size, font: fonts.sans, color: col(COLORS.brass) })
    line(page, M, top - 8, PAGE.w - M, COLORS.border)
    return top - 30
  }

  // ---- PAGE 1 — Arrival ----------------------------------------------------
  {
    const page = newPage()
    const photos = [...(edition.photos ?? [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    const cover = photos.find(p => p.isCover) ?? photos[0]
    const heroH = 340
    const heroY = PAGE.h - heroH
    const img = cover ? await getImage(cover.src) : null
    drawCover(page, img ?? null, 0, heroY, PAGE.w, heroH, cover?.focal ?? { x: 0.5, y: 0.5 })
    // Title block, anchored to the BOTTOM of the hero and built upward so the
    // whole block (eyebrow + headline + name) always sits inside the scrim,
    // regardless of how many lines the headline wraps to.
    const headlineLines = wrap(edition.headline, TYPE.h1.size, fonts.serifBold, CW)
    const btY = heroY + 30 // business-type label baseline
    const vnY = btY + 18 // venue-name baseline
    const hlBottom = vnY + 28 // lowest headline line baseline
    const hlTop = hlBottom + (headlineLines.length - 1) * TYPE.h1.leading
    const ebY = hlTop + 26 // eyebrow baseline
    const scrimTop = ebY + 18

    // Forest gradient scrim sized to the actual title block, so the headline is
    // readable over any photo and the dark band never spills past the title.
    const scrimSteps = Math.ceil((scrimTop - heroY) / 2)
    for (let i = 0; i < scrimSteps; i++) {
      rect(page, 0, heroY + i * 2, PAGE.w, 2, COLORS.forestDark, {
        opacity: Math.max(0, 0.64 - (i / scrimSteps) * 0.62),
      })
    }
    rect(page, 0, heroY, PAGE.w, 4, COLORS.gold)

    page.drawText('BIOVERACITY · VISITOR EDITION', { x: M, y: ebY, size: TYPE.eyebrow.size, font: fonts.sansBold, color: col(COLORS.gold) })
    let hy = hlTop
    for (const ln of headlineLines) {
      page.drawText(ln, { x: M, y: hy, size: TYPE.h1.size, font: fonts.serifBold, color: col(COLORS.white) })
      hy -= TYPE.h1.leading
    }
    page.drawText(safe(edition.venueName, fonts.serif), { x: M, y: vnY, size: TYPE.h3.size, font: fonts.serif, color: col(COLORS.onDark) })
    page.drawText(BUSINESS_TYPE_LABELS[edition.businessType], { x: M, y: btY, size: TYPE.caption.size, font: fonts.sans, color: col(COLORS.onDarkMuted) })

    // Cover caption/credit — its own line(s) just below the hero.
    let by = heroY - 18
    if (cover) {
      const cap = [cover.caption, cover.credit ? `Photograph: ${cover.credit}` : ''].filter(Boolean).join('  ·  ')
      if (cap) by = flow(page, cap, M, by, CW, { size: TYPE.caption.size, leading: TYPE.caption.leading, font: fonts.sans, color: COLORS.muted })
    }

    // Why this place + its surroundings belong together (venue statement),
    // clearly separated from the caption by a gap.
    by -= 22
    by = eyebrow(page, 'Why this place, and the ground it stands on', M, by, COLORS.brass)
    by = flow(page, edition.landscapeConnection, M, by, CW, { size: TYPE.lede.size, leading: TYPE.lede.leading, font: fonts.serif, color: COLORS.ink })
    footer(page)
    if (draftLike) statusBanner(page)
  }

  // ---- PAGE 2 — Working life ----------------------------------------------
  {
    const page = newPage()
    let y = runningHeader(page, '02', 'Working life')
    y = eyebrow(page, 'What is made, served and offered here', M, y)
    for (const ln of wrap('The working life of the place', TYPE.h2.size, fonts.serifBold, CW)) {
      page.drawText(ln, { x: M, y, size: TYPE.h2.size, font: fonts.serifBold, color: col(COLORS.forest) })
      y -= TYPE.h2.leading
    }
    y -= 6
    // Venue-approved story (left column), photos of making/hosting (right).
    const colW = (CW - 20) * 0.56
    const imgX = M + colW + 20
    const imgW = CW - colW - 20
    let storyY = flow(page, edition.story, M, y, colW, { size: TYPE.body.size, leading: TYPE.body.leading, font: fonts.sans, color: COLORS.ink })
    if (edition.workingLifeFacts && edition.workingLifeFacts.length) {
      storyY -= 8
      storyY = eyebrow(page, 'Good to know', M, storyY)
      for (const fct of edition.workingLifeFacts) {
        page.drawText('—', { x: M, y: storyY, size: TYPE.body.size, font: fonts.sansBold, color: col(COLORS.goldDeep) })
        storyY = flow(page, fct, M + 14, storyY, colW - 14, { size: TYPE.body.size, leading: TYPE.body.leading, font: fonts.sans, color: COLORS.ink })
        storyY -= 2
      }
    }
    // Detail photos (2nd, 3rd in sequence) shown true to proportion.
    const detail = [...(edition.photos ?? [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)).filter(p => !p.isCover).slice(0, 2)
    let iy = y
    const ih = 176
    for (const p of detail.length ? detail : [...(edition.photos ?? [])].slice(0, 1)) {
      const im = await getImage(p.src)
      drawContain(page, im, imgX, iy - ih, imgW, ih)
      let capY = iy - ih - 12
      const cap = [p.caption, p.credit ? `Photograph: ${p.credit}` : ''].filter(Boolean).join('  ·  ')
      if (cap) capY = flow(page, cap, imgX, capY, imgW, { size: TYPE.caption.size, leading: TYPE.caption.leading, font: fonts.sans, color: COLORS.muted })
      iy = capY - 14
    }
    footer(page)
    if (draftLike) statusBanner(page)
  }

  // ---- PAGE 3 — The living system ----------------------------------------
  {
    const page = newPage()
    let y = runningHeader(page, '03', 'The living system')
    y = eyebrow(page, 'Carefully sourced — wider area unless marked at the venue', M, y)
    for (const ln of wrap('The living system around you', TYPE.h2.size, fonts.serifBold, CW)) {
      page.drawText(ln, { x: M, y, size: TYPE.h2.size, font: fonts.serifBold, color: col(COLORS.forest) })
      y -= TYPE.h2.leading
    }
    y -= 4
    y = flow(page, 'These records describe the living landscape of the surrounding area. They are drawn from published sources (page 6) — not from sightings at the venue, unless a card is marked “At the venue”.', M, y, CW, { size: TYPE.caption.size, leading: TYPE.caption.leading, font: fonts.sans, color: COLORS.muted })
    y -= 10
    const cards = (edition.ecologyCards ?? []).slice(0, 5)
    if (cards.length === 0) {
      // Specific missing-content message (never invented filler).
      rect(page, M, y - 70, CW, 70, COLORS.ivory)
      page.drawRectangle({ x: M, y: y - 70, width: CW, height: 70, borderColor: col(COLORS.border), borderWidth: 0.8 })
      flow(page, 'No sourced ecology stories have been added yet. Add three to five records from published sources to complete this page. Nothing is invented to fill it.', M + 14, y - 22, CW - 28, { size: TYPE.body.size, leading: TYPE.body.leading, font: fonts.sans, color: COLORS.muted })
    }
    for (const c of cards) {
      // Estimate card height so it never overlaps the footer.
      const bodyH = measureFlow(c.body, TYPE.body.size, fonts.sans, CW - 28, TYPE.body.leading)
      const cardH = 34 + bodyH + 16
      if (y - cardH < 72) break // validateEdition keeps 3-5 short cards on one page; guard anyway
      rect(page, M, y - cardH, CW, cardH, COLORS.ivory)
      rect(page, M, y - cardH, 3, cardH, c.scope === 'at-venue' ? COLORS.forest : COLORS.gold)
      page.drawRectangle({ x: M, y: y - cardH, width: CW, height: cardH, borderColor: col(COLORS.border), borderWidth: 0.8 })
      let cy = y - 20
      // Common name first (bold), scientific name italic inline.
      const common = safe(c.commonName, fonts.serifBold)
      page.drawText(common, { x: M + 14, y: cy, size: TYPE.h3.size, font: fonts.serifBold, color: col(COLORS.forest) })
      let cx = M + 14 + fonts.serifBold.widthOfTextAtSize(common, TYPE.h3.size)
      if (c.scientificName) {
        const sci = ` (${safe(c.scientificName, fonts.serifItalic)})`
        page.drawText(sci, { x: cx, y: cy, size: TYPE.h3.size - 1, font: fonts.serifItalic, color: col(COLORS.muted) })
        cx += fonts.serifItalic.widthOfTextAtSize(sci, TYPE.h3.size - 1)
      }
      // Scope chip on the right.
      const chip = c.scope === 'at-venue' ? 'AT THE VENUE' : 'WIDER AREA'
      const chipW = fonts.sansBold.widthOfTextAtSize(chip, TYPE.micro.size) + 12
      rect(page, PAGE.w - M - chipW - 14, cy - 3, chipW, 14, c.scope === 'at-venue' ? COLORS.forest : COLORS.tint)
      page.drawText(chip, { x: PAGE.w - M - chipW - 14 + 6, y: cy, size: TYPE.micro.size, font: fonts.sansBold, color: c.scope === 'at-venue' ? col(COLORS.onDark) : col(COLORS.brass) })
      cy -= 20
      cy = flow(page, c.body, M + 14, cy, CW - 28, { size: TYPE.body.size, leading: TYPE.body.leading, font: fonts.sans, color: COLORS.ink })
      // Source references (numbers into page 6).
      const refs = c.sourceIds.map(id => sourceIndex(edition.sources ?? [], id)).filter(n => n > 0)
      if (refs.length) page.drawText(`Sources: ${refs.map(n => `[${n}]`).join(' ')}`, { x: M + 14, y: cy, size: TYPE.micro.size, font: fonts.sans, color: col(COLORS.goldDeep) })
      y = y - cardH - 12
    }
    footer(page)
    if (draftLike) statusBanner(page)
  }

  // ---- PAGE 4 — Look a little longer -------------------------------------
  {
    const page = newPage()
    let y = runningHeader(page, '04', 'Look a little longer')
    y = eyebrow(page, 'Useful even when no animal is seen', M, y)
    for (const ln of wrap('Look a little longer', TYPE.h2.size, fonts.serifBold, CW)) {
      page.drawText(ln, { x: M, y, size: TYPE.h2.size, font: fonts.serifBold, color: col(COLORS.forest) })
      y -= TYPE.h2.leading
    }
    y -= 8
    const g = edition.guidance ?? { notice: [], wonder: [], remember: [] }
    const colGap = 18
    const colW = (CW - colGap * 2) / 3
    const columns: Array<{ title: string; items: string[]; accent: RGB }> = [
      { title: 'Notice', items: g.notice ?? [], accent: COLORS.forest },
      { title: 'Wonder', items: g.wonder ?? [], accent: COLORS.goldDeep },
      { title: 'Remember', items: g.remember ?? [], accent: COLORS.brass },
    ]
    const top = y
    columns.forEach((c, i) => {
      const x = M + i * (colW + colGap)
      rect(page, x, 96, colW, top - 96, COLORS.ivory)
      page.drawRectangle({ x, y: 96, width: colW, height: top - 96, borderColor: col(COLORS.border), borderWidth: 0.8 })
      rect(page, x, top - 4, colW, 4, c.accent)
      let cy = top - 24
      page.drawText(c.title, { x: x + 12, y: cy, size: TYPE.h3.size, font: fonts.serifBold, color: col(c.accent) })
      cy -= 22
      const items = c.items.length ? c.items : ['—']
      for (const it of items) {
        page.drawText('·', { x: x + 12, y: cy, size: TYPE.body.size, font: fonts.sansBold, color: col(c.accent) })
        cy = flow(page, it, x + 22, cy, colW - 34, { size: TYPE.body.size, leading: TYPE.body.leading, font: fonts.sans, color: COLORS.ink })
        cy -= 6
      }
    })
    footer(page)
    if (draftLike) statusBanner(page)
  }

  // ---- PAGE 5 — Your visit ------------------------------------------------
  {
    const page = newPage()
    let y = runningHeader(page, '05', 'Your visit')
    y = eyebrow(page, 'Plan your visit and visit respectfully', M, y)
    for (const ln of wrap('Your visit', TYPE.h2.size, fonts.serifBold, CW)) {
      page.drawText(ln, { x: M, y, size: TYPE.h2.size, font: fonts.serifBold, color: col(COLORS.forest) })
      y -= TYPE.h2.leading
    }
    y -= 8
    const v = edition.visitor
    const leftW = CW * 0.58
    let ly = y
    if (v.addressLines && v.addressLines.length) {
      ly = eyebrow(page, 'Find us', M, ly)
      for (const a of v.addressLines) ly = flow(page, a, M, ly, leftW, { size: TYPE.body.size, leading: TYPE.body.leading, font: fonts.sans, color: COLORS.ink })
      ly -= 8
    }
    if (v.openingInfo) {
      ly = eyebrow(page, 'Opening', M, ly)
      ly = flow(page, v.openingInfo, M, ly, leftW, { size: TYPE.body.size, leading: TYPE.body.leading, font: fonts.sans, color: COLORS.ink })
      ly -= 8
    }
    ly = eyebrow(page, 'Official website', M, ly)
    page.drawText(safe(v.officialUrl, fonts.sans), { x: M, y: ly, size: TYPE.body.size, font: fonts.sans, color: col(COLORS.goldDeep) })
    addLink(page, M, ly - 2, fonts.sans.widthOfTextAtSize(v.officialUrl, TYPE.body.size), TYPE.body.size + 2, v.officialUrl)
    ly -= TYPE.body.leading + 8
    if (v.accessNotes) {
      ly = eyebrow(page, 'Access & visiting respectfully', M, ly)
      ly = flow(page, v.accessNotes, M, ly, leftW, { size: TYPE.body.size, leading: TYPE.body.leading, font: fonts.sans, color: COLORS.ink })
    }
    // QR panel (right).
    const qx = M + leftW + 20
    const qw = CW - leftW - 20
    const qpH = 210
    rect(page, qx, y - qpH, qw, qpH, COLORS.forest)
    let qy = y - 24
    page.drawText('SCAN TO OPEN', { x: qx + 16, y: qy, size: TYPE.eyebrow.size, font: fonts.sansBold, color: col(COLORS.gold) })
    qy -= 18
    const qrImg = await getImage(qrPlaceholderPath())
    const qrSize = 108
    drawContain(page, qrImg, qx + (qw - qrSize) / 2, qy - qrSize, qrSize, qrSize)
    qy -= qrSize + 14
    const dest = v.qrIsOfficialUrl ? 'Opens the official venue website' : 'Opens the published venue page, then “Download visitor brochure”'
    qy = flow(page, dest, qx + 14, qy, qw - 28, { size: TYPE.caption.size, leading: TYPE.caption.leading, font: fonts.sans, color: COLORS.onDark })
    footer(page)
    if (draftLike) statusBanner(page)
  }

  // ---- PAGE 6 — Wonder with roots (sources & credits) --------------------
  {
    const page = newPage()
    let y = runningHeader(page, '06', 'Wonder with roots')
    y = eyebrow(page, 'Every claim, checkable', M, y)
    for (const ln of wrap('Sources & credits', TYPE.h2.size, fonts.serifBold, CW)) {
      page.drawText(ln, { x: M, y, size: TYPE.h2.size, font: fonts.serifBold, color: col(COLORS.forest) })
      y -= TYPE.h2.leading
    }
    y -= 4
    y = flow(page, `This edition (revision ${edition.revision}, ${formatDate(edition.editionDate)}) uses only the sources listed below. Venue statements are the venue’s own; wider-area ecology is drawn from these published records; visitor guidance is editorial.`, M, y, CW, { size: TYPE.caption.size, leading: TYPE.caption.leading, font: fonts.sans, color: COLORS.muted })
    y -= 12
    ;(edition.sources ?? []).forEach((s, i) => {
      const n = i + 1
      const head = `[${n}] ${s.title}`
      const bodyH = measureFlow(head, TYPE.body.size, fonts.sansBold, CW - 16, TYPE.body.leading)
      if (y - bodyH - 30 < 70) return
      let sy = flow(page, head, M, y, CW - 16, { size: TYPE.body.size, leading: TYPE.body.leading, font: fonts.sansBold, color: COLORS.ink })
      const meta = [s.publisher, s.locator, `Scope: ${s.geographicScope}`, s.retrievedAt ? `Retrieved ${formatDate(s.retrievedAt)}` : ''].filter(Boolean).join('  ·  ')
      if (meta) sy = flow(page, meta, M, sy, CW - 16, { size: TYPE.caption.size, leading: TYPE.caption.leading, font: fonts.sans, color: COLORS.muted })
      if (s.url) {
        page.drawText(safe(s.url, fonts.sans), { x: M, y: sy, size: TYPE.source.size, font: fonts.sans, color: col(COLORS.goldDeep) })
        addLink(page, M, sy - 2, fonts.sans.widthOfTextAtSize(s.url, TYPE.source.size), TYPE.source.size + 2, s.url)
        sy -= TYPE.source.leading
      }
      y = sy - 10
    })
    // Photo credits.
    const credited = (edition.photos ?? []).filter(p => p.credit)
    if (credited.length && y > 130) {
      y -= 6
      y = eyebrow(page, 'Photograph credits', M, y)
      for (const p of credited) {
        if (y < 96) break
        y = flow(page, `${p.caption || 'Photograph'} — ${p.credit}`, M, y, CW, { size: TYPE.caption.size, leading: TYPE.caption.leading, font: fonts.sans, color: COLORS.muted })
      }
    }
    // Approval status line (accurate).
    line(page, M, 104, PAGE.w - M, COLORS.border)
    const statusText = approvalLine(edition)
    flow(page, statusText, M, 92, CW, { size: TYPE.caption.size, leading: TYPE.caption.leading, font: fonts.sans, color: COLORS.muted })
    footer(page)
    if (draftLike) statusBanner(page)
  }

  // ---- shared footer + status banner --------------------------------------
  function footer(page: PDFPage) {
    const pages = pdf.getPages()
    const n = pages.indexOf(page) + 1
    line(page, M, 66, PAGE.w - M, COLORS.border)
    page.drawText('BioVeracity', { x: M, y: 52, size: TYPE.micro.size, font: fonts.sansBold, color: col(COLORS.forest) })
    const label = STATUS_LABELS[status]
    page.drawText(label, { x: M, y: 42, size: TYPE.micro.size, font: fonts.sans, color: col(draftLike ? COLORS.error : COLORS.muted) })
    const right = `${edition.venueName} · revision ${edition.revision}`
    const rw = fonts.sans.widthOfTextAtSize(right, TYPE.micro.size)
    page.drawText(safe(right, fonts.sans), { x: PAGE.w - M - rw, y: 52, size: TYPE.micro.size, font: fonts.sans, color: col(COLORS.muted) })
    // The architecture is a fixed six-page edition, so the total is constant.
    page.drawText(`p. ${n} of 6`, { x: PAGE.w - M - 34, y: 42, size: TYPE.micro.size, font: fonts.sans, color: col(COLORS.muted) })
  }

  function statusBanner(page: PDFPage) {
    const label = STATUS_LABELS[status]
    const bw = fonts.sansBold.widthOfTextAtSize(label, 9) + 24
    const bx = (PAGE.w - bw) / 2
    rect(page, bx, PAGE.h - 20, bw, 16, COLORS.error, { opacity: 0.92 })
    page.drawText(label, { x: bx + 12, y: PAGE.h - 16, size: 9, font: fonts.sansBold, color: col(COLORS.white) })
  }

  const bytes = Buffer.from(await pdf.save())
  return { bytes, pageCount: pdf.getPageCount(), byteLength: bytes.length }
}

// ---- helpers ---------------------------------------------------------------
function sourceIndex(sources: SourceRecord[], id: string): number {
  const i = sources.findIndex(s => s.id === id)
  return i < 0 ? 0 : i + 1
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso || 'undated'
  return d.toLocaleDateString('en-IE', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

function approvalLine(edition: Edition): string {
  switch (edition.status) {
    case 'PUBLISHED':
      return `Approved and published${edition.publicationInfo ? ` · ${edition.publicationInfo}` : ''}. This download is the approved snapshot of revision ${edition.revision}.`
    case 'APPROVED':
      return `Approved for publication (revision ${edition.revision}). Awaiting publication.`
    case 'IN_REVIEW':
      return 'Draft submitted for review. Not yet approved — not for public release.'
    case 'REJECTED':
      return 'Returned for changes. Not approved — not for public release.'
    default:
      return 'Private draft. Not submitted, not approved — not for public release.'
  }
}

// A neutral QR placeholder shipped with the app; the real QR is generated per
// published venue page. Rendering a placeholder keeps layout honest in previews.
function qrPlaceholderPath(): string {
  return path.join(process.cwd(), 'public', 'brochure-qr-placeholder.png')
}

export { EDITION_SCHEMA_VERSION }
