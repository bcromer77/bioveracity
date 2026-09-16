// Authorised PDF outputs for the Ellona Opportunity Watch:
//   * renderOpportunityBrief — a single qualification brief for one opportunity
//     or a reviewed customer assessment.
//   * renderPortfolio — a portfolio across the current opportunities.
//
// Both reuse the case-renderer conventions: an embedded Unicode font (DejaVu),
// clickable links, word-boundary wrapping, and a QR code linking back to the
// authenticated live record. Every PDF carries the representation line and a
// snapshot footer so a printed copy can never be mistaken for the live status.

import { PDFDocument, rgb, PDFName, PDFString, PDFArray, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { ELLONA, REPRESENTATION_LINE } from './config'
import type { ExtractedField } from './extraction'

export const PDF_VERSION = 'ellona-pdf/1'
const MAXW = 511
const LEFT = 42

type Ctx = {
  pdf: PDFDocument
  font: PDFFont
  bold: PDFFont
  italic: PDFFont
  page: PDFPage
  y: number
}

function newCtx(pdf: PDFDocument, font: PDFFont, bold: PDFFont, italic: PDFFont): Ctx {
  return { pdf, font, bold, italic, page: pdf.addPage([595, 842]), y: 795 }
}

function safeFactory(font: PDFFont) {
  return (s: string) =>
    Array.from(s)
      .map((ch) => {
        try {
          font.encodeText(ch)
          return ch
        } catch {
          return `[U+${ch.codePointAt(0)!.toString(16).toUpperCase()}]`
        }
      })
      .join('')
}

function wrap(text: string, size: number, f: PDFFont, safe: (s: string) => string, maxw = MAXW): string[] {
  const clean = safe(text).replace(/[\r\n\t]/g, ' ')
  const out: string[] = []
  let current = ''
  const hardSplit = (word: string) => {
    let piece = ''
    for (const ch of word) {
      if (piece && f.widthOfTextAtSize(piece + ch, size) > maxw) {
        out.push(piece)
        piece = ''
      }
      piece += ch
    }
    current = piece
  }
  for (const word of clean.split(' ')) {
    if (word === '') continue
    if (f.widthOfTextAtSize(word, size) > maxw) {
      if (current) {
        out.push(current)
        current = ''
      }
      hardSplit(word)
      continue
    }
    const candidate = current ? current + ' ' + word : word
    if (current && f.widthOfTextAtSize(candidate, size) > maxw) {
      out.push(current)
      current = word
    } else current = candidate
  }
  if (current) out.push(current)
  return out.length ? out : ['']
}

function addLink(ctx: Ctx, x: number, yy: number, w: number, h: number, url: string) {
  const annot = ctx.pdf.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [x, yy, x + w, yy + h],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
  })
  const ref = ctx.pdf.context.register(annot)
  const existing = ctx.page.node.lookup(PDFName.of('Annots'), PDFArray)
  if (existing) existing.push(ref)
  else ctx.page.node.set(PDFName.of('Annots'), ctx.pdf.context.obj([ref]))
}

function draw(
  ctx: Ctx,
  safe: (s: string) => string,
  text: string,
  opts: { size?: number; font?: PDFFont; link?: string; color?: [number, number, number]; indent?: number } = {},
) {
  const size = opts.size ?? 10
  const f = opts.font ?? ctx.font
  const x = LEFT + (opts.indent ?? 0)
  const color = opts.color ? rgb(opts.color[0], opts.color[1], opts.color[2]) : rgb(0.12, 0.16, 0.2)
  for (const part of wrap(text, size, f, safe, MAXW - (opts.indent ?? 0))) {
    if (ctx.y < 70) {
      ctx.page = ctx.pdf.addPage([595, 842])
      ctx.y = 795
    }
    ctx.page.drawText(part, { x, y: ctx.y, size, font: f, color })
    if (opts.link) addLink(ctx, x, ctx.y - 2, f.widthOfTextAtSize(part, size), size + 2, opts.link)
    ctx.y -= size + 5
  }
}

function gap(ctx: Ctx, n = 8) {
  ctx.y -= n
}

async function loadFonts(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit)
  const dir = path.join(process.cwd(), 'public', 'fonts')
  const font = await pdf.embedFont(fs.readFileSync(path.join(dir, 'DejaVuSans.ttf')), { subset: true })
  const bold = await pdf.embedFont(fs.readFileSync(path.join(dir, 'DejaVuSans-Bold.ttf')), { subset: true })
  // Fall back to regular if an italic face is not present.
  let italic = font
  const italicPath = path.join(dir, 'DejaVuSans-Oblique.ttf')
  if (fs.existsSync(italicPath)) italic = await pdf.embedFont(fs.readFileSync(italicPath), { subset: true })
  return { font, bold, italic }
}

