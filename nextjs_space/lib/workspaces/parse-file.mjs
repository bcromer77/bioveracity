import { createHash } from 'node:crypto'
// Heavy parsers (pdfjs-dist, mammoth, mailparser) are loaded with dynamic
// import() inside the branch that needs them. This keeps them out of the
// server module graph (so they are never traced into the main app bundle) and
// lets the pre-bundler (scripts/build-parser-worker.mjs) inline them into the
// self-contained forked worker. Do NOT convert these to top-level imports or a
// createRequire alias: esbuild will not inline a createRequire-based require,
// which reintroduces the deploy file-tracing dependency.
export const PARSER_VERSION = 'case-parser/1'
export const MAX_BYTES = 5 * 1024 * 1024

function sections(text, locator) {
  const clean = text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim()
  if (clean.length > 300000) throw new Error('Extracted text exceeds limit')
  const result = []
  for (let offset = 0; offset < clean.length; offset += 2400) {
    result.push({ locator: `${locator}; text offsets ${offset}-${Math.min(offset + 2400, clean.length)}`, text: clean.slice(offset, offset + 2400) })
  }
  return result
}
// Nothing extracted is executable, a verified claim, or an instruction to an agent.
export async function parseFile(bytes, filename, depth = 0) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BYTES || depth > 1) throw new Error('File exceeds import bounds')
  const name = String(filename).replace(/[\x00-\x1f/\\]/g, '_').slice(0, 180) || 'document'
  const ext = name.split('.').pop().toLowerCase()
  const item = { name, hash: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.toString('base64'), mediaType: 'application/octet-stream', status: 'PARSED', warnings: [], metadata: {}, passages: [], children: [] }
  if (ext === 'pdf' && bytes.subarray(0, 5).toString() === '%PDF-') {
    item.mediaType = 'application/pdf'
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    // Import the worker module for its side effect: it registers the in-process
    // "fake worker" (globalThis.pdfjsWorker) so pdfjs does not try to fetch a
    // separate pdf.worker.mjs file. The pre-bundler inlines this, which keeps
    // the forked worker self-contained; un-bundled it resolves from node_modules.
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
    const task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: true })
    try {
      const pdf = await task.promise
      if (pdf.numPages > 100) throw new Error('Maximum 100 PDF pages')
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent()
        const text = content.items.map(x => 'str' in x ? x.str + (x.hasEOL ? '\n' : ' ') : '').join('')
        item.passages.push(...sections(text, `PDF page ${i}`))
        if (item.passages.length > 150) throw new Error('Too many passages')
      }
      if (!item.passages.length) { item.status = 'NEEDS_OCR'; item.warnings.push('No extractable text. OCR is not available; review the original manually.') }
    } finally { await task.destroy() }
  } else if (ext === 'docx' && bytes.subarray(0, 2).toString() === 'PK') {
    item.mediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    // The subprocess caps elapsed time and V8 heap, not native allocations.
    // Production must also impose host/container memory and capability limits.
    const mammothModule = await import('mammoth')
    const mammoth = mammothModule.default ?? mammothModule
    const result = await mammoth.extractRawText({ buffer: bytes })
    item.passages = sections(result.value, 'DOCX extracted body (not page numbered)')
    if (result.messages.length) item.warnings.push('Document conversion reported warnings; compare the original.')
  } else if (ext === 'eml' && /^(From|To|Date|Subject|Received|MIME-Version|Return-Path|Message-ID):/im.test(bytes.subarray(0, 16384).toString())) {
    item.mediaType = 'message/rfc822'
    const mailparserModule = await import('mailparser')
    const simpleParser = mailparserModule.simpleParser ?? mailparserModule.default?.simpleParser
    const mail = await simpleParser(bytes, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true, maxHtmlLengthToParse: 0 })
    item.metadata = { subject: mail.subject ?? null, messageId: mail.messageId ?? null, sentHeader: mail.headerLines.find(x => x.key === 'date')?.line ?? null }
    item.passages = sections(mail.text || '', 'Email text/plain body')
    if (!mail.text) item.warnings.push('No plain-text body; HTML is retained only in the original and is not rendered.')
    if (mail.attachments.length > 10) throw new Error('Maximum 10 email attachments')
    if (depth && mail.attachments.length) throw new Error('Nested attachment depth exceeded')
    for (const attachment of mail.attachments) {
      const child = await parseFile(attachment.content, attachment.filename || 'attachment.bin', depth + 1)
      item.children.push(child)
    }
  } else if (['txt', 'csv'].includes(ext)) {
    item.mediaType = ext === 'csv' ? 'text/csv' : 'text/plain'
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (text.includes('\u0000')) throw new Error('Binary content is not a text file')
    item.passages = sections(text, ext === 'csv' ? 'CSV raw text (no inferred column meaning)' : 'Text body')
  } else if ((ext === 'png' && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (['jpg','jpeg'].includes(ext) && bytes[0] === 255 && bytes[1] === 216)) {
    item.mediaType = ext === 'png' ? 'image/png' : 'image/jpeg'
    item.status = 'NEEDS_OCR'
    item.warnings.push('Image retained. No OCR or event date inferred.')
  } else {
    throw new Error(`Unsupported or mismatched file type: ${ext}`)
  }
  if (item.passages.length > 150) throw new Error('Too many passages')
  if (!item.passages.length && item.status === 'PARSED') item.status = 'NO_TEXT'
  return item
}

export function proposedDate(text) {
  // Deliberately do not resolve ambiguous numeric dates, relative dates, or an email header as an event.
  const m = text.match(/\b(20\d{2}|19\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/)
  if (!m) return { date: null, precision: 'UNKNOWN' }
  const date = m[0]
  return new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date ? { date, precision: 'DAY' } : { date: null, precision: 'UNKNOWN' }
}
