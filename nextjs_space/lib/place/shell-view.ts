// Universal Place shell view model (Place Experience PR D). Pure and
// Place-neutral: it accepts ONLY the PR C public DTOs (PublicPlace,
// PublicMemoryItem) and derives presentation state from them. It never reads a
// table, never receives an internal identifier and never infers presence,
// abundance, trend or condition. Absent evidence is rendered as an explicit
// state, never as absence.

import type { PublicMemoryItem, PublicPlace } from './public-read'
import { CURRENT_PRESENCE_WARNING, DESIGNATION_FEATURE_NOTE, isCurrentPresenceQuestion } from './public-read'

export const PLACE_STATES = [
  'NOT RECORDED',
  'NOT SURVEYED',
  'NOT LOCATED',
  'UNKNOWN',
  'NOT YET INGESTED',
  'RESTRICTED',
  'NOT COMPARABLE',
] as const
export type PlaceState = (typeof PLACE_STATES)[number]

export const NO_EVIDENCE_NOTE = 'No evidence is not evidence of absence.'

export const PLACE_PROMPTS = [
  { id: 'what-lives-here', question: 'What lives here?' },
  { id: 'what-has-changed', question: 'What has changed?' },
  { id: 'what-people-know', question: 'What do people know about this place?' },
  { id: 'how-do-we-know', question: 'How do we know?' },
  { id: 'where-was-it-recorded', question: 'Where was it recorded?' },
] as const
export type PlacePromptId = (typeof PLACE_PROMPTS)[number]['id']

const EVIDENCE_CLASS_LABELS: Record<string, string> = {
  AUTHORITATIVE_STATUTORY: 'Statutory record',
  AUTHORITATIVE_MONITORING: 'Official monitoring',
  PROFESSIONAL_OBSERVATION: 'Professional observation',
  STRUCTURED_CITIZEN_OBSERVATION: 'Structured citizen observation',
  UNVERIFIED_PUBLIC_SUBMISSION: 'Unverified public submission',
  MODEL_DERIVED_OUTPUT: 'Model output',
  BIOVERACITY_DERIVED_ANALYSIS: 'BioVeracity analysis',
}
const OBSERVATION_CLASSES = new Set(['AUTHORITATIVE_MONITORING', 'PROFESSIONAL_OBSERVATION', 'STRUCTURED_CITIZEN_OBSERVATION'])
const PEOPLE_CLASSES = new Set(['STRUCTURED_CITIZEN_OBSERVATION', 'UNVERIFIED_PUBLIC_SUBMISSION'])
const UNCERTAINTY_LABELS: Record<string, string> = {
  designation_not_observation: 'A designation, not an observation',
  current_presence_not_established: 'Current presence not established',
  abundance_not_established: 'Abundance not established',
  condition_not_established: 'Condition not established',
  observation_time_unknown: 'Observation time unknown',
  publication_time_unknown: 'Publication time unknown',
  qualifying_interest_not_current_observation: 'Qualifying interest, not a current observation',
}

export type ShellFact = { label: string; value: string; state: PlaceState | null }

export type ShellEvidenceCard = {
  handle: string
  statement: string
  classLabel: string
  designation: boolean
  facts: ShellFact[]
  /** Source-stated geography precision, only when a public location is disclosed. */
  locationPrecision: string | null
  cautions: string[]
  note: string | null
  source: { publisher: string; licence: string; attribution: string | null; url: string | null; identifier: string | null }
}

export type ShellSpecies = {
  key: string
  label: string
  commonName: string | null
  otherNames: string[]
  framing: 'designation_feature' | 'subject'
  kindLabel: string
  presenceNow: PlaceState
  basis: string
  /** Public handles of the records that name this entry (never internal IDs). */
  handles: string[]
  /** URL-safe, data-derived object slug for the species journey. */
  slug: string
}

/** Every prompt leads on to a truthful view, never a dead end. */
export type ShellPromptAnswer = { id: PlacePromptId; question: string; state: PlaceState | null; summary: string; detail: string; next: { href: `#${string}`; label: string } }

/**
 * ARRIVE evidence categories (Gate F X1). Counts come only from public DTOs.
 * 'unwired' = no public source is connected for this category yet;
 * 'unverified' = a source exists outside the public model but is not verified,
 * so nothing is shown. Neither state is evidence of absence.
 */
