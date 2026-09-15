import { CAMBRIDGESHIRE_TOPICS } from '../wild-counties/cambridgeshire'
import type { Claim, District, Theme } from './model'

const links: Record<string, { district: District; taxa: string[]; themes: Theme[] }> = {
  'overhall-grove': { district: 'E07000012', taxa: ['meles meles', 'hyacinthoides non scripta'], themes: ['woodland'] },
  'anglesey-abbey': { district: 'E07000009', taxa: ['galanthus'], themes: ['gardens'] },
  'wicken-fen': { district: 'E07000009', taxa: ['cuculus canorus', 'falco subbuteo', 'odonata'], themes: ['wetland'] },
  'fulbourn-fen': { district: 'E07000012', taxa: ['orchidaceae'], themes: ['grassland', 'wetland'] },
  'gamlingay-wood': { district: 'E07000012', taxa: ['hyacinthoides non scripta', 'lepidoptera'], themes: ['woodland'] },
  'botanic-winter-garden': { district: 'E07000008', taxa: [], themes: ['gardens'] },
  'fen-drayton-lakes': { district: 'E07000012', taxa: [], themes: ['wetland', 'woodland', 'grassland'] },
  'ouse-fen': { district: 'E07000011', taxa: ['botaurus stellaris', 'panurus biarmicus'], themes: ['wetland'] },
  'nene-washes': { district: 'E07000010', taxa: [], themes: ['wetland', 'grassland'] },
  'ferry-meadows': { district: 'E06000031', taxa: [], themes: ['wetland'] },
  'holme-fen': { district: 'E07000011', taxa: [], themes: ['woodland', 'wetland'] },
  'woodwalton-fen': { district: 'E07000011', taxa: [], themes: ['wetland'] },
  'barnack-hills-and-holes': { district: 'E06000031', taxa: ['orchidaceae'], themes: ['grassland'] },
}
// District is a named-place discovery grouping, not a surveyed site boundary.
export const CLAIMS: Claim[] = CAMBRIDGESHIRE_TOPICS.map(t => ({
  id: `place:${t.slug}`, title: t.title, text: t.summary, locality: t.locality || '', placeSlug: t.slug, ...links[t.slug],
  kind: t.slug === 'anglesey-abbey' ? 'cultivated-display' : 'manager-account',
  source: { url: t.sourceUrl, publisher: t.publisher, locator: t.sourceLocator || '', checkedAt: t.checkedAt || '', publishedAt: t.sourcePublishedAt || null },
  season: t.season || 'Not established', access: t.access || 'Check with the manager', relatedSlugs: [...(t.relatedSlugs || [])],
}))

export const LNRS = {
  title: 'Cambridgeshire and Peterborough Local Nature Recovery Strategy',
  authority: 'Cambridgeshire and Peterborough Combined Authority',
  source: 'https://www.cambridgeshire.gov.uk/residents/climate-change-energy-and-environment/improving-the-natural-environment/cambridgeshire-and-peterborough-local-nature-recovery-strategy',
  map: 'https://experience.arcgis.com/experience/7c5242fdec7f433aa4ee4510383e3909',
  checkedAt: '2026-09-15',
  publication: 'December 2025 according to the County Council. Other reported publication/registration dates require reconciliation.',
  statement: 'The strategy combines biodiversity priorities with a local habitat map. Woodland, grassland and wetland are published map themes.',
  limitation: 'Connections below are thematic starting points. Site-specific mapped actions, funding, delivery and verified outcomes have not been established.',
} as const

export const SOURCE_GAPS = [
  { name: 'CPERC species records', state: 'Permission required', reason: 'Standard search terms do not permit public reuse. No records imported.' },
  { name: 'LNRS action polygons', state: 'Not imported', reason: 'Map identified; layer permissions and site-specific action matching remain unverified.' },
  { name: 'Planning documents and water measurements', state: 'Separate evidence collection', reason: 'Not included in these species results; a nearby record does not prove a relationship.' },
]
