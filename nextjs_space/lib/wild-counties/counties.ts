import type { BusinessCandidate, WildCounty, WildTopic } from './types'

const planned = (
  slug: string,
  name: string,
  province: WildCounty['province'],
  jurisdiction: WildCounty['jurisdiction'] = 'Ireland',
  aliases?: readonly string[],
): WildCounty => ({
  slug,
  name,
  brandName: `Wild ${name.replace(/^County /, '').replace(' / Londonderry', '')}`,
  province,
  jurisdiction,
  status: 'planned',
  aliases,
  topics: [],
  businessCandidates: [],
})

const downTopics: readonly WildTopic[] = [
  {
    slug: 'fens',
    title: 'Lecale Fens',
    summary: 'Four protected calcium-rich, spring-fed fen sites with reedbeds, pools and specialised wetland vegetation.',
    sourceUrl: 'https://www.daera-ni.gov.uk/protected-areas/lecale-fens',
    publisher: 'DAERA',
    evidenceScope: 'county',
    reviewStatus: 'source-reviewed',
  },
  {
    slug: 'oysters',
    title: 'Oysters and shellfish waters',
    summary: 'Official shellfish-water action material for named parts of Strangford Lough.',
    sourceUrl: 'https://www.daera-ni.gov.uk/sites/default/files/publications/daera/shellfish-action-plans-2019-proof-2.PDF',
    publisher: 'DAERA',
    evidenceScope: 'regional',
    reviewStatus: 'source-reviewed',
    caveat: 'The source concerns shellfish-water management; it is not a visitor safety notice or a claim about every oyster in the Lough.',
  },
  {
    slug: 'owls',
    title: 'Barn owl context',
    summary: 'DAERA publishes a Northern Ireland species action plan for the barn owl.',
    sourceUrl: 'https://www.daera-ni.gov.uk/publications/northern-ireland-species-action-plan-barn-owl',
    publisher: 'DAERA',
    evidenceScope: 'national-context',
    reviewStatus: 'source-reviewed',
    caveat: 'This source does not establish a current barn owl record at a named County Down business or visitor site.',
  },
]

const downCandidates: readonly BusinessCandidate[] = []

const kilkennyTopics: readonly WildTopic[] = [
  {
    slug: 'river-nore',
    title: 'River Nore',
    summary: 'Protected river habitats and qualifying species recorded for the wider River Barrow and River Nore SAC.',
    sourceUrl: 'https://www.npws.ie/protected-sites/sac/002162',
    publisher: 'National Parks & Wildlife Service',
    evidenceScope: 'regional',
    reviewStatus: 'source-reviewed',
    caveat: 'A qualifying interest for the wider SAC is not automatically a record at a particular business or river access point.',
  },
  {
    slug: 'otters',
    title: 'Otters',
    summary: 'Otter is an official qualifying interest of the River Barrow and River Nore SAC.',
    sourceUrl: 'https://www.npws.ie/protected-sites/sac/002162',
    publisher: 'National Parks & Wildlife Service',
    evidenceScope: 'regional',
    reviewStatus: 'source-reviewed',
    caveat: 'Precise or sensitive wildlife locations are not exposed, and this is not a sighting promise.',
  },
]

const kilkennyCandidates: readonly BusinessCandidate[] = []

export const WILD_COUNTIES: readonly WildCounty[] = [
  planned('antrim', 'Antrim', 'Ulster', 'Northern Ireland'),
  planned('armagh', 'Armagh', 'Ulster', 'Northern Ireland'),
  planned('carlow', 'Carlow', 'Leinster'),
  planned('cavan', 'Cavan', 'Ulster'),
  planned('clare', 'Clare', 'Munster'),
  planned('cork', 'Cork', 'Munster'),
  planned('derry-londonderry', 'Derry / Londonderry', 'Ulster', 'Northern Ireland', ['Derry', 'Londonderry']),
  planned('donegal', 'Donegal', 'Ulster'),
  {
    ...planned('down', 'County Down', 'Ulster', 'Northern Ireland'),
    brandName: 'Wild County Down',
    status: 'foundation',
    topics: downTopics,
    businessCandidates: downCandidates,
  },
  planned('dublin', 'Dublin', 'Leinster'),
  planned('fermanagh', 'Fermanagh', 'Ulster', 'Northern Ireland'),
  planned('galway', 'Galway', 'Connacht'),
  planned('kerry', 'Kerry', 'Munster'),
  planned('kildare', 'Kildare', 'Leinster'),
  {
    ...planned('kilkenny', 'Kilkenny', 'Leinster'),
    status: 'foundation',
    topics: kilkennyTopics,
    businessCandidates: kilkennyCandidates,
  },
  planned('laois', 'Laois', 'Leinster'),
  planned('leitrim', 'Leitrim', 'Connacht'),
  planned('limerick', 'Limerick', 'Munster'),
  planned('longford', 'Longford', 'Leinster'),
  planned('louth', 'Louth', 'Leinster'),
  planned('mayo', 'Mayo', 'Connacht'),
  planned('meath', 'Meath', 'Leinster'),
  planned('monaghan', 'Monaghan', 'Ulster'),
  planned('offaly', 'Offaly', 'Leinster'),
  planned('roscommon', 'Roscommon', 'Connacht'),
  planned('sligo', 'Sligo', 'Connacht'),
  planned('tipperary', 'Tipperary', 'Munster'),
  planned('tyrone', 'Tyrone', 'Ulster', 'Northern Ireland'),
  planned('waterford', 'Waterford', 'Munster'),
  planned('westmeath', 'Westmeath', 'Leinster'),
  planned('wexford', 'Wexford', 'Leinster'),
  planned('wicklow', 'Wicklow', 'Leinster'),
] as const

export function getWildCounty(slug: string): WildCounty | undefined {
  return WILD_COUNTIES.find((county) => county.slug === slug)
}

export function searchWildCounties(query: string): readonly WildCounty[] {
  const needle = query.trim().toLocaleLowerCase('en-IE')
  if (!needle) return WILD_COUNTIES

  return WILD_COUNTIES.filter((county) => {
    const searchable = [
      county.name,
      county.brandName,
      county.province,
      county.jurisdiction,
      ...(county.aliases ?? []),
      ...county.topics.flatMap((topic) => [topic.title, topic.summary]),
      ...county.businessCandidates.flatMap((business) => [business.name, business.locality, business.category]),
    ]
    return searchable.some((value) => value.toLocaleLowerCase('en-IE').includes(needle))
  })
}

