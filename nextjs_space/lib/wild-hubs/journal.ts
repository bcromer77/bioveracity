import { MONTHS, type Campaign, type Snapshot } from './domain'
import { type PublicContribution } from './contributions'

// “A year in the woods.” The journal is a twelve-month reading of a place: the
// venue's own editorial calendar (its story, month by month) with visitor
// observations settled into the month they were noticed. Every entry keeps its
// provenance and status — a community observation is never silently promoted to
// verified ecological evidence, and empty months are shown proudly, not padded.

export type JournalEntry = {
  id: string
  provenance: 'visitor-observation'
  status: string // the evidence class, in words
  category: string
  categoryLabel: string
  identified: boolean
  whatYouThink: string
  observedLabel: string
  coarseLocation: string
  photoUrl: string
}

export type JournalMonth = {
  index: number // 0-11
  name: string
  campaign: Campaign | null
  entries: JournalEntry[]
  empty: boolean
}

export type Journal = {
  months: JournalMonth[]
  total: number
}

// Which calendar month (Europe/Dublin) an observation belongs to. Uses the
// observed date where the visitor gave one, otherwise the date it was shared.
const dublinMonth = (iso: string): number => {
  const m = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Dublin',
    month: 'numeric',
  }).format(new Date(iso))
  return Number(m) - 1
}

const observedLabel = (c: PublicContribution): string => {
  const iso = c.observedAt ?? c.createdAt
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Dublin',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

export function buildJournal(
  snapshot: Snapshot,
  contributions: PublicContribution[],
): Journal {
  const campaigns = new Map<number, Campaign>()
  for (const c of snapshot.plan?.campaigns ?? []) campaigns.set(c.month - 1, c)

  const buckets: JournalEntry[][] = Array.from({ length: 12 }, () => [])
  for (const c of contributions) {
    const idx = dublinMonth(c.observedAt ?? c.createdAt)
    if (idx < 0 || idx > 11) continue
    buckets[idx].push({
      id: c.id,
      provenance: 'visitor-observation',
      status: 'Community observation',
      category: c.broadCategory,
      categoryLabel: c.categoryLabel,
      identified: c.identified,
      whatYouThink: c.whatYouThink,
      observedLabel: observedLabel(c),
      coarseLocation: c.coarseLocation,
      photoUrl: `/api/wild/contributions/${c.id}/photo`,
    })
  }

  const months: JournalMonth[] = MONTHS.map((name, index) => ({
    index,
    name,
    campaign: campaigns.get(index) ?? null,
    entries: buckets[index],
    empty: buckets[index].length === 0 && !campaigns.get(index),
  }))

  return { months, total: contributions.length }
}