export type ArriveCategoryId = 'species' | 'habitats' | 'water' | 'designations' | 'people' | 'climate' | 'planning'
export type ArriveCategory = {
  id: ArriveCategoryId
  label: string
  count: number
  summary: string
  status: 'available' | 'empty' | 'unwired' | 'unverified'
  state: PlaceState | null
  href: string | null
}

/** A record with a known observation/event date. Designations are never dated records. */
export type ArriveDatedRecord = { date: string; statement: string; classLabel: string; handle: string }

/**
 * Where the public record places its evidence (PR F). The public contract
 * carries disclosure and precision only, never geometry, so nothing is drawn:
 * no points, no centroids, no shapes. Counts come from each record's own
 * disclosure; withheld (sensitive or restricted) locations stay withheld.
 */
export type ArriveMap = {
  drawable: false
  state: PlaceState
  records: number
  generalised: number
  namedOnly: number
  withheld: number
  precisions: string[]
  reason: string
}

/** Thirty one-year cells ending in the current year. A window, never a claim. */
export type ArriveTimeWindow = { from: number; to: number; years: Array<{ year: number; records: number }>; outside: number }

/**
 * "What we know so far" (Gate F X1): one statement counted directly from the
 * public DTOs, with its trace to the public record, original source and licence.
 * Nothing is estimated; unknown dates stay UNKNOWN.
 */
export type ArriveKnownSoFar = {
  statement: string
  say: string
  sayDetail: string
  record: { statement: string; classLabel: string; detail: string } | null
  source: { publisher: string; published: string; url: string | null } | null
  licence: { licence: string; attribution: string | null } | null
  doesNotSay: string
}

export type PlaceShellView = {
  title: string
  context: string | null
  /** "Within the … public record", only when a public record carries that name. */
  relation: string | null
  categories: ArriveCategory[]
  timeline: ArriveDatedRecord[]
  timeWindow: ArriveTimeWindow
  known: ArriveKnownSoFar
  publicItemCount: number
  prompts: ShellPromptAnswer[]
  cards: ShellEvidenceCard[]
  species: ShellSpecies[]
  designationNote: string | null
  map: ArriveMap
  /** Canonical Place path, used for Place-scoped search and object journeys. */
  path: string | null
  sources: Array<{ publisher: string; licence: string; attribution: string | null; url: string | null; retrievedAt: string | null; publishedAt: string | null }>
}

export type PlacePresentation = {
  displayTitle?: string | null
  /**
   * Name of the public record this Place sits within. Rendered as
   * "Within the <name> public record" ONLY when a public statutory record's
   * statement actually contains that name; otherwise it is dropped.
   */
  relationRecord?: string | null
}

const day = (iso: string | null): string | null => (iso ? iso.slice(0, 10) : null)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function timeFact(item: PublicMemoryItem): ShellFact {
  if (item.time.unknown) return { label: 'When', value: 'UNKNOWN', state: 'UNKNOWN' }
  const start = day(item.time.start)
  const end = day(item.time.end)
  return { label: 'When', value: start && end && start !== end ? `${start} to ${end}` : (start ?? end ?? 'UNKNOWN'), state: null }
}

function locationFact(item: PublicMemoryItem): ShellFact {
  if (!item.location) return { label: 'Location', value: 'RESTRICTED: no public location is shown', state: 'RESTRICTED' }
  if (item.location.disclosure === 'NAMED_ONLY') return { label: 'Location', value: 'NOT LOCATED: named place only, no map', state: 'NOT LOCATED' }
  return { label: 'Location', value: 'Generalised area only, no exact point', state: null }
}

function dateFact(label: string, iso: string | null, missing: PlaceState): ShellFact {
  const value = day(iso)
  return value ? { label, value, state: null } : { label, value: missing, state: missing }
}

