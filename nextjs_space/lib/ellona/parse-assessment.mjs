// Dedicated parser for the "Analyse your own opportunity" assessment flow.
//
// Unlike the shared case parser (coarse offsets), this produces PRECISE,
// human-checkable document locators per format, because the customer requires
// every extracted fact to carry a locator (page/section/table/paragraph/row):
//   PDF   → "Page N" (+ nearest heading line where detectable)
//   DOCX  → "Heading \"X\" \u203a paragraph N" or "Table T, row R, cell C"
//   EML   → "Email subject" / "Email header: Date" / "Email body paragraph N" / "Attachment: name"
//   CSV   → "<file> row R, column \"<header>\""
//   TXT   → "Lines A\u2013B"
//
// Heavy parsers are dynamically imported inside the branch that needs them.
// Nothing extracted is executable, a verified claim, or an instruction.

import { createHash } from 'node:crypto'

export const ASSESSMENT_PARSER_VERSION = 'ellona-assessment-parser/1'
const MAX_PASSAGES = 400
const MAX_PASSAGE_CHARS = 4000

function clean(text) {
  return String(text || '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n')
}

function pushChunked(passages, locator, text) {
  const t = text.trim()
  if (!t) return
  for (let i = 0; i < t.length && passages.length < MAX_PASSAGES; i += MAX_PASSAGE_CHARS) {
    passages.push({ locator, text: t.slice(i, i + MAX_PASSAGE_CHARS) })
  }
}

