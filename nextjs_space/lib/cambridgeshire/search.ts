import { CLAIMS, LNRS, SOURCE_GAPS } from './catalogue'
import { containsPhrase, DISTRICTS, normalise, resolveTaxa, TAXA, type Claim, type District, type Snapshot, type Theme } from './model'

const themes: Record<Theme, string[]> = {
  woodland: ['woodland', 'woodlands', 'wood', 'woods', 'forest'],
  wetland: ['wetland', 'wetlands', 'fen', 'fens', 'river', 'rivers', 'reedbed', 'reedbeds', 'water'],
  grassland: ['grassland', 'grasslands', 'meadow', 'meadows'], gardens: ['garden', 'gardens', 'winter garden'],
}
const seasons = ['winter', 'spring', 'summer', 'autumn']
const stop = new Set('find me all places place with in the where can i see show around a an and or to of for nature ecology wildlife wider county please visit'.split(' '))

export function searchRegion(query: string, district: District | '', snapshot: Snapshot | null) {
  if (query.length > 160) throw new Error('Use a question of 160 characters or fewer.')
  const q = normalise(query)
  const taxa = resolveTaxa(q)
  const themeKeys = (Object.keys(themes) as Theme[]).filter(k => themes[k].some(t => containsPhrase(q, t)))
  const season = seasons.find(s => containsPhrase(q, s))
  const wholeRegion = containsPhrase(q, 'Cambridgeshire and Peterborough') || containsPhrase(q, 'Cambridgeshire Peterborough')
  const namedDistrict = wholeRegion ? undefined : Object.entries(DISTRICTS).sort((a, b) => b[1].length - a[1].length).find(([,name]) => containsPhrase(q, name))?.[0] as District | undefined
  // Cambridgeshire alone always means the complete regional collection.
  const area = district || namedDistrict
  // Do not silently discard unrecognised locations or modifiers after resolving
  // a species: "badgers in Oxford" must not return a Cambridgeshire place.
  let remainder = ` ${q} `
  const phrases = [...Object.values(DISTRICTS), 'Cambridgeshire', ...taxa.flatMap(t => [...TAXA[t]]), ...themeKeys.flatMap(t => themes[t]), ...(season ? [season] : [])].map(normalise).sort((a, b) => b.length - a.length)
  for (const phrase of phrases) remainder = remainder.split(` ${phrase} `).join(' ')
  const residual = remainder.trim().split(' ').filter(t => t && !stop.has(t))
  const matches = (c: Claim) => {
    if (area && c.district !== area) return false
    if (taxa.length && !taxa.some(t => c.taxa.includes(t))) return false
    if (themeKeys.length && !themeKeys.some(t => c.themes.includes(t))) return false
    if (season && !containsPhrase(c.season, season)) return false
    if (residual.length && !residual.every(t => containsPhrase(`${c.title} ${c.text} ${c.locality} ${DISTRICTS[c.district]}`, t))) return false
    return true
  }
  const claims = CLAIMS.filter(matches)
  const groups = (snapshot?.groups || []).filter(g => (!area || g.district === area) &&
    !season && !themeKeys.length && (!taxa.length || taxa.some(t => g.taxonKeys.includes(t))) &&
      (residual.length === 0 || residual.every(t => containsPhrase(g.taxon, t))))
  const coverage = Object.keys(DISTRICTS).filter(d => !area || d === area).map(d => ({
    district: d as District, name: DISTRICTS[d as District],
    places: CLAIMS.filter(c => c.district === d).length,
    occurrences: snapshot?.coverage.find(c => c.district === d) || null,
  }))
  return { query, district: area || '', claims, groups, coverage, lnrs: LNRS, gaps: SOURCE_GAPS,
    generatedAt: snapshot?.generatedAt || null,
    explanation: 'Matching evidence in this collection, not every occurrence in the region. Manager accounts and dated records are separate. No current sighting, open-now status or ecological absence is established.',
  }
}

export function connections(claim: Claim) {
  return claim.relatedSlugs.flatMap(slug => {
    const target = CLAIMS.find(c => c.placeSlug === slug)
    return target ? [{ id: target.id, title: target.title, href: `/wild/cambridgeshire#${slug}`, relation: 'Editorial connection; not a surveyed route or shared-species claim' }] : []
  })
}