function card(item: PublicMemoryItem): ShellEvidenceCard {
  const designation = item.interpretation.note !== null
  return {
    handle: item.handle,
    statement: item.statement,
    classLabel: EVIDENCE_CLASS_LABELS[item.evidenceClass] ?? 'Other record',
    designation,
    facts: [
      timeFact(item),
      locationFact(item),
      dateFact('Observed', item.source.observedAt, 'NOT RECORDED'),
      dateFact('Published', item.source.publishedAt, 'UNKNOWN'),
      dateFact('Retrieved', item.source.retrievedAt, 'UNKNOWN'),
    ],
    locationPrecision: item.location?.precision?.trim() || null,
    cautions: item.uncertainty.map((flag) => UNCERTAINTY_LABELS[flag]).filter((v): v is string => Boolean(v)),
    note: item.interpretation.note,
    source: {
      publisher: item.source.publisher ?? 'UNKNOWN',
      licence: item.source.licence,
      attribution: item.source.attribution,
      url: item.source.url,
      identifier: item.source.sourceIdentifier,
    },
  }
}

const KIND_LABELS: Record<string, string> = { TAXON: 'Species', ECOLOGICAL_FEATURE: 'Habitat or feature' }

function species(items: PublicMemoryItem[]): ShellSpecies[] {
  const byKey = new Map<string, ShellSpecies>()
  for (const item of items) {
    for (const rel of item.relationships) {
      const key = `${rel.kind}:${rel.authority ?? ''}:${rel.sourceIdentifier ?? rel.label}:${rel.framing}`
      const seen = byKey.get(key)
      if (seen) {
        if (!seen.handles.includes(item.handle)) seen.handles.push(item.handle)
        continue
      }
      const designation = rel.framing === 'designation_feature'
      byKey.set(key, {
        key,
        label: rel.label,
        commonName: rel.otherNames[0] ?? null,
        otherNames: rel.otherNames.slice(1),
        framing: rel.framing,
        kindLabel: KIND_LABELS[rel.kind] ?? 'Feature',
        // The public contract never supports current presence; say so per entry.
        presenceNow: 'UNKNOWN',
        basis: designation ? 'Named as a designation feature' : `Named in a ${(EVIDENCE_CLASS_LABELS[item.evidenceClass] ?? 'public record').toLowerCase()}`,
        handles: [item.handle],
        slug: speciesSlug(rel.label),
      })
    }
  }
  return [...byKey.values()].sort((a, b) => Number(a.framing === 'designation_feature') - Number(b.framing === 'designation_feature') || (a.commonName ?? a.label).localeCompare(b.commonName ?? b.label, 'en'))
}

function prompts(items: PublicMemoryItem[], speciesList: ShellSpecies[], map: ArriveMap): ShellPromptAnswer[] {
  const observations = items.filter((i) => OBSERVATION_CLASSES.has(i.evidenceClass) && i.interpretation.note === null)
  const observedTaxa = speciesList.filter((s) => s.framing === 'subject').length
  const designationFeatures = speciesList.filter((s) => s.framing === 'designation_feature').length
  const dated = observations.filter((i) => !i.time.unknown)
  const people = items.filter((i) => PEOPLE_CLASSES.has(i.evidenceClass))
  const sources = new Set(items.map((i) => `${i.source.publisher ?? ''}|${i.source.sourceIdentifier ?? ''}`)).size

  const lives: Omit<ShellPromptAnswer, 'next'> = observations.length
    ? { id: 'what-lives-here', question: 'What lives here?', state: null,
        summary: `${plural(observations.length, 'public observation record')} naming ${plural(observedTaxa, 'species or feature', 'species or features')}.`,
        detail: 'Each record is shown with its date and source. A record shows what was reported at that time, not what is here now.' }
    : { id: 'what-lives-here', question: 'What lives here?', state: 'NOT RECORDED',
        summary: 'No public species observations are recorded for this place yet.',
        detail: designationFeatures
          ? `A designation names ${plural(designationFeatures, 'feature')} as reasons the site is protected. That does not show what lives here now. ${NO_EVIDENCE_NOTE}`
          : NO_EVIDENCE_NOTE }
  const livesNext: ShellPromptAnswer['next'] = speciesList.length ? { href: '#species', label: 'See the species and features named' } : { href: '#evidence', label: 'See the public record' }
  const changed: Omit<ShellPromptAnswer, 'next'> = dated.length >= 2
    ? { id: 'what-has-changed', question: 'What has changed?', state: 'NOT COMPARABLE',
        summary: `${plural(dated.length, 'dated record')} exist, but no like-for-like comparison has been made.`,
        detail: 'Change is only shown where methods, places and times can be compared. No trend is claimed.' }
    : { id: 'what-has-changed', question: 'What has changed?', state: 'NOT RECORDED',
        summary: 'There are not enough dated, comparable records to describe change.',
        detail: `No trend, decline or increase is claimed. ${NO_EVIDENCE_NOTE}` }
  const changedNext: ShellPromptAnswer['next'] = { href: '#time', label: 'Travel through time' }
  const know: Omit<ShellPromptAnswer, 'next'> = people.length
    ? { id: 'what-people-know', question: 'What do people know about this place?', state: null,
        summary: `${plural(people.length, 'public contribution')} from people and groups.`,
        detail: 'Contributions are labelled by how they were collected and checked.' }
    : { id: 'what-people-know', question: 'What do people know about this place?', state: 'NOT YET INGESTED',
        summary: 'Local and community knowledge has not been added to this place yet.',
        detail: 'Contributions are not open yet. Nothing here should be read as nobody knowing this place.' }
  const knowNext: ShellPromptAnswer['next'] = { href: '#evidence', label: 'See what the public record holds' }
  const how: ShellPromptAnswer = { id: 'how-do-we-know', question: 'How do we know?', state: null,
    summary: `${plural(items.length, 'public record')} from ${plural(sources, 'source')}, each with its licence.`,
    detail: 'Every statement links to where it came from. Unknown dates stay marked as unknown.',
    next: { href: '#how-we-know', label: 'How we know' } }
  const where: ShellPromptAnswer = { id: 'where-was-it-recorded', question: 'Where was it recorded?', state: map.state,
    summary: map.reason,
    detail: 'Locations are shown only as precisely as their source states them. Nothing is placed on a map by guesswork.',
    next: { href: '#map', label: 'See where the record places it' } }
  return [{ ...lives, next: livesNext }, { ...changed, next: changedNext }, { ...know, next: knowNext }, how, where]
}

