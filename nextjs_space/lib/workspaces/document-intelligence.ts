import { createHash } from 'node:crypto'
import { WorkspaceError } from './service'

export const INTELLIGENCE_VERSION = 'document-text-checks/1'
export const COVERAGE_CHECKS = [
  { id: 'bats', question: 'Does the report mention bats or bat surveys?', terms: ['bat', 'bats', 'pipistrelle', 'daubenton', 'chiroptera', 'chiropteran', 'myotis', 'roost'] },
  { id: 'flooding', question: 'Does it mention flooding?', terms: ['flood', 'flooding', 'flooded', 'floodplain', 'inundation', 'waterlogged'] },
  { id: 'water', question: 'Does it mention water quality or ecological status?', terms: ['water quality', 'ecological status', 'wfd', 'water framework'] },
  { id: 'survey_limits', question: 'Does it mention survey limitations?', terms: ['limitation', 'limitations', 'survey scope', 'access restriction', 'access restrictions', 'survey coverage'] },
  { id: 'season', question: 'Does it mention survey timing or season?', terms: ['survey date', 'survey dates', 'season', 'seasonal', 'winter', 'summer', 'spring', 'autumn', 'september'] },
  { id: 'cumulative', question: 'Does it mention cumulative or in-combination effects?', terms: ['cumulative', 'in-combination', 'in combination'] },
] as const
export type IntelligenceDocument = { id: string; name: string; hash: string; status: string; warnings: string[]; parserVersion: string; superseded: boolean }
export type IntelligencePassage = { id: string; documentId: string; locator: string; text: string }
export type Citation = { passageId: string; documentId: string; documentName: string; documentHash: string; locator: string; quote: string; start: number; end: number; superseded: boolean }
type Statement = { topic: string; polarity: 'positive' | 'negative'; source: Citation }

// Deliberately narrow wording rules, not semantic understanding or scientific conclusions.
// New domains/rules need counterexamples and source-pair tests before being enabled.
const bat = '(?:bats?|pipistrelles?|chiropteran species|chiroptera|mammal or chiropteran species)'
const rules = [
  { topic: 'Bat observations', negative: new RegExp(`\\bno\\s+(?:protected\\s+)?${bat}\\s+(?:were\\s+|was\\s+)?(?:recorded|observed|detected)\\b`, 'i'), positive: new RegExp(`\\b${bat}\\s+(?:were\\s+|was\\s+)?(?:recorded|observed|detected)\\b`, 'i') },
  { topic: 'Flood observations', negative: /\bno flooding (?:was )?(?:recorded|observed|reported)\b/i, positive: /\bflooding (?:was )?(?:recorded|observed|reported)\b/i },
] as const

function citation(p: IntelligencePassage, d: IntelligenceDocument, start: number, end: number): Citation {
  return { passageId: p.id, documentId: d.id, documentName: d.name, documentHash: d.hash, locator: p.locator, quote: p.text.slice(start, end), start, end, superseded: d.superseded }
}
function hasTerm(text: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text)
}

