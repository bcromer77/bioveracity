// Plain-language "What do you want to check?" categories.
//
// These are the things people actually notice — water, smells, sewage, fish, etc.
// They are derived at the PRESENTATION layer by keyword-matching the title,
// description and eventType of records already on the page. Nothing here
// fabricates data or writes to the database: an event that matches no category
// simply appears under "Everything".

export interface PlainCategory {
  id: string
  label: string
  // lucide-react icon name (resolved by the component)
  icon: string
  keywords: string[]
  // eventType values (from the Event model) that imply this category
  eventTypes?: string[]
}

export const PLAIN_CATEGORIES: PlainCategory[] = [
  {
    id: 'water',
    label: 'Water',
    icon: 'Droplets',
    keywords: [
      'water quality', 'water', 'phosphorus', 'phosphate', 'nitrogen', 'nitrate',
      'nutrient', 'dissolved oxygen', 'turbidity', 'algae', 'algal', 'phycocyanin',
      'eutrophication', 'cyanobacteria', 'bathing', 'ammonia', 'chlorophyll',
    ],
  },
  {
    id: 'leaks',
    label: 'Leaks & discharges',
    icon: 'Waves',
    keywords: [
      'discharge', 'leak', 'spill', 'spillage', 'effluent', 'outfall', 'overflow',
      'release', 'runoff', 'run-off', 'seepage', 'pollution incident',
    ],
  },
  {
    id: 'sewage',
    label: 'Sewage',
    icon: 'Factory',
    keywords: [
      'sewage', 'wastewater', 'waste water', 'treatment plant', 'treatment works',
      'storm overflow', 'combined sewer', 'cso', 'sludge', 'foul', 'septic', 'wwtw', 'wrc',
    ],
    eventTypes: [],
  },
  {
    id: 'air',
    label: 'Air & emissions',
    icon: 'Wind',
    keywords: [
      'air quality', 'air', 'emission', 'emissions', 'gas', 'gaseous', 'voc',
      'ammonia', 'methane', 'stack', 'flue', 'greenhouse', 'nox', 'sox', 'particulate matter',
    ],
  },
  {
    id: 'smells',
    label: 'Smells',
    icon: 'AlertCircle',
    keywords: ['odour', 'odor', 'smell', 'stench', 'malodour', 'nuisance odour'],
  },
  {
    id: 'noise',
    label: 'Noise & vibration',
    icon: 'Volume2',
    keywords: ['noise', 'vibration', 'acoustic', 'sound'],
  },
  {
    id: 'dust',
    label: 'Dust',
    icon: 'CloudFog',
    keywords: ['dust', 'particulate', 'airborne particle'],
  },
  {
    id: 'fish',
    label: 'Fish & ecology',
    icon: 'Fish',
    keywords: [
      'fish', 'fishery', 'fisheries', 'ecology', 'ecological', 'habitat', 'species',
      'wildlife', 'biodiversity', 'kill', 'mortality', 'shellfish', 'eel', 'salmon',
      'spawning', 'invertebrate', 'ecosystem', 'sac', 'spa', 'designated site',
    ],
  },
  {
    id: 'flooding',
    label: 'Flooding',
    icon: 'CloudRain',
    keywords: ['flood', 'flooding', 'inundation', 'tidal surge', 'defence'],
  },
  {
    id: 'projects',
    label: 'Projects & permits',
    icon: 'HardHat',
    keywords: [
      'permit', 'licence', 'license', 'planning', 'consent', 'authorisation',
      'authorization', 'project', 'construction', 'capital', 'development', 'upgrade',
      'dredging', 'application', 'foreshore', 'scheme', 'contract',
    ],
    eventTypes: ['planning', 'construction'],
  },
  {
    id: 'regulatory',
    label: 'Regulatory activity',
    icon: 'Scale',
    keywords: [
      'inspection', 'enforcement', 'investigation', 'prosecution', 'notice',
      'non-compliance', 'noncompliance', 'breach', 'penalty', 'fine', 'audit',
      'compliance', 'variation', 'review', 'epa', 'environment agency', 'niea', 'sepa',
    ],
    eventTypes: ['regulatory'],
  },
]

export const CATEGORY_BY_ID: Record<string, PlainCategory> = Object.fromEntries(
  PLAIN_CATEGORIES.map((c) => [c.id, c]),
)

interface Categorisable {
  title?: string | null
  description?: string | null
  eventType?: string | null
}

// Derive the plain-language categories a single record belongs to.
// Returns an array of category ids (may be empty — such records show only
// under "Everything").
export function deriveCategories(item: Categorisable): string[] {
  const hay = `${item?.title ?? ''} ${item?.description ?? ''}`.toLowerCase()
  const et = (item?.eventType ?? '').toLowerCase()
  const matched = new Set<string>()
  for (const cat of PLAIN_CATEGORIES) {
    if (cat.eventTypes && et && cat.eventTypes.includes(et)) {
      matched.add(cat.id)
    }
    for (const kw of cat.keywords) {
      if (hay.includes(kw)) {
        matched.add(cat.id)
        break
      }
    }
  }
  return Array.from(matched)
}

// True if a record belongs to the given category (or the category is 'all').
export function itemInCategory(item: Categorisable, categoryId: string): boolean {
  if (!categoryId || categoryId === 'all') return true
  return deriveCategories(item).includes(categoryId)
}

// Union of categories present across a set of records — used to show only the
// chips that actually have evidence behind them.
export function presentCategories(items: Categorisable[]): string[] {
  const present = new Set<string>()
  for (const it of items ?? []) {
    for (const c of deriveCategories(it)) present.add(c)
  }
  // Preserve the canonical order defined above.
  return PLAIN_CATEGORIES.filter((c) => present.has(c.id)).map((c) => c.id)
}