function relation(cards: ShellEvidenceCard[], presentation: PlacePresentation): string | null {
  const name = presentation.relationRecord?.trim()
  if (!name) return null
  const backed = cards.some((c) => c.classLabel === EVIDENCE_CLASS_LABELS.AUTHORITATIVE_STATUTORY && c.statement.includes(name))
  return backed ? `Within the ${name} public record` : null
}

function categories(cards: ShellEvidenceCard[], speciesList: ShellSpecies[], items: PublicMemoryItem[]): ArriveCategory[] {
  const designations = cards.filter((c) => c.designation).length
  const taxa = speciesList.filter((s) => s.kindLabel === KIND_LABELS.TAXON).length
  const features = speciesList.length - taxa
  const people = items.filter((i) => PEOPLE_CLASSES.has(i.evidenceClass)).length
  return [
    taxa
      ? { id: 'species', label: 'Species', count: taxa, status: 'available', state: null, href: '#species',
          summary: `${plural(taxa, 'species', 'species')} named in public records.` }
      : { id: 'species', label: 'Species', count: 0, status: 'empty', state: 'NOT RECORDED', href: null,
          summary: `No public record names species here yet. ${NO_EVIDENCE_NOTE}` },
    features
      ? { id: 'habitats', label: 'Habitats', count: features, status: 'available', state: null, href: '#species',
          summary: `${plural(features, 'habitat or feature', 'habitats or features')} named in public records.` }
      : { id: 'habitats', label: 'Habitats', count: 0, status: 'empty', state: 'NOT RECORDED', href: null,
          summary: `No public record names habitats here yet. ${NO_EVIDENCE_NOTE}` },
    { id: 'water', label: 'Water', count: 0, status: 'unverified', state: 'NOT YET INGESTED', href: null,
      summary: 'Water-quality data is not shown: its source has not been verified for this place.' },
    designations
      ? { id: 'designations', label: 'Designations', count: designations, status: 'available', state: null, href: '#evidence',
          summary: `${plural(designations, 'protected-area designation')} in the public record.` }
      : { id: 'designations', label: 'Designations', count: 0, status: 'empty', state: 'NOT RECORDED', href: null,
          summary: `No protected-area designation is in the public record here. ${NO_EVIDENCE_NOTE}` },
    people
      ? { id: 'people', label: 'People', count: people, status: 'available', state: null, href: '#evidence',
          summary: `${plural(people, 'public contribution')} from people and groups.` }
      : { id: 'people', label: 'People', count: 0, status: 'unwired', state: 'NOT YET INGESTED', href: null,
          summary: 'Local and community knowledge has not been added to this place yet.' },
    { id: 'climate', label: 'Climate', count: 0, status: 'unwired', state: 'NOT YET INGESTED', href: null,
      summary: 'Climate records have not been added to this place yet.' },
    { id: 'planning', label: 'Planning', count: 0, status: 'unwired', state: 'NOT YET INGESTED', href: null,
      summary: 'Planning records have not been added to this place yet.' },
  ]
}

