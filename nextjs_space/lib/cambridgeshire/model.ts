export const DISTRICTS = {
  E07000008: 'Cambridge', E07000009: 'East Cambridgeshire', E07000010: 'Fenland',
  E07000011: 'Huntingdonshire', E07000012: 'South Cambridgeshire', E06000031: 'Peterborough',
} as const
export type District = keyof typeof DISTRICTS
export type Theme = 'woodland' | 'grassland' | 'wetland' | 'gardens'
export type Source = { url: string; publisher: string; locator: string; checkedAt: string; publishedAt: string | null }
export type Claim = {
  id: string; title: string; text: string; locality: string; district: District; placeSlug?: string;
  taxa: string[]; themes: Theme[]; kind: 'manager-account' | 'cultivated-display' | 'habitat-account';
  source: Source; season: string; access: string; relatedSlugs: string[];
}
export type Coverage = {
  district: District; source: 'gbif'; state: 'complete' | 'partial' | 'unavailable';
  inspected: number; accepted: number; rejected: number; duplicates: number; nextOffset: number;
  checkedAt: string; reason: string;
}
// Public projection deliberately contains no occurrence IDs, precise locations,
// recorder identities or raw passages. Dataset citations remain available.
export type OccurrenceGroup = {
  id: string; district: District; taxon: string; count: number;
  firstYear: number; lastYear: number; licence: string; attribution: string; datasetKey: string; taxonKeys: string[];
}
export type Snapshot = {
  version: 1; generatedAt: string; boundarySource: string;
  coverage: Coverage[]; groups: OccurrenceGroup[];
}
export const BOUNDARY_SERVICE = 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_May_2024_Boundaries_UK_BGC/FeatureServer/0'
export const SNAPSHOT_LIMIT = 10 * 1024 * 1024
export const isDistrict = (s: string): s is District => Object.prototype.hasOwnProperty.call(DISTRICTS, s)
export const normalise = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export const TAXA: Record<string, readonly string[]> = {
  'meles meles': ['badger', 'badgers', 'european badger', 'meles meles'],
  galanthus: ['snowdrop', 'snowdrops', 'galanthus', 'galanthus nivalis'],
  'hyacinthoides non scripta': ['bluebell', 'bluebells', 'hyacinthoides non scripta'],
  orchidaceae: ['orchid', 'orchids', 'orchidaceae'],
  odonata: ['dragonfly', 'dragonflies', 'damselfly', 'damselflies', 'odonata'],
  'cuculus canorus': ['cuckoo', 'cuckoos', 'cuculus canorus'],
  'falco subbuteo': ['hobby', 'hobbies', 'falco subbuteo'],
  'botaurus stellaris': ['bittern', 'bitterns', 'botaurus stellaris'],
  'panurus biarmicus': ['bearded tit', 'bearded tits', 'panurus biarmicus'],
  'lutra lutra': ['otter', 'otters', 'lutra lutra'],
  chiroptera: ['bat', 'bats', 'chiroptera'],
  lepidoptera: ['butterfly', 'butterflies', 'moth', 'moths', 'lepidoptera'],
  fungi: ['fungi', 'fungus', 'mushrooms'],
}
export const containsPhrase = (text: string, term: string) => (` ${normalise(text)} `).includes(` ${normalise(term)} `)
export function resolveTaxa(q: string): string[] {
  return Object.entries(TAXA).filter(([, names]) => names.some(n => containsPhrase(q, n))).map(([key]) => key)
}
