// Question prompts and coverage requirements, never pre-written factual answers.
export const INVESTIGATIONS = [
  { id: 'place', label: 'Explore a place', question: 'What is recorded around the River Cam?', category: 'all', required: ['Place identifiers', 'Dated local records', 'Source coverage'], examples: ['What is recorded around the River Cam?', 'Show me Milton wastewater works.', 'What do you hold for Fenland?', 'Which Cam reach does this identifier cover?', 'What evidence do you have outside Cambridge?'] },
  { id: 'change', label: 'What changed?', question: 'What changed around the River Cam?', category: 'all', required: ['Versioned records', 'Event dates and precision', 'Earlier and later sources'], examples: ['What changed around the River Cam?', 'What happened in April 2025?', 'Has the relocation plan changed since consent?', 'Show changes since the previous report.', 'What happened yesterday, and is your coverage current?'] },
  { id: 'claim', label: 'Check a claim', question: 'What claims are documented about Cambridge wastewater?', category: 'operational', required: ['Original report passage', 'Reporting period and entity', 'Claim scope'], examples: ['What claims are documented about Cambridge wastewater?', 'Is this a target or an achieved result?', 'Does the statement cover Milton or the whole company?', 'What baseline was used?', 'Can I check an annual report you do not hold?'] },
  { id: 'support', label: 'Find supporting evidence', question: 'What evidence supports River Cam water quality claims?', category: 'regulatory', required: ['Comparable measurements or findings', 'Matching location and period', 'Independent provenance'], examples: ['What evidence supports River Cam water quality claims?', 'What evidence conflicts with this statement?', 'Are these two reports independent?', 'Does an old classification describe today?', 'Can the available evidence establish causation?'] },
  { id: 'dependency', label: 'Find delivery blockers', question: 'What infrastructure dependencies affect Cambridge growth?', category: 'planning', required: ['Funding and delivery updates', 'Conditions and decisions', 'Documented dependencies'], examples: ['What infrastructure dependencies affect Cambridge growth?', 'Does consent mean the project is funded?', 'What must happen before occupation?', 'Which water supply date is this plan relying on?', 'Is this development connected to this treatment works?'] },
  { id: 'incident', label: 'Reconstruct an event', question: 'What records surround a Milton odour report?', category: 'community', required: ['Dated incident record', 'Operating and weather records', 'Monitoring coverage'], examples: ['What records surround a Milton odour report?', 'What happened in the preceding 72 hours?', 'Can normal operations coexist with an odour complaint?', 'Do you have hourly readings for this period?', 'Does a photograph establish the pollutant source?'] },
  { id: 'connection', label: 'Connect the places', question: 'What documented connections link Milton and the River Cam?', category: 'all', required: ['Source-backed relationships', 'Correct assets and water bodies', 'Relationship validity dates'], examples: ['What documented connections link Milton and the River Cam?', 'Which sites share this infrastructure?', 'Is this upstream or simply nearby?', 'Who operated this site at the time?', 'Are two similarly named places the same asset?'] },
  { id: 'gap', label: 'What needs checking?', question: 'What evidence is missing for this River Cam investigation?', category: 'all', required: ['Question scope', 'Sources searched', 'Missing evidence and next action'], examples: ['What evidence is missing for this River Cam investigation?', 'Which measurement would help resolve this?', 'Does no result mean no incident?', 'Who can supply the missing document?', 'Which conclusions require specialist review?'] },
] as const

type RecordSummary = { assetSlug: string; date: string; datePrecision?: string | null; sourceUrl: string | null }
export function investigationCoverage(records: RecordSummary[], selectedSlug: string | null) {
  const scoped = records.filter(r => !selectedSlug || r.assetSlug === selectedSlug)
  const dates = scoped.map(r => {
    if (!Number.isFinite(Date.parse(r.date))) return null
    if (r.datePrecision === 'year') return r.date.slice(0, 4)
    if (r.datePrecision === 'month') return r.date.slice(0, 7)
    if (r.datePrecision === 'day') return r.date.slice(0, 10)
    return null
  }).filter((d): d is string => d !== null).sort()
  return { records: scoped.length, linked: scoped.filter(r => r.sourceUrl && /^https:\/\//.test(r.sourceUrl)).length,
    from: dates[0] ?? null, to: dates[dates.length - 1] ?? null,
    unknownDates: scoped.length - dates.length }
}