async function drawQr(ctx: Ctx, url: string, caption: string, safe: (s: string) => string) {
  try {
    const png = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 220 })
    const img = await ctx.pdf.embedPng(png)
    const size = 96
    if (ctx.y < 70 + size) {
      ctx.page = ctx.pdf.addPage([595, 842])
      ctx.y = 795
    }
    ctx.page.drawImage(img, { x: LEFT, y: ctx.y - size, width: size, height: size })
    ctx.page.drawText(safe(caption), { x: LEFT + size + 12, y: ctx.y - 20, size: 9, font: ctx.font, color: rgb(0.3, 0.34, 0.3) })
    // Make the QR area clickable too.
    addLink(ctx, LEFT, ctx.y - size, size, size, url)
    ctx.y -= size + 12
  } catch {
    draw(ctx, safe, `Live record: ${url}`, { link: url, color: [0.1, 0.3, 0.7] })
  }
}

function footer(ctx: Ctx, safe: (s: string) => string, recordUrl: string) {
  gap(ctx, 14)
  draw(ctx, safe, REPRESENTATION_LINE, { size: 9, font: ctx.italic, color: [0.36, 0.4, 0.36] })
  const stamp = new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())
  draw(ctx, safe, `Snapshot generated ${stamp}. Open the BioVeracity record for the latest status.`, {
    size: 9,
    color: [0.4, 0.44, 0.4],
  })
  draw(ctx, safe, recordUrl, { size: 9, link: recordUrl, color: [0.1, 0.3, 0.7] })
}

const CATEGORY_COLOR: Record<string, [number, number, number]> = {
  'SOURCE FACT': [0.09, 0.24, 0.21],
  'BIOVERACITY ANALYSIS': [0.15, 0.3, 0.55],
  'ELLONA INPUT': [0.55, 0.4, 0.05],
  UNKNOWN: [0.5, 0.5, 0.5],
}

// ---- Opportunity / assessment brief ---------------------------------------

export type BriefInput = {
  heading: string
  subheading?: string
  recordUrl: string
  metaRows: [string, string][]
  fields?: ExtractedField[] // for a reviewed assessment
  notes?: string[] // included private notes the reviewer explicitly selected
  classification?: string
  status?: string
}

export async function renderOpportunityBrief(input: BriefInput): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const { font, bold, italic } = await loadFonts(pdf)
  const safe = safeFactory(font)
  pdf.setTitle(input.heading)
  pdf.setProducer(`BioVeracity ${PDF_VERSION}`)
  const ctx = newCtx(pdf, font, bold, italic)

  draw(ctx, safe, ELLONA.workspaceName, { size: 11, font: bold, color: [0.09, 0.24, 0.21] })
  draw(ctx, safe, input.heading, { size: 17, font: bold })
  if (input.subheading) draw(ctx, safe, input.subheading, { size: 11, color: [0.35, 0.38, 0.34] })
  if (input.classification || input.status)
    draw(ctx, safe, `${input.classification ?? ''}${input.classification && input.status ? '  •  ' : ''}${
      input.status ? 'Status: ' + input.status : ''
    }`, { size: 10, font: bold, color: [0.4, 0.34, 0.05] })
  gap(ctx)

  for (const [k, v] of input.metaRows) {
    draw(ctx, safe, `${k}: ${v}`, { size: 10 })
  }
  gap(ctx)

  if (input.fields && input.fields.length) {
    draw(ctx, safe, 'Qualification review', { size: 13, font: bold })
    draw(ctx, safe, 'Each item is labelled by evidence category. Source facts cite a document locator; blanks are shown honestly.', {
      size: 9,
      color: [0.4, 0.44, 0.4],
    })
    gap(ctx, 6)
    for (const f of input.fields) {
      draw(ctx, safe, f.label, { size: 11, font: bold })
      draw(ctx, safe, `[${f.category}]${f.locator ? '  —  ' + f.locator : ''}`, {
        size: 9,
        font: italic,
        color: CATEGORY_COLOR[f.category] ?? [0.4, 0.4, 0.4],
        indent: 4,
      })
      draw(ctx, safe, f.value, { size: 10, indent: 4 })
      gap(ctx, 6)
    }
  }

  if (input.notes && input.notes.length) {
    gap(ctx, 6)
    draw(ctx, safe, 'Reviewer notes included in this brief', { size: 12, font: bold })
    for (const n of input.notes) draw(ctx, safe, `• ${n}`, { size: 10, indent: 4 })
  }

  gap(ctx, 10)
  await drawQr(ctx, input.recordUrl, 'Scan to open the authenticated live record.', safe)
  footer(ctx, safe, input.recordUrl)
  return Buffer.from(await pdf.save())
}

// ---- Portfolio ------------------------------------------------------------

