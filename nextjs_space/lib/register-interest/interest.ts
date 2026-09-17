// PR54 — Register interest validation and normalisation.
// A submission is demand capture only: a raised hand, never an account,
// workspace, WildHub, subscription or payment. Keep this file the single source
// of the controlled category and source vocabularies so nothing downstream has
// to trust an arbitrary string from the client.

// Controlled interest categories. The key is stored; the label is shown.
export const INTEREST_CATEGORIES = [
  { value: 'wild-business', label: 'Wild Counties / a business or venue' },
  { value: 'professional', label: 'Professional / ecologist' },
  { value: 'planning-bng', label: 'Planning / development / BNG' },
  { value: 'community-school', label: 'Community / school' },
  { value: 'other', label: 'Something else' },
] as const

export type InterestCategory = (typeof INTEREST_CATEGORIES)[number]['value']
const CATEGORY_VALUES = new Set<string>(INTEREST_CATEGORIES.map((c) => c.value))

// Controlled originating surfaces. Anything unrecognised collapses to 'general'
// so demand can be attributed without trusting arbitrary source strings.
export const INTEREST_SOURCES = ['wild', 'professionals', 'bng', 'general'] as const
export type InterestSource = (typeof INTEREST_SOURCES)[number]
const SOURCE_VALUES = new Set<string>(INTEREST_SOURCES)

export function normaliseSource(raw: unknown): InterestSource {
  return typeof raw === 'string' && SOURCE_VALUES.has(raw) ? (raw as InterestSource) : 'general'
}

export interface InterestLeadData {
  name: string
  email: string
  organisation: string | null
  category: InterestCategory
  message: string | null
  source: InterestSource
}

export class InterestError extends Error {}

// Server-side validation with length limits and email normalisation. Throws
// InterestError with a visitor-safe message on any invalid or oversized input.
export function parseInterest(raw: unknown): InterestLeadData {
  if (!raw || typeof raw !== 'object') throw new InterestError('Please check your details.')
  const data = raw as Record<string, unknown>

  const str = (key: string, max: number): string => {
    const v = data[key]
    if (v !== undefined && v !== null && typeof v !== 'string') throw new InterestError('Please check your details.')
    const result = typeof v === 'string' ? v.trim() : ''
    if (result.length > max) throw new InterestError('One of the fields is too long.')
    return result
  }

  // Honeypot: a real person leaves this hidden field empty.
  if (str('company', 200)) throw new InterestError('Unable to accept this submission.')

  const name = str('name', 120)
  const email = str('email', 254).toLowerCase()
  const organisation = str('organisation', 160)
  const message = str('message', 2000)
  const categoryRaw = str('category', 40)
  const source = normaliseSource(data.source)

  if (!name) throw new InterestError('Please add your name.')
  if (!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InterestError('Please add a valid email address.')
  if (!CATEGORY_VALUES.has(categoryRaw)) throw new InterestError('Please choose what best describes you.')

  return {
    name,
    email,
    organisation: organisation || null,
    category: categoryRaw as InterestCategory,
    message: message || null,
    source,
  }
}

export function categoryLabel(value: string): string {
  return INTEREST_CATEGORIES.find((c) => c.value === value)?.label ?? value
}
