import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { assertNoInventedConclusion } from './principles'

export type ReportSnapshot = {
  organisation: string
  portfolio: string
  kind: string
  period: string
  generatedAt: string
  version: string
  status: 'DRAFT' | 'ISSUED'
  summary: string[]
  rows: Array<{ asset: string; fact: string; relationship: string; why: string; question: string; source: string; eventDate: string; publicationDate: string; unknown: string }>
  gaps: string[]
  methodology: string[]
}

function wrap(text: string, width: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > width) {
      if (line) lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

export async function renderReport(snapshot: ReportSnapshot) {
  const document = await PDFDocument.create()
  document.setTitle(`${snapshot.kind} · ${snapshot.status}`)
  document.setSubject('Evidence, relationship and a professional question. Not a risk score.')
  const font = await document.embedFont(StandardFonts.TimesRoman)
  const bold = await document.embedFont(StandardFonts.TimesRomanBold)
  const lines = [
    'BIOVERACITY COMMERCIAL INTELLIGENCE',
    snapshot.status,
    snapshot.kind,
    `${snapshot.organisation} · ${snapshot.portfolio}`,
    `Period ${snapshot.period} · Generated ${snapshot.generatedAt} · Version ${snapshot.version}`,
    '',
    'This report does not decide that an asset is at risk. It records evidence, the relationship to the asset, and a question a professional may want to ask.',
    '',
    ...snapshot.summary.flatMap(line => ['', line]),
    '',
    'EVIDENCE',
    ...snapshot.rows.flatMap(row => [
      '',
      row.asset,
      row.fact,
      `Relationship: ${row.relationship}`,
      `Why this is included: ${row.why}`,
      `Question, not a conclusion: ${row.question}`,
      `Event date: ${row.eventDate} · Publication date: ${row.publicationDate}`,
      `Source: ${row.source}`,
      `Unknown: ${row.unknown}`,
    ]),
    '',
    'GAPS',
    ...snapshot.gaps,
    '',
    'METHOD',
    ...snapshot.methodology,
  ]
  for (const line of lines) assertNoInventedConclusion(line)
  let page = document.addPage([595, 842])
  let y = 800
  const draw = (text: string, emphasis = false) => {
    for (const line of wrap(text, 92)) {
      if (y < 64) {
        page = document.addPage([595, 842])
        y = 800
      }
      page.drawText(line, { x: 48, y, size: emphasis ? 12 : 10, font: emphasis ? bold : font, color: rgb(0.1, 0.12, 0.1) })
      y -= emphasis ? 18 : 14
    }
  }
  lines.forEach((line, index) => draw(line, index < 3))
  page.drawText('Distance is not dependency. Missing evidence is not safety. Announced is not delivered.', { x: 48, y: 36, size: 8, font, color: rgb(0.33, 0.33, 0.3) })
  return Buffer.from(await document.save({ useObjectStreams: false }))
}
