import { PDFDocument, rgb, PDFName, PDFString, PDFArray, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'node:fs'
import path from 'node:path'
import type { EventRow } from './case-files'
import { citationUrl } from './citation'

// case-renderer/2: embeds a Unicode font (DejaVu Sans) so ordinary accented names
// (e.g. Sinéad), scientific units and long references render correctly; wraps on word
// boundaries (only a single over-long token is hard-split); and prints a clickable
// canonical citation link per source reference. Exact source text is preserved in the
// JSON manifest; this renderer never mutates the manifest.
const MAXW = 511
export async function renderCase(manifest: Record<string, unknown>): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const fontsDir = path.join(process.cwd(), 'public', 'fonts')
  const font = await pdf.embedFont(fs.readFileSync(path.join(fontsDir, 'DejaVuSans.ttf')), { subset: true })
  const bold = await pdf.embedFont(fs.readFileSync(path.join(fontsDir, 'DejaVuSans-Bold.ttf')), { subset: true })
  const reportTitle = typeof manifest.reportTitle === 'string' && manifest.reportTitle.trim() ? manifest.reportTitle.trim() : ''
  pdf.setTitle(reportTitle || 'BioVeracity reviewed case timeline'); pdf.setProducer('BioVeracity case-renderer/2')
  pdf.setCreationDate(new Date(String(manifest.createdAt))); pdf.setModificationDate(new Date(String(manifest.createdAt)))
  const appOrigin = typeof manifest.appOrigin === 'string' ? manifest.appOrigin : ''
  const workspaceId = typeof manifest.workspaceId === 'string' ? manifest.workspaceId : ''
  const caseId = typeof manifest.caseId === 'string' ? manifest.caseId : ''
  let page: PDFPage = pdf.addPage([595, 842]), y = 795
  // Preserve unsupported characters explicitly, not silently as replacement glyphs. With the
  // embedded Unicode font this fallback only triggers for glyphs outside DejaVu coverage (e.g. CJK).
  const safe = (s: string) => Array.from(s).map(ch => { try { font.encodeText(ch); return ch } catch { return `[U+${ch.codePointAt(0)!.toString(16).toUpperCase()}]` } }).join('')
  function wrap(text: string, size: number, f: PDFFont): string[] {
    const clean = safe(text).replace(/[\r\n\t]/g, ' ')
    const out: string[] = []
    let current = ''
    const hardSplit = (word: string) => {
      let piece = ''
      for (const ch of word) { if (piece && f.widthOfTextAtSize(piece + ch, size) > MAXW) { out.push(piece); piece = '' } piece += ch }
      current = piece
    }
    for (const word of clean.split(' ')) {
      if (word === '') continue
      if (f.widthOfTextAtSize(word, size) > MAXW) { if (current) { out.push(current); current = '' } hardSplit(word); continue }
      const candidate = current ? current + ' ' + word : word
      if (current && f.widthOfTextAtSize(candidate, size) > MAXW) { out.push(current); current = word } else { current = candidate }
    }
    if (current) out.push(current)
    return out.length ? out : ['']
  }
  function addLink(p: PDFPage, x: number, yy: number, w: number, h: number, url: string) {
    const annot = pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x, yy, x + w, yy + h], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) } })
    const ref = pdf.context.register(annot)
    const existing = p.node.lookup(PDFName.of('Annots'), PDFArray)
    if (existing) existing.push(ref); else p.node.set(PDFName.of('Annots'), pdf.context.obj([ref]))
  }
  function draw(text: string, opts: { size?: number; font?: PDFFont; link?: string; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 10
    const f = opts.font ?? font
    const color = opts.color ? rgb(opts.color[0], opts.color[1], opts.color[2]) : rgb(.12, .16, .2)
    for (const part of wrap(text, size, f)) {
      if (y < 60) { if (pdf.getPageCount() >= 150) throw new Error('PDF page limit exceeded'); page = pdf.addPage([595, 842]); y = 795 }
      page.drawText(part, { x: 42, y, size, font: f, color })
      if (opts.link) addLink(page, 42, y - 2, f.widthOfTextAtSize(part, size), size + 2, opts.link)
      y -= size + 5
    }
  }
  if (reportTitle) draw(reportTitle, { size: 18, font: bold })
  draw(String((manifest.case as { title: string }).title), { size: 16, font: bold })
  draw(`Issued ${manifest.createdAt}`); draw(`Export ${manifest.exportId}`); draw(String(manifest.notice))
  draw('Each citation below links to the exact source passage in the application; access is re-verified on open. The JSON manifest retains original source text.')
  y -= 12
  for (const e of manifest.events as EventRow[]) {
    draw(`${e.eventDate ?? 'Date unknown'} (${e.precision}) — ${e.title}`, { size: 12, font: bold })
    draw(`${e.evidenceType} | revision ${e.revision} | reviewed by ${e.reviewedBy}`)
    if (e.superseded) draw('SOURCE HAS BEEN SUPERSEDED: this entry is retained as historical evidence.')
    draw(`Source: ${e.name} | ${e.locator}`)
    draw(`Document ${e.documentId} | SHA-256 ${e.hash}`)
    if (e.sourceUrl) draw(`Source URL (user supplied): ${e.sourceUrl}`)
    draw(`Publication: ${e.publicationDate ?? 'unknown'} | Imported: ${e.importedAt}`)
    if (workspaceId && caseId && e.documentId && e.passageId) {
      const url = citationUrl(appOrigin, workspaceId, caseId, e.documentId, e.passageId)
      draw(`Open cited source (revision ${e.revision}): ${url}`, { link: url, color: [.1, .3, .7] })
    }
    draw(`Quote: ${e.quote}`)
    if (e.note) draw(`Review note: ${e.note}`)
    y -= 14
  }
  const pages = pdf.getPages(); pages.forEach((p, i) => p.drawText(`BioVeracity | ${i + 1}/${pages.length}`, { x: 42, y: 28, size: 9, font }))
  return Buffer.from(await pdf.save())
}