export type PortfolioItem = {
  buyer: string
  title: string
  classification: string
  status: string
  measurementNeed: string | null
  deadline: string | null
  location: string | null
  recordUrl: string
  bucket: 'NEW' | 'CORRECTION' | 'OPEN' | 'FOLLOWING' | 'CLOSED' | 'SEED'
  accessLimitation: string | null
  nextAction: string | null
}

export async function renderPortfolio(input: {
  dashboardUrl: string
  generatedForLabel: string
  snapshotLabel: string
  evidenceRefreshedLabel: string
  versionLabel: string
  scopeLabel?: string
  coverageNotes: string[]
  items: PortfolioItem[]
}): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const { font, bold, italic } = await loadFonts(pdf)
  const safe = safeFactory(font)
  pdf.setTitle(`${ELLONA.orgName} opportunity portfolio`)
  pdf.setProducer(`BioVeracity ${PDF_VERSION}`)
  const ctx = newCtx(pdf, font, bold, italic)

  draw(ctx, safe, ELLONA.workspaceName, { size: 11, font: bold, color: [0.09, 0.24, 0.21] })
  draw(ctx, safe, 'Opportunity portfolio', { size: 17, font: bold })
  if (input.scopeLabel) draw(ctx, safe, input.scopeLabel, { size: 10, font: italic, color: [0.4, 0.34, 0.05] })
  draw(ctx, safe, input.generatedForLabel, { size: 10, color: [0.35, 0.38, 0.34] })
  draw(ctx, safe, `Report version: ${input.versionLabel}`, { size: 9 })
  draw(ctx, safe, `Evidence last refreshed: ${input.evidenceRefreshedLabel}`, { size: 9 })
  draw(ctx, safe, `Portfolio snapshot generated: ${input.snapshotLabel}`, { size: 9 })
  draw(ctx, safe, `${input.items.length} opportunit${input.items.length === 1 ? 'y' : 'ies'} in scope`, {
    size: 10,
  })
  gap(ctx)

  const sections: Array<[PortfolioItem['bucket'], string]> = [
    ['NEW', 'Newly routed opportunities'], ['CORRECTION', 'Corrections and status changes'],
    ['OPEN', 'Open and unchanged'], ['FOLLOWING', 'Opportunities being followed'],
    ['CLOSED', 'Closed or superseded'], ['SEED', 'Trial seed records — previously published'],
  ]
  let index = 0
  for (const [bucket, heading] of sections) {
    const selected = input.items.filter((item) => item.bucket === bucket)
    if (!selected.length) continue
    draw(ctx, safe, heading, { size: 13, font: bold, color: [0.09, 0.24, 0.21] })
    for (const it of selected) {
      index++
      draw(ctx, safe, `${index}. ${it.buyer} — ${it.title}`, { size: 12, font: bold })
    draw(ctx, safe, `${it.classification}  •  Status: ${it.status}`, {
      size: 9,
      font: italic,
      color: [0.4, 0.34, 0.05],
      indent: 4,
    })
    if (it.measurementNeed) draw(ctx, safe, `Measurement need: ${it.measurementNeed}`, { size: 10, indent: 4 })
    if (it.location) draw(ctx, safe, `Location: ${it.location}`, { size: 10, indent: 4 })
    draw(ctx, safe, `Deadline: ${it.deadline || 'no stated deadline'}`, { size: 10, indent: 4 })
    if (it.nextAction) draw(ctx, safe, `Recommended action: ${it.nextAction}`, { size: 10, indent: 4 })
    if (it.accessLimitation) draw(ctx, safe, `Source access limitation: ${it.accessLimitation}`, { size: 9, indent: 4 })
    draw(ctx, safe, `Open record: ${it.recordUrl}`, { size: 9, link: it.recordUrl, color: [0.1, 0.3, 0.7], indent: 4 })
    gap(ctx, 8)
    }
  }

  const gaps = input.items.filter((item) => item.accessLimitation)
  if (gaps.length || input.coverageNotes.length) {
    draw(ctx, safe, 'Coverage and inaccessible sources', { size: 13, font: bold })
    for (const note of input.coverageNotes) draw(ctx, safe, `• ${note}`, { size: 9, indent: 4 })
    for (const item of gaps) draw(ctx, safe, `${item.buyer}: ${item.accessLimitation}`, { size: 9, indent: 4 })
    gap(ctx)
  }

  draw(ctx, safe, 'Recommended actions', { size: 13, font: bold })
  const actions = input.items.filter((item) => item.nextAction && item.bucket !== 'CLOSED').slice(0, 8)
  if (!actions.length) draw(ctx, safe, 'No current action is supported by the routed evidence.', { size: 10 })
  for (const item of actions) draw(ctx, safe, `• ${item.buyer}: ${item.nextAction}`, { size: 10, indent: 4 })

  gap(ctx, 6)
  await drawQr(ctx, input.dashboardUrl, 'Scan to open your live opportunity watch.', safe)
  footer(ctx, safe, input.dashboardUrl)
  return Buffer.from(await pdf.save())
}
