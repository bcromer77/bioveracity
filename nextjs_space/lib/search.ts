import { prisma } from '@/lib/prisma'
import { presentCategories } from '@/lib/categories'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'near', 'me', 'here', 'what', 'changed', 'change', 'is', 'of', 'in',
  'at', 'on', 'to', 'and', 'for', 'my', 'this', 'that', 'happening', 'happened', 'with',
  'around', 'whats', 'about', 'show', 'tell', 'find', 'any', 'are', 'there', 'has', 'have',
])

export interface LastChange {
  title: string
  date: Date
  changeType: string
  evidenceClass: string
}

export interface PlaceResult {
  id: string
  slug: string
  name: string
  type: string
  subtype: string | null
  region: string
  regionSlug: string
  status: string
  summary: string | null
  operatorName: string | null
  regulatorName: string | null
  jurisdiction: string | null
  latitude: number | null
  longitude: number | null
  priorityScore: number
  lastChange: LastChange | null
  eventCount: number
  gapCount: number
  divergenceCount: number
  categories: string[]
  score: number
}

// Pick the most meaningful recent change from an ordered (desc) event list.
export function pickLastChange(events: any[]): LastChange | null {
  if (!events?.length) return null
  const e =
    events.find((x: any) => x?.changeType === 'divergence') ||
    events.find((x: any) => x?.changeType === 'material_change') ||
    events[0]
  if (!e) return null
  return {
    title: e?.title ?? '',
    date: e?.date,
    changeType: e?.changeType ?? 'event',
    evidenceClass: e?.evidenceClass ?? 'A',
  }
}

function mapAsset(a: any, score: number): PlaceResult {
  return {
    id: a?.id,
    slug: a?.slug,
    name: a?.name,
    type: a?.type,
    subtype: a?.subtype ?? null,
    region: a?.region,
    regionSlug: a?.regionSlug,
    status: a?.status,
    summary: a?.summary ?? null,
    operatorName: a?.operatorName ?? null,
    regulatorName: a?.regulatorName ?? null,
    jurisdiction: a?.jurisdiction ?? null,
    latitude: a?.latitude ?? null,
    longitude: a?.longitude ?? null,
    priorityScore: a?.priorityScore ?? 0,
    lastChange: pickLastChange(a?.events ?? []),
    eventCount: a?._count?.events ?? 0,
    gapCount: a?._count?.evidenceGaps ?? 0,
    divergenceCount: a?._count?.divergences ?? 0,
    categories: presentCategories(a?.events ?? []),
    score,
  }
}

export async function searchPlaces(query: string, limit = 25): Promise<PlaceResult[]> {
  const assets = await prisma.asset.findMany({
    include: {
      events: { orderBy: { date: 'desc' }, take: 30 },
      _count: { select: { events: true, evidenceGaps: true, divergences: true } },
    },
  })

  const q = (query ?? '').trim().toLowerCase()
  const terms = q
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))

  // No usable query terms -> return everything by priority
  if (!q || (terms.length === 0 && q.length < 2)) {
    return assets
      .map((a: any) => mapAsset(a, a?.priorityScore ?? 0))
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, limit)
  }

  const scored = assets.map((a: any) => {
    const name = (a?.name ?? '').toLowerCase()
    const hay = [
      a?.name, a?.region, a?.type, a?.subtype, a?.operatorName,
      a?.regulatorName, a?.jurisdiction, a?.summary, a?.description,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    let score = 0
    if (q.length > 2 && hay.includes(q)) score += 12
    if (q.length > 2 && name.includes(q)) score += 10
    for (const t of terms) {
      if (name.includes(t)) score += 6
      else if (hay.includes(t)) score += 2
    }
    return mapAsset(a, score)
  })

  // Only genuine matches are returned. An honest "no result" is better than a
  // misleading fallback to unrelated priority assets (release-gate requirement).
  const hits = scored.filter((s) => s.score > 0)
  return hits
    .sort((a, b) => (b.score - a.score) || (b.priorityScore - a.priorityScore))
    .slice(0, limit)
}
