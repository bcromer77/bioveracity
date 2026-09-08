export const MARCH_SOURCE = 'https://www.marchtowncouncil.gov.uk/anglian-water-march-water-recycling-centre-pausing-liming-work-for-the-summer-holidays/'
export const MARCH_CASE = {
  title: 'March: what was announced, and what still needs checking?',
  publisher: 'March Town Council, reproducing an Anglian Water statement',
  publicationDate: '2025-07-09',
  source: MARCH_SOURCE,
  locator: 'Opening operational-change statement and the paragraph beginning “To support the community”',
  summary: 'Anglian Water announced a summer pause at the Creek Road site, scheduled from 27 July to 22 September 2025. The statement anticipated less odour and traffic. It does not establish actual cessation, restart or measured improvement.',
  events: [
    { date: '2025-07-09', title: 'Pause announcement published', type: 'Publication of operator statement' },
    { date: '2025-07-27', title: 'Scheduled start of pause', type: 'Planned milestone' },
    { date: '2025-09-22', title: 'Scheduled end of pause', type: 'Planned milestone; restart unconfirmed' },
  ],
  questions: ['Did operations change on the announced dates?', 'Do suitable odour, wind and activity records show a change?', 'Was any improvement sustained after the scheduled pause?'],
} as const

export interface MarchStoredEvent { id: string; title: string; date: Date; datePrecision: string; sourceUrl: string | null; sourceDomain: string | null; description: string | null; evidenceClass: string; verified: boolean }
// Conservative exact matches only. Unknown titles remain in the audit report.
export function marchCorrection(event: MarchStoredEvent) {
  const date = event.date.toISOString().slice(0, 10)
  const starts = ['Anglian Water pauses lime-related waste treatment', 'Anglian Water pauses lime-related waste treatment (27 Jul - 22 Sep 2025)']
  const ends = ['Lime treatment resumes after summer pause']
  const start = date === '2025-07-27' && starts.includes(event.title)
  const end = date === '2025-09-22' && ends.includes(event.title)
  if (!start && !end) return null
  if (event.sourceUrl && event.sourceUrl !== MARCH_SOURCE) return null
  return { title: start ? 'Scheduled start of announced lime-treatment pause' : 'Scheduled end of announced pause; restart unconfirmed', description: `${MARCH_CASE.summary} Published ${MARCH_CASE.publicationDate}. Source location: ${MARCH_CASE.locator}.`, sourceUrl: MARCH_SOURCE, sourceDomain: 'marchtowncouncil.gov.uk', evidenceClass: 'O', verified: false }
}