function timeline(cards: ShellEvidenceCard[]): ArriveDatedRecord[] {
  return cards
    .filter((c) => !c.designation)
    .flatMap((c) => {
      const when = c.facts.find((f) => f.label === 'When')
      return when && when.state === null ? [{ date: when.value, statement: c.statement, classLabel: c.classLabel, handle: c.handle }] : []
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const TIME_WINDOW_YEARS = 30

function timeWindow(records: ArriveDatedRecord[], toYear: number): ArriveTimeWindow {
  const from = toYear - TIME_WINDOW_YEARS + 1
  const counts = new Map<number, number>()
  let outside = 0
  for (const r of records) {
    const y = Number(r.date.slice(0, 4))
    if (y >= from && y <= toYear) counts.set(y, (counts.get(y) ?? 0) + 1)
    else outside += 1
  }
  return { from, to: toYear, years: Array.from({ length: TIME_WINDOW_YEARS }, (_, k) => ({ year: from + k, records: counts.get(from + k) ?? 0 })), outside }
}

function known(title: string, cards: ShellEvidenceCard[], speciesList: ShellSpecies[], items: PublicMemoryItem[]): ArriveKnownSoFar {
  const designation = cards.find((c) => c.designation)
  const features = speciesList.filter((s) => s.framing === 'designation_feature')
  if (designation && features.length) {
    const taxa = features.filter((s) => s.kindLabel === KIND_LABELS.TAXON).length
    const other = features.length - taxa
    const parts = [taxa ? plural(taxa, 'species', 'species') : null, other ? plural(other, 'habitat or feature', 'habitats or features') : null].filter(Boolean).join(' and ')
    const published = designation.facts.find((f) => f.label === 'Published')!
    return {
      statement: `${parts} ${features.length === 1 ? 'is' : 'are'} named in the ${designation.statement} designation.`,
      say: 'A count of the features the designation names as reasons the site is protected',
      sayDetail: 'Counted directly from the public record below. Nothing is estimated.',
      record: { statement: designation.statement, classLabel: designation.classLabel, detail: parts },
      source: { publisher: designation.source.publisher, published: published.state ?? published.value, url: designation.source.url },
      licence: { licence: designation.source.licence, attribution: designation.source.attribution },
      doesNotSay: `It does not say these features are at ${title} today, or how many there are. ${DESIGNATION_FEATURE_NOTE}`,
    }
  }
  const first = cards[0]
  if (first) {
    const sources = new Set(items.map((i) => `${i.source.publisher ?? ''}|${i.source.sourceIdentifier ?? ''}`)).size
    return {
      statement: `${plural(items.length, 'public record')} from ${plural(sources, 'source')} ${items.length === 1 ? 'is' : 'are'} held for ${title}.`,
      say: 'A count of the public records held for this place',
      sayDetail: 'Counted directly from the public records. Nothing is estimated.',
      record: { statement: first.statement, classLabel: first.classLabel, detail: plural(cards.length, 'public record') },
      source: { publisher: first.source.publisher, published: (() => { const p = first.facts.find((f) => f.label === 'Published')!; return p.state ?? p.value })(), url: first.source.url },
      licence: { licence: first.source.licence, attribution: first.source.attribution },
      doesNotSay: `A record shows what was reported at that time, not what is here now. ${NO_EVIDENCE_NOTE}`,
    }
  }
  return {
    statement: `Nothing has been gathered for ${title} yet.`,
    say: 'No public record is held for this place yet',
    sayDetail: 'Nothing is shown until a public record is linked.',
    record: null, source: null, licence: null,
    doesNotSay: NO_EVIDENCE_NOTE,
  }
}

export function buildPlaceShellView(place: PublicPlace, items: PublicMemoryItem[], presentation: PlacePresentation = {}, now: Date = new Date()): PlaceShellView {
  const displayTitle = presentation.displayTitle?.trim()
  const title = displayTitle || place.name
  const speciesList = species(items)
  const cards = items.map(card)
  const dated = timeline(cards)
  const map = mapEvidence(cards)
  const sourceMap = new Map<string, PlaceShellView['sources'][number]>()
  for (const item of items) {
    const key = `${item.source.publisher ?? ''}|${item.source.sourceIdentifier ?? ''}|${item.source.licence}`
    if (!sourceMap.has(key)) sourceMap.set(key, {
      publisher: item.source.publisher ?? 'UNKNOWN', licence: item.source.licence, attribution: item.source.attribution,
      url: item.source.url, retrievedAt: day(item.source.retrievedAt), publishedAt: day(item.source.publishedAt),
    })
  }
  return {
    title,
    context: title === place.name ? null : place.name,
    relation: relation(cards, presentation),
    categories: categories(cards, speciesList, items),
    timeline: dated,
    timeWindow: timeWindow(dated, now.getUTCFullYear()),
    known: known(title, cards, speciesList, items),
    publicItemCount: place.publicItemCount,
    prompts: prompts(items, speciesList, map),
    cards,
    species: speciesList,
    designationNote: speciesList.some((s) => s.framing === 'designation_feature') ? DESIGNATION_FEATURE_NOTE : null,
    sources: [...sourceMap.values()],
    map,
    path: place.slug ? `/place/${place.slug}` : null,
  }
}

/** Anchor id for a public record card. Built from the public handle only. */
export const recordAnchor = (handle: string) => `record-${handle}`

export const SPECIES_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const fold = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Deterministic, data-derived object slug (the source's own label, folded). */
export function speciesSlug(label: string): string {
  return fold(label).replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 80).replace(/-+$/, '') || 'feature'
}

function mapEvidence(cards: ShellEvidenceCard[]): ArriveMap {
  const state = (c: ShellEvidenceCard) => c.facts.find((f) => f.label === 'Location')?.state ?? null
  const generalised = cards.filter((c) => state(c) === null).length
  const namedOnly = cards.filter((c) => state(c) === 'NOT LOCATED').length
  const withheld = cards.filter((c) => state(c) === 'RESTRICTED').length
  const precisions = [...new Set(cards.filter((c) => state(c) !== 'RESTRICTED').map((c) => c.locationPrecision).filter((p): p is string => Boolean(p)))]
  if (!cards.length) {
    return { drawable: false, state: 'NOT RECORDED', records: 0, generalised, namedOnly, withheld, precisions, reason: 'No public record is linked yet, so there is nothing to place.' }
  }
  const parts = [
    namedOnly ? `${plural(namedOnly, 'record')} ${namedOnly === 1 ? 'names' : 'name'} the place only` : null,
    generalised ? `${plural(generalised, 'record')} ${generalised === 1 ? 'gives' : 'give'} a generalised area only` : null,
    withheld ? `${plural(withheld, 'record')} ${withheld === 1 ? 'has its' : 'have their'} location withheld` : null,
  ].filter(Boolean).join('; ')
  return {
    drawable: false,
    state: withheld === cards.length ? 'RESTRICTED' : 'NOT LOCATED',
    records: cards.length, generalised, namedOnly, withheld, precisions,
    reason: `${parts}. No public record gives a mappable location, so no map is drawn.`,
  }
}

type JourneySource = { publisher: string; licence: string; attribution: string | null; url: string | null; published: string; retrieved: string }

/**
 * Reusable object journey (PR F): Overview -> Chronology -> Map -> Evidence ->
 * Sources for one species or feature, built only from the Place view. A
 * designation feature is never current presence; undated records stay off the
 * chronology.
 */
export type SpeciesJourney = {
  slug: string
  title: string
  latin: string | null
  otherNames: string[]
  kindLabel: string
  bases: string[]
  designation: boolean
  observed: boolean
  presenceNow: PlaceState
  note: string | null
  chronology: ArriveDatedRecord[]
  undated: number
  map: ArriveMap
  cards: ShellEvidenceCard[]
  sources: JourneySource[]
}

export function speciesJourney(view: PlaceShellView, slug: string): SpeciesJourney | null {
  if (typeof slug !== 'string' || slug.length > 80 || !SPECIES_SLUG_RE.test(slug)) return null
  const entries = view.species.filter((s) => s.slug === slug)
  if (!entries.length) return null
  const handles = new Set(entries.flatMap((s) => s.handles))
  const cards = view.cards.filter((c) => handles.has(c.handle))
  const chronology = view.timeline.filter((r) => handles.has(r.handle))
  const first = entries[0]
  const designation = entries.some((s) => s.framing === 'designation_feature')
  const sources = new Map<string, JourneySource>()
  for (const c of cards) {
    const key = `${c.source.publisher}|${c.source.licence}|${c.source.url ?? ''}`
    const fact = (label: string) => { const f = c.facts.find((x) => x.label === label); return f ? (f.state ?? f.value) : 'UNKNOWN' }
    if (!sources.has(key)) sources.set(key, { ...c.source, published: fact('Published'), retrieved: fact('Retrieved') })
  }
  return {
    slug,
    title: first.commonName ?? first.label,
    latin: first.commonName ? first.label : null,
    otherNames: [...new Set(entries.flatMap((s) => s.otherNames))],
    kindLabel: first.kindLabel,
    bases: [...new Set(entries.map((s) => s.basis))],
    designation,
    observed: entries.some((s) => s.framing === 'subject'),
    presenceNow: 'UNKNOWN',
    note: designation ? DESIGNATION_FEATURE_NOTE : null,
    chronology,
    undated: cards.length - chronology.length,
    map: mapEvidence(cards),
    cards,
    sources: [...sources.values()],
  }
}

export const PLACE_SEARCH_MAX_LENGTH = 300
const SEARCH_STOP = new Set(('the and for are was were what where when which who how does did can could you your there here this that with from into about have has any all its is of in on at to an me my we our do be been now today currently current still see seen spot find present presence lives live').split(' '))

export type PlaceSearchResult = {
  q: string
  status: 'ok' | 'invalid'
  warning: string | null
  species: Array<{ slug: string; title: string; latin: string | null; basis: string }>
  records: Array<{ handle: string; statement: string; classLabel: string }>
}

/**
 * Place-scoped, deterministic lexical search over the public records already
 * on the Place view (PR F). No provider, no ranking model: folded tokens are
 * matched against source labels and statements, ranked by tokens matched, then
 * by the view's own order. A current-presence question carries the public
 * contract's warning; matching never implies presence.
 */
export function searchPlaceView(view: PlaceShellView, raw: unknown): PlaceSearchResult | null {
  if (typeof raw !== 'string') return null
  const q = raw.trim()
  if (!q) return null
  if (q.length > PLACE_SEARCH_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(q)) return { q: q.slice(0, 80), status: 'invalid', warning: null, species: [], records: [] }
  const tokens = [...new Set(fold(q).split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !SEARCH_STOP.has(t)))].slice(0, 8)
  const score = (hay: string) => { const h = fold(hay); return tokens.filter((t) => h.includes(t)).length }
  const rank = <T,>(rows: Array<{ row: T; n: number }>) => rows.filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 30).map((r) => r.row)
  const bySlug = new Map<string, ShellSpecies[]>()
  for (const s of view.species) bySlug.set(s.slug, [...(bySlug.get(s.slug) ?? []), s])
  const species = rank([...bySlug.entries()].map(([slug, list]) => ({
    row: { slug, title: list[0].commonName ?? list[0].label, latin: list[0].commonName ? list[0].label : null, basis: list.map((s) => s.basis).join(' · ') },
    n: score(list.flatMap((s) => [s.label, s.commonName ?? '', ...s.otherNames, s.kindLabel]).join(' ')),
  })))
  const records = rank(view.cards.map((c) => ({
    row: { handle: c.handle, statement: c.statement, classLabel: c.classLabel },
    n: score([c.statement, c.classLabel, c.source.publisher, ...view.species.filter((s) => s.handles.includes(c.handle)).flatMap((s) => [s.label, s.commonName ?? '', ...s.otherNames])].join(' ')),
  })))
  return { q, status: 'ok', warning: isCurrentPresenceQuestion(q) ? CURRENT_PRESENCE_WARNING : null, species, records }
}
