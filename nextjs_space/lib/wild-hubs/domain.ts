import { getWildCounty } from '../wild-counties/counties'

export class HubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
export const KINDS = [
  'hotel',
  'guesthouse',
  'food',
  'craft',
  'attraction',
  'community',
  'other',
] as const
export type Profile = {
  name: string
  county: string
  kind: (typeof KINDS)[number]
  story: string
  website: string
  interests: string[]
}
export type Trend = {
  term: string
  geography: string
  sourceUrl: string
  importedAt: string
  periodStart: string
  periodEnd: string
  seriesLabel: string
  interval: 'Day' | 'Week' | 'Month'
  points: { date: string; value: number | null; lessThanOne: boolean }[]
}
export type Source = {
  title: string
  publisher: string
  url: string
  scope: string
  caveat: string
  publicationDate: null
  eventDate: null
}
export type Campaign = {
  month: number
  title: string
  introduction: string
  activity: string
  caption: string
  planningNote: string
}
export type Plan = {
  year: number
  generatedAt: string
  basis: 'editorial-calendar' | 'editorial-calendar-with-imported-trends'
  campaigns: Campaign[]
  sources: Source[]
  trend: Trend | null
  suggestedLeadMonth: number | null
}
export type Snapshot = {
  profile: Profile
  plan: Plan
  photoIds: string[]
  approvedAt: string
  reviewedAt?: string
  version: number
}
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
export function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new HubError(400, 'Please check the details.')
  return v as Record<string, unknown>
}
export function text(v: unknown, max: number, required = true): string {
  if (
    typeof v !== 'string' ||
    v.length > max ||
    (required && !v.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
  )
    throw new HubError(
      400,
      'Please complete the required fields within their limits.',
    )
  return v.trim()
}
export function publicUrl(value: unknown): string {
  const v = text(value, 500, false)
  if (!v) return ''
  try {
    const u = new URL(v)
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.hostname === 'localhost' ||
      !u.hostname.includes('.') ||
      /^\[|^\d+\./.test(u.hostname)
    )
      throw Error()
    return u.toString()
  } catch {
    throw new HubError(400, 'Use a public HTTPS website address.')
  }
}
export function profileInput(raw: unknown): Profile {
  const v = record(raw)
  const county = text(v.county, 60),
    kind = text(v.kind, 30)
  if (!getWildCounty(county) || !KINDS.includes(kind as Profile['kind']))
    throw new HubError(400, 'Choose a county and venue type.')
  if (
    !Array.isArray(v.interests) ||
    v.interests.length > 4 ||
    v.interests.some((x) => !['nature', 'coast', 'food', 'craft'].includes(x))
  )
    throw new HubError(400, 'Choose up to four interests.')
  return {
    name: text(v.name, 100),
    county,
    kind: kind as Profile['kind'],
    story: text(v.story, 2000),
    website: publicUrl(v.website),
    interests: [...new Set(v.interests as string[])],
  }
}
// Parse a single-series Google Trends "Interest over time" CSV. Preserve censored
// values; do not turn <1 or missing data into invented counts or zeros.
function csvLine(line: string): string[] {
  const out: string[] = []
  let cell = '',
    quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = !quoted
    } else if (c === ',' && !quoted) {
      out.push(cell.trim())
      cell = ''
    } else cell += c
  }
  if (quoted) throw new HubError(400, 'Unsupported CSV quoting.')
  out.push(cell.trim())
  return out
}
export function parseTrends(raw: unknown, now = new Date()): Trend {
  const input = record(raw),
    csv = text(input.csv, 64000),
    term = text(input.term, 100),
    geography = text(input.geography, 100)
  const sourceUrl = publicUrl(input.sourceUrl)
  if (new URL(sourceUrl).hostname !== 'trends.google.com')
    throw new HubError(400, 'Add the original Google Trends explore link.')
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((x) => x.trim())
  const header = lines.findIndex((x) => /^(Week|Day|Month),/.test(x))
  if (header < 0 || csvLine(lines[header]).length !== 2)
    throw new HubError(
      400,
      'Export one search term from Google Trends: Interest over time, in English.',
    )
  const points: Trend['points'] = []
  for (const line of lines.slice(header + 1)) {
    const cells = csvLine(line)
    if (cells.length !== 2)
      throw new HubError(
        400,
        'This CSV must have exactly one date and one interest column.',
      )
    const [date, rawValue] = cells
    if (
      !/^\d{4}-\d{2}(-\d{2})?$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, date.length) !== date
    )
      throw new HubError(400, 'Invalid Trends date.')
    if (date > now.toISOString().slice(0, date.length))
      throw new HubError(400, 'Trends observations cannot be future dates.')
    if (points.some((p) => p.date === date))
      throw new HubError(400, 'Duplicate Trends date.')
    const lessThanOne = rawValue === '<1',
      value = rawValue === '' || lessThanOne ? null : Number(rawValue)
    if (
      value !== null &&
      (!/^\d+(\.\d+)?$/.test(rawValue) || value < 0 || value > 100)
    )
      throw new HubError(
        400,
        'Expected relative interest between 0 and 100, blank, or <1.',
      )
    points.push({ date, value, lessThanOne })
  }
  if (points.length < 2 || points.length > 2000)
    throw new HubError(400, 'Use between 2 and 2,000 dated observations.')
  points.sort((a, b) => a.date.localeCompare(b.date))
  return {
    term,
    geography,
    sourceUrl,
    seriesLabel: csvLine(lines[header])[1],
    interval: csvLine(lines[header])[0] as Trend['interval'],
    importedAt: now.toISOString(),
    periodStart: points[0].date,
    periodEnd: points.at(-1)!.date,
    points,
  }
}
export function trendSummary(trend: Trend | null): string {
  if (!trend)
    return 'No Google Trends data imported. Themes are editorial suggestions.'
  const exact = trend.points.filter((p) => p.value !== null)
  if (!exact.length)
    return `Imported Google Trends: ${trend.term}, ${trend.geography}. No exact values available for comparison.`
  const max = Math.max(...exact.map((p) => p.value!)),
    peaks = exact.filter((p) => p.value === max)
  if (max === 0)
    return `Imported Google Trends: ${trend.term}, ${trend.geography}. All exact observations are zero; this does not establish no demand.`
  return `Imported Google Trends: ${trend.term}, ${trend.geography}. Highest recorded relative interest ${max}/100 on ${peaks[0].date}${peaks.length > 1 ? ' (tied)' : ''}. This is historical search interest, not bookings or a forecast.`
}
const THEMES = [
  [
    'A slower start',
    'Notice the small details',
    'Find three different textures or shapes without picking or collecting anything.',
  ],
  [
    'Time together',
    'A different kind of family break',
    'Choose something you are curious about and find its story in a source.',
  ],
  [
    'A fresh perspective',
    'Look again at a familiar place',
    'Compare the colours you can see. What would you like to learn about them?',
  ],
  [
    'Small discoveries',
    'Make room for curiosity',
    'Sketch a leaf, a shell or a pattern you can observe safely. Leave it where it is.',
  ],
  [
    'The landscape in detail',
    'Look beyond the usual view',
    'Find a landscape feature in one of the linked sources. What does the source actually say?',
  ],
  [
    'Longer stories',
    'Take time to explore',
    'Ask each person to choose one detail to remember about the visit.',
  ],
  [
    'A family field notebook',
    'Turn a visit into a discovery',
    'Record what you noticed, where you noticed it and what remains unidentified.',
  ],
  [
    'A different day out',
    'Bring your curiosity',
    'Choose one local story and a question to explore together.',
  ],
  [
    'A quieter escape',
    'See the place at your own pace',
    'Compare a present-day observation with a dated source. Keep the two dates separate.',
  ],
  [
    'Patterns of change',
    'Notice what changes',
    'Look for differences in colour or texture. A change is an observation, not proof of its cause.',
  ],
  [
    'Stories for slower days',
    'Discover from indoors, too',
    'Use the linked reading to learn about a landscape without needing to visit a sensitive site.',
  ],
  [
    'A year of discovery',
    'Share what you learned',
    'Choose your favourite discovery and one unanswered question for next time.',
  ],
] as const
export function generatePlan(
  profile: Profile,
  year: number,
  trend: Trend | null,
  now = new Date(),
): Plan {
  if (
    !Number.isInteger(year) ||
    year < now.getUTCFullYear() ||
    year > now.getUTCFullYear() + 1
  )
    throw new HubError(400, 'Choose this year or next year.')
  const county = getWildCounty(profile.county)!
  const interest = profile.interests.length
    ? profile.interests.join(', ')
    : 'the local landscape'
  const monthly = MONTHS.map((_, i) => {
    const observations =
      trend?.points.filter(
        (p) => Number(p.date.slice(5, 7)) === i + 1 && p.value !== null,
      ) || []
    return {
      month: i + 1,
      n: observations.length,
      mean: observations.length
        ? observations.reduce((sum, p) => sum + p.value!, 0) /
          observations.length
        : null,
    }
  })
  const ranked = monthly
    .filter((m) => m.mean !== null)
    .sort((a, b) => b.mean! - a.mean!)
  const lead =
    ranked.length > 1 &&
    ranked[0].mean! > 0 &&
    ranked[0].mean !== ranked[1].mean
      ? ranked[0].month
      : null
  const stay =
    profile.kind === 'hotel' || profile.kind === 'guesthouse'
      ? 'your stay'
      : 'your visit'
  return {
    year,
    generatedAt: now.toISOString(),
    basis: trend
      ? 'editorial-calendar-with-imported-trends'
      : 'editorial-calendar',
    trend,
    suggestedLeadMonth: lead,
    // Legacy citation fields stay readable, but new editions do not copy webpage summaries.
    sources: [],
    campaigns: THEMES.map(([title, angle, activity], i) => ({
      month: i + 1,
      title: `${title} at ${profile.name}`,
      introduction: `${angle}. Explore ${interest} through local stories and make ${stay} your own.`,
      activity,
      planningNote:
        trend && monthly[i].mean !== null
          ? `${trend.term}: mean historical relative interest ${monthly[i].mean!.toFixed(1)}/100 across ${monthly[i].n} exact observations dated in ${MONTHS[i]}. ${MONTHS[i]} is a planning lead to assess, not a demand forecast. ${trend.geography}; ${trend.periodStart} to ${trend.periodEnd}.`
          : 'Editorial theme. No exact Google Trends observations for this calendar month.',
      caption: `${MONTHS[i]} inspiration from ${profile.name}: ${angle.toLowerCase()}. Explore our ecology hub for local stories and ideas. See our website for visitor information.`,
    })),
  }
}
export function editCampaigns(plan: Plan, raw: unknown): Plan {
  if (!Array.isArray(raw) || raw.length !== 12)
    throw new HubError(400, 'A plan needs all twelve months.')
  return {
    ...plan,
    campaigns: raw.map((item, i) => {
      const v = record(item)
      if (v.month !== i + 1)
        throw new HubError(400, 'Keep months in calendar order.')
      return {
        month: i + 1,
        planningNote: plan.campaigns[i].planningNote,
        title: text(v.title, 180),
        introduction: text(v.introduction, 1000),
        activity: text(v.activity, 600),
        caption: text(v.caption, 1000),
      }
    }),
  }
}
export function activeCampaign(plan: Plan, now = new Date()): Campaign | null {
  const [day, month, year] = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Dublin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(now)
    .split('/')
    .map(Number)
  return day && year === plan.year
    ? plan.campaigns.find((c) => c.month === month) || null
    : null
}