export function analyseDocumentText(input: {
  workspaceId: string; caseId: string; targetDocumentId: string; checkIds: string[];
  documents: IntelligenceDocument[]; passages: IntelligencePassage[];
}) {
  const { documents, passages, targetDocumentId, checkIds } = input
  if (!Array.isArray(checkIds) || checkIds.length < 1 || checkIds.length > COVERAGE_CHECKS.length || new Set(checkIds).size !== checkIds.length || checkIds.some(id => !COVERAGE_CHECKS.some(c => c.id === id))) throw new WorkspaceError(400, 'Select valid document coverage checks.')
  if (documents.length > 100 || passages.length > 1500 || passages.reduce((n, p) => n + p.text.length, 0) > 3600000) throw new WorkspaceError(413, 'Case text exceeds analysis limits. No analysis was completed.')
  const byDocument = new Map(documents.map(d => [d.id, d]))
  const target = byDocument.get(targetDocumentId)
  if (!target) throw new WorkspaceError(404, 'Document unavailable in this case')
  if (new Set(passages.map(p => p.id)).size !== passages.length || passages.some(p => !byDocument.has(p.documentId))) throw new WorkspaceError(422, 'Inconsistent source snapshot. No analysis was completed.')
  const targetPassages = passages.filter(p => p.documentId === targetDocumentId)
  const unreadable = documents.filter(d => d.status !== 'PARSED' || !passages.some(p => p.documentId === d.id && p.text.trim()))
  const coverage = checkIds.map(id => {
    const check = COVERAGE_CHECKS.find(c => c.id === id)!
    const matches = targetPassages.filter(p => check.terms.some(term => hasTerm(p.text, term)))
    const limited = unreadable.some(d => d.id === target.id) || target.warnings.length > 0
    return { id, question: check.question, status: matches.length ? 'MENTION_FOUND' : limited ? 'UNASSESSABLE' : 'NOT_LOCATED_IN_EXTRACTED_TEXT',
      explanation: matches.length ? 'Related wording was found. This does not establish that the question is adequately answered.' : limited ? 'Extraction is missing or has warnings. Review the original before assessing coverage.' : 'No selected terms were located in the extracted text. Different wording, images, tables or extraction gaps may contain the information. This is a review question, not proof of omission or absence.',
      matchingPassages: matches.length, searchedTerms: [...check.terms],
      sources: matches.slice(0, 3).map(p => {
        const term = check.terms.find(t => hasTerm(p.text, t))!
        const offset = p.text.toLowerCase().indexOf(term)
        return citation(p, target, Math.max(0, offset - 100), Math.min(p.text.length, offset + term.length + 200))
      }),
    }
  })
  const statements: Statement[] = []
  let skippedLongStatements = 0
  let statementsTruncated = false
  for (const p of passages) {
    const d = byDocument.get(p.documentId)!
    for (const segment of p.text.matchAll(/[^.!?\n]+[.!?]?/g)) {
      const quote = segment[0].trim()
      if (!quote) continue
      if (quote.length > 1000) { skippedLongStatements++; continue }
      // Avoid turning conditional, uncertain, or explicitly negated positive wording
      // into observations. More complex language remains a manual review task.
      if (/\b(?:if|may|might|could|would|should|not|never|neither|without|whether|unlikely|hypothetical)\b/i.test(quote) || quote.endsWith('?')) continue
      const start = segment.index! + segment[0].indexOf(quote)
      for (const rule of rules) {
        const negative = rule.negative.test(quote)
        if (!negative && (/\bno\b/i.test(quote) || !rule.positive.test(quote))) continue
        if (statements.length >= 1000) { statementsTruncated = true; continue }
        statements.push({ topic: rule.topic, polarity: negative ? 'negative' : 'positive', source: citation(p, d, start, start + quote.length) })
      }
    }
  }
  const comparisons: { id: string; kind: string; topic: string; explanation: string; sources: Citation[]; questions: string[]; reviewStatus: 'UNREVIEWED' }[] = []
  let totalCandidates = 0
  // Each opposing pair is considered once. Only pairs involving the selected report
  // are returned; identical source bytes never count as independent corroboration.
  for (let i = 0; i < statements.length; i++) for (let j = i + 1; j < statements.length; j++) {
    const a = statements[i], b = statements[j]
    if (a.topic !== b.topic || a.polarity === b.polarity || (a.source.documentId !== target.id && b.source.documentId !== target.id)) continue
    if (a.source.documentId !== b.source.documentId && a.source.documentHash === b.source.documentHash) continue
    totalCandidates++
    if (comparisons.length >= 30) continue
    const sameDocument = a.source.documentId === b.source.documentId
    comparisons.push({ id: createHash('sha256').update(JSON.stringify([INTELLIGENCE_VERSION, a.source, b.source])).digest('hex').slice(0, 24),
      kind: sameDocument ? 'POTENTIAL_INTERNAL_CONTRADICTION' : 'POTENTIAL_DOCUMENT_CONFLICT', topic: a.topic, reviewStatus: 'UNREVIEWED',
      explanation: 'These passages use opposing observation wording. They may describe different places, periods, survey methods, or quoted third-party claims. A contradiction has not been established.',
      sources: [a.source, b.source], questions: ['Do both passages refer to the same place and survey area?', 'Do the dates and observation periods overlap?', 'Are the species, methods and survey conditions comparable?', 'Is either passage quoting an earlier claim, amendment or unverified observation?'],
    })
  }
  const snapshot = createHash('sha256').update(JSON.stringify({ documents: [...documents].sort((a,b) => a.id.localeCompare(b.id)), passages: [...passages].sort((a,b) => a.id.localeCompare(b.id)) })).digest('hex')
  return { version: INTELLIGENCE_VERSION, mode: 'LOCAL_TEXT_RULES', workspaceId: input.workspaceId, caseId: input.caseId, targetDocumentId, snapshot,
    status: unreadable.length || documents.some(d => d.warnings.length) || skippedLongStatements || statementsTruncated ? 'PARTIAL' : 'COMPLETED_TEXT_CHECKS',
    scope: { documents: documents.map(d => ({ ...d, extractedPassages: passages.filter(p => p.documentId === d.id).length })), passagesChecked: passages.length, externalRecordsRetrieved: false },
    coverage, comparisons, totalCandidates, comparisonsTruncated: totalCandidates > comparisons.length || statementsTruncated, skippedLongStatements, statementsTruncated,
    limitations: ['Limited wording checks; no semantic AI analysis or completeness certification.', 'Only documents already held in the selected private case were checked. A source URL does not make a document a verified public record.', 'No species, flood or planning feeds were queried. Missing records do not establish absence.', 'Parser output may omit images, tables or pages. Even PARSED does not certify complete extraction.', 'No findings does not mean no conflicts. Findings are not accepted evidence and are not added to audit exports.'],
  }
}