// Minimal HTML walker for mammoth output (clean, well-formed tags).
function walkDocxHtml(html, passages) {
  const tokens = html.split(/(<[^>]+>)/)
  let currentHeading = null
  let paragraphIndex = 0
  let tableIndex = 0
  let rowIndex = 0
  let cellIndex = 0
  let inTable = false
  let tag = null
  let buffer = ''

  const decode = (s) =>
    s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()

  const flush = () => {
    const text = decode(buffer)
    buffer = ''
    if (!text) return
    if (tag && /^h[1-6]$/.test(tag)) {
      currentHeading = text
      pushChunked(passages, `Heading \u201c${text.slice(0, 80)}\u201d`, text)
    } else if (inTable && tag === 'td') {
      cellIndex += 1
      pushChunked(passages, `Table ${tableIndex}, row ${rowIndex}, cell ${cellIndex}`, text)
    } else if (tag === 'li') {
      paragraphIndex += 1
      const loc = currentHeading
        ? `Heading \u201c${currentHeading.slice(0, 60)}\u201d \u203a list item ${paragraphIndex}`
        : `List item ${paragraphIndex}`
      pushChunked(passages, loc, text)
    } else if (tag === 'p') {
      paragraphIndex += 1
      const loc = currentHeading
        ? `Heading \u201c${currentHeading.slice(0, 60)}\u201d \u203a paragraph ${paragraphIndex}`
        : `Paragraph ${paragraphIndex}`
      pushChunked(passages, loc, text)
    }
  }

  for (const token of tokens) {
    if (token.startsWith('<')) {
      const m = token.match(/^<\/?\s*([a-zA-Z0-9]+)/)
      const name = m ? m[1].toLowerCase() : ''
      const closing = token.startsWith('</')
      if (!closing) {
        if (name === 'table') { inTable = true; tableIndex += 1; rowIndex = 0 }
        else if (name === 'tr') { rowIndex += 1; cellIndex = 0 }
        if (['p', 'td', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(name)) {
          flush()
          tag = name === 'td' ? 'td' : name === 'li' ? 'li' : /^h[1-6]$/.test(name) ? name : 'p'
          buffer = ''
        }
      } else {
        if (['p', 'td', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(name)) flush()
        if (name === 'table') inTable = false
      }
    } else {
      buffer += token
    }
  }
  flush()
}

export async function parseAssessmentFile(bytes, filename) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new Error('Empty file')
  const name = String(filename).replace(/[\x00-\x1f/\\]/g, '_').slice(0, 180) || 'document'
  const ext = name.split('.').pop().toLowerCase()
  const passages = []
  let mediaType = 'application/octet-stream'
  const warnings = []

  if (ext === 'pdf' && bytes.subarray(0, 5).toString() === '%PDF-') {
    mediaType = 'application/pdf'
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
    const task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: true })
    try {
      const pdf = await task.promise
      if (pdf.numPages > 100) throw new Error('Maximum 100 PDF pages')
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent()
        // Group items into lines; a short all-caps / title-case first line is
        // treated as the page's nearest heading.
        const text = content.items.map((x) => ('str' in x ? x.str + (x.hasEOL ? '\n' : ' ') : '')).join('')
        const lines = clean(text).split('\n').map((l) => l.trim()).filter(Boolean)
        const heading = lines.find((l) => l.length <= 90 && /[A-Za-z]/.test(l))
        const loc = heading ? `Page ${i} \u203a near \u201c${heading.slice(0, 60)}\u201d` : `Page ${i}`
        pushChunked(passages, loc, lines.join('\n'))
        if (passages.length >= MAX_PASSAGES) break
      }
      if (!passages.length) warnings.push('No extractable text (the PDF may be scanned). Review the original manually.')
    } finally {
      await task.destroy()
    }
  } else if (ext === 'docx' && bytes.subarray(0, 2).toString() === 'PK') {
    mediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    const mammothModule = await import('mammoth')
    const mammoth = mammothModule.default ?? mammothModule
    const result = await mammoth.convertToHtml({ buffer: bytes })
    walkDocxHtml(clean(result.value), passages)
    if (result.messages?.length) warnings.push('Document conversion reported warnings; compare with the original.')
  } else if (ext === 'eml' && /^(From|To|Date|Subject|Received|MIME-Version|Return-Path|Message-ID):/im.test(bytes.subarray(0, 16384).toString())) {
    mediaType = 'message/rfc822'
    const mailparserModule = await import('mailparser')
    const simpleParser = mailparserModule.simpleParser ?? mailparserModule.default?.simpleParser
    const mail = await simpleParser(bytes, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true, maxHtmlLengthToParse: 0 })
    if (mail.subject) pushChunked(passages, 'Email subject', mail.subject)
    const dateHeader = mail.headerLines?.find((x) => x.key === 'date')?.line
    if (dateHeader) pushChunked(passages, 'Email header: Date', dateHeader.replace(/^date:\s*/i, ''))
    if (mail.from?.text) pushChunked(passages, 'Email header: From', mail.from.text)
    const bodyParas = clean(mail.text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    bodyParas.forEach((p, idx) => pushChunked(passages, `Email body paragraph ${idx + 1}`, p))
    if (!mail.text) warnings.push('No plain-text body; HTML is retained only in the original.')
    for (const att of (mail.attachments || []).slice(0, 10)) {
      pushChunked(passages, `Attachment: ${att.filename || 'attachment.bin'}`, `Attachment present (${att.size || 0} bytes). Not separately parsed.`)
    }
  } else if (ext === 'csv') {
    mediaType = 'text/csv'
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (text.includes('\u0000')) throw new Error('Binary content is not a CSV file')
    const rows = parseCsv(clean(text))
    const header = rows[0] || []
    for (let r = 1; r < rows.length && passages.length < MAX_PASSAGES; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const value = rows[r][c]?.trim()
        if (!value) continue
        const col = header[c] ? `column \u201c${header[c].trim().slice(0, 40)}\u201d` : `column ${c + 1}`
        pushChunked(passages, `${name} row ${r + 1}, ${col}`, value)
      }
    }
    if (rows.length <= 1) warnings.push('The CSV had no data rows below its header.')
  } else if (ext === 'txt') {
    mediaType = 'text/plain'
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (text.includes('\u0000')) throw new Error('Binary content is not a text file')
    const lines = clean(text).split('\n')
    const BLOCK = 25
    for (let i = 0; i < lines.length && passages.length < MAX_PASSAGES; i += BLOCK) {
      const slice = lines.slice(i, i + BLOCK).join('\n')
      pushChunked(passages, `Lines ${i + 1}\u2013${Math.min(i + BLOCK, lines.length)}`, slice)
    }
  } else {
    throw new Error(`Unsupported or mismatched file type: ${ext}`)
  }

  return {
    name,
    hash: createHash('sha256').update(bytes).digest('hex'),
    mediaType,
    parserVersion: ASSESSMENT_PARSER_VERSION,
    warnings,
    passages,
  }
}

// Small RFC-4180-ish CSV parser (handles quotes, commas, newlines in quotes).
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

// Wrap parsing with a wall-clock timeout so a hostile/huge document cannot hang
// the request. Accepts an injectable timeout for tests (parser-timeout demo).
export async function parseAssessmentWithTimeout(bytes, filename, timeoutMs = 20000) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('PARSER_TIMEOUT')), timeoutMs)
  })
  try {
    return await Promise.race([parseAssessmentFile(bytes, filename), timeout])
  } finally {
    clearTimeout(timer)
  }
}
